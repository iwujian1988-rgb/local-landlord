import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository, InjectEntityManager } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository, EntityManager, In } from 'typeorm';
import dayjs from 'dayjs';
import { Bill } from './bill.entity';
import { BillItem } from './bill-item.entity';
import { RentRecord } from '../rent/rent-record.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Room } from '../room/room.entity';
import { Property } from '../property/property.entity';
import { FeeItem } from '../fee/fee-item.entity';
import { CreateBillDto } from './dto/create-bill.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';

@Injectable()
export class BillService {
  constructor(
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
    @InjectRepository(BillItem)
    private readonly billItemRepository: Repository<BillItem>,
    @InjectRepository(RentRecord)
    private readonly rentRecordRepository: Repository<RentRecord>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(FeeItem)
    private readonly feeItemRepository: Repository<FeeItem>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  /** Verify room belongs to landlord */
  async verifyRoomOwnership(roomId: number, landlordId: number): Promise<void> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('房间不存在');
    const property = await this.propertyRepository.findOne({ where: { id: room.propertyId } });
    if (!property || property.landlordId !== landlordId) {
      throw new ForbiddenException('无权访问该房间');
    }
  }

  /** Verify bill belongs to landlord (via room -> property chain) */
  async verifyBillOwnership(billId: number, landlordId: number): Promise<void> {
    const bill = await this.billRepository.findOne({ where: { id: billId } });
    if (!bill) throw new NotFoundException('账单不存在');
    await this.verifyRoomOwnership(bill.roomId, landlordId);
  }

  /** Create bill (wrapped in transaction). Multi-month aware via tenant.payMonths. */
  async create(roomId: number, dto: CreateBillDto): Promise<Bill> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('账单至少需要一个费用项');
    }

    return this.entityManager.transaction(async (manager) => {
      const tenant = await manager.findOne(Tenant, {
        where: { roomId, status: 1 },
      });
      if (!tenant) throw new BadRequestException('房间没有在租租客，无法生成账单');

      const existingBill = await manager.findOne(Bill, {
        where: { roomId, period: dto.period },
      });
      if (existingBill) {
        throw new BadRequestException('该周期已存在账单');
      }

      const totalAmount = dto.items.reduce((sum, item) => sum + Number(item.amount), 0);

      // periodEnd = period + payMonths - 1 months. For payMonths=1, periodEnd = period.
      const payMonths = tenant.payMonths ?? 1;
      const periodDate = dayjs(dto.period + '-01');
      const periodEnd = periodDate.add(payMonths - 1, 'month').format('YYYY-MM');

      const newBill = manager.create(Bill, {
        roomId,
        tenantId: tenant.id,
        period: dto.period,
        periodEnd,
        totalAmount,
        status: 0,
        photos: dto.photos || [],
        sentAt: new Date(),
      });
      const savedBill = await manager.save(newBill);

      const billItems = dto.items.map(item =>
        manager.create(BillItem, {
          billId: savedBill.id,
          feeName: item.feeName,
          amount: item.amount,
        }),
      );
      await manager.save(billItems);

      const bill = await manager.findOne(Bill, {
        where: { id: savedBill.id },
        relations: ['items', 'tenant', 'room'],
      });
      if (!bill) throw new Error('Bill not found after creation');
      return bill;
    });
  }

  /**
   * Internal helper: compute periodEnd from a start period and payMonths.
   * Exported as a static utility so the subscription cron (which actually
   * creates the bills) and other services can share the same math.
   */
  static computePeriodEnd(periodStart: string, payMonths: number): string {
    const months = Math.max(1, payMonths);
    return dayjs(periodStart + '-01').add(months - 1, 'month').format('YYYY-MM');
  }

  /** Get bill detail (with bill_items) */
  async findOne(id: number): Promise<Bill> {
    const bill = await this.billRepository.findOne({
      where: { id },
      relations: ['items', 'tenant', 'room'],
    });
    if (!bill) throw new NotFoundException('账单不存在');
    return bill;
  }

  /** Confirm payment — supports partial payments via actualAmount + status=3 */
  async confirmPayment(id: number, dto: ConfirmPaymentDto): Promise<Bill> {
    return this.entityManager.transaction(async (manager) => {
      const bill = await manager.findOne(Bill, {
        where: { id },
        relations: ['items', 'tenant', 'room'],
      });
      if (!bill) throw new NotFoundException('账单不存在');

      if (bill.status === 1) {
        throw new BadRequestException('该账单已确认收款');
      }
      if (bill.status === 4) {
        throw new BadRequestException('该账单已退租作废，无法收款');
      }

      const totalAmount = Number(bill.totalAmount);
      const currentPaid = Number(bill.paidAmount) || 0;
      const remaining = totalAmount - currentPaid;

      // actualAmount defaults to remaining balance (i.e., pay off in full)
      const actualAmount = dto.actualAmount != null ? Number(dto.actualAmount) : remaining;

      if (!(actualAmount > 0)) {
        throw new BadRequestException('收款金额必须大于 0');
      }
      // Reject over-payment — keeps paidAmount audit-clean. Landlord should
      // either record the over-payment as a separate single-charge, or adjust
      // totalAmount first.
      if (actualAmount > remaining + 0.01) {
        throw new BadRequestException(
          `收款金额 ${actualAmount} 超出待收 ${remaining} 元，请先修改账单金额或单独记一笔超额收款`,
        );
      }

      const newPaidAmount = currentPaid + actualAmount;
      const isFullyPaid = newPaidAmount >= totalAmount - 0.01;

      bill.paidAmount = isFullyPaid ? totalAmount : newPaidAmount;
      bill.status = isFullyPaid ? 1 : 3;
      // Set paidAt on first payment (covers both full and partial first installment).
      // Without this, status=3 bills never get a paidAt, breaking stats audit.
      if (!bill.paidAt) {
        bill.paidAt = new Date();
      }
      await manager.save(bill);

      const rentRecord = manager.create(RentRecord, {
        roomId: bill.roomId,
        billId: bill.id,
        type: 1,
        title: `收租-${bill.period}`,
        description: dto.paymentNote
          || (isFullyPaid
            ? (currentPaid > 0 ? `补齐尾款: ${actualAmount}，合计 ${totalAmount}` : `确认收款: ${totalAmount}`)
            : `部分付款: ${actualAmount}，已收 ${newPaidAmount}/${totalAmount}`),
        amount: actualAmount,
      });
      await manager.save(rentRecord);

      return bill;
    });
  }

  /** Send bill (mark sent_at). Optionally update items + recompute total in the same tx. */
  async sendBill(
    id: number,
    items?: { feeName?: string; name?: string; amount: number }[],
  ): Promise<Bill> {
    return this.entityManager.transaction(async (manager) => {
      const bill = await manager.findOne(Bill, {
        where: { id },
        relations: ['items', 'tenant', 'room'],
      });
      if (!bill) throw new NotFoundException('账单不存在');

      if (bill.status === 4) {
        throw new BadRequestException('该账单已退租作废，无法发送');
      }

      // Part-paid bills: refuse item edits to avoid breaking paidAmount audit.
      // Landlord must either confirm remaining collection or void + recreate.
      if (items && items.length > 0 && bill.status === 3) {
        throw new BadRequestException(
          '该账单已部分付款，无法调整账单项；如需修改请先确认收款完成或重新生成账单',
        );
      }

      if (items && items.length > 0) {
        await manager.delete(BillItem, { billId: id });
        const newItems = items.map(item =>
          manager.create(BillItem, {
            billId: id,
            feeName: item.feeName || item.name || '',
            amount: Number(item.amount) || 0,
          }),
        );
        await manager.save(newItems);
        bill.totalAmount = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
      }

      bill.sentAt = new Date();
      return manager.save(bill);
    });
  }

  /** Get current-period bill items for a room (API contract shape) */
  async findByRoom(roomId: number): Promise<{
    roomName: string;
    tenantName: string;
    billId: number | null;
    period: string;
    periodEnd: string | null;
    billItems: any[];
  }> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('房间不存在');

    const tenant = await this.tenantRepository.findOne({ where: { roomId, status: 1 } });
    const payMonths = tenant?.payMonths ?? 1;

    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Find any bill whose coverage window includes the current month.
    // New multi-month bills: period <= current <= periodEnd.
    // Legacy single-month bills (periodEnd IS NULL): only period = current.
    // Exclude cancelled (status=4) — those are退租作废 bills.
    const currentBill = await this.billRepository
      .createQueryBuilder('bill')
      .where('bill.room_id = :roomId', { roomId })
      .andWhere('bill.status != :cancelled', { cancelled: 4 })
      .andWhere(
        '((bill.period <= :monthStr AND bill.period_end >= :monthStr) ' +
        'OR (bill.period = :monthStr AND bill.period_end IS NULL))',
        { monthStr },
      )
      .orderBy('bill.created_at', 'DESC')
      .getOne();

    let currentBillWithItems: Bill | null = null;
    if (currentBill) {
      currentBillWithItems = await this.billRepository.findOne({
        where: { id: currentBill.id },
        relations: ['items'],
      });
    }

    const feeItems = await this.feeItemRepository.find({ where: { roomId }, order: { sortOrder: 'ASC' } });

    const billItems = feeItems.map(fee => {
      const matchedBillItem = currentBillWithItems?.items?.find(bi => bi.feeName === fee.name);
      let amount: number;
      if (matchedBillItem) {
        amount = Number(matchedBillItem.amount);
      } else if (fee.enabled) {
        // No draft yet — pre-fill based on type and tenant's payMonths.
        // Fixed items get × payMonths (rent for the whole cycle); manual items default to 0.
        amount = fee.type === 0 ? (Number(fee.amount) || 0) * payMonths : 0;
      } else {
        amount = 0;
      }
      return {
        name: fee.name,
        amount,
        type: fee.type === 0 ? 'fixed' : 'manual',
        feeId: fee.id,
      };
    });

    return {
      roomName: room.name,
      tenantName: tenant?.name || '',
      billId: currentBillWithItems?.id || null,
      period: currentBillWithItems?.period || monthStr,
      periodEnd: currentBillWithItems?.periodEnd || null,
      billItems,
    };
  }

  /**
   * Scheduled task: mark overdue bills at midnight.
   * Optimized to use a single SQL UPDATE instead of N+1 loop.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async markOverdueBills(): Promise<void> {
    const now = dayjs();
    const today = now.date();
    const currentMonth = now.month();
    const currentYear = now.year();

    // Single query: find all unpaid bills with their tenant's rentDay
    const overdueBillIds: number[] = [];

    const unpaidBills = await this.billRepository
      .createQueryBuilder('bill')
      .leftJoinAndSelect('bill.tenant', 'tenant')
      .where('bill.status = 0')
      .getMany();

    for (const bill of unpaidBills) {
      if (!bill.tenant) continue;

      const rentDay = bill.tenant.rentDay ?? 10;
      let dueDay: number;

      // Use periodEnd (if set) as the effective "due-month" for overdue detection.
      // Old bills without periodEnd fall back to period (single-month behavior).
      const effectivePeriod = bill.periodEnd || bill.period;
      const effectiveDate = dayjs(effectivePeriod + '-01');

      if (rentDay === 0) {
        dueDay = effectiveDate.endOf('month').date();
      } else {
        dueDay = rentDay;
      }

      const billMonth = effectiveDate.month();
      const billYear = effectiveDate.year();

      if (billYear < currentYear || (billYear === currentYear && billMonth < currentMonth)) {
        overdueBillIds.push(bill.id);
      } else if (billYear === currentYear && billMonth === currentMonth) {
        if (today > dueDay) {
          overdueBillIds.push(bill.id);
        }
      }
    }

    if (overdueBillIds.length > 0) {
      // Single bulk UPDATE instead of individual updates
      await this.billRepository
        .createQueryBuilder()
        .update(Bill)
        .set({ status: 2 })
        .where('id IN (:...ids)', { ids: overdueBillIds })
        .execute();
    }
  }
}
