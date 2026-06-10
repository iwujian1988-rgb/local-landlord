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

  /** Create bill (wrapped in transaction) */
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

      const newBill = manager.create(Bill, {
        roomId,
        tenantId: tenant.id,
        period: dto.period,
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

  /** Get bill detail (with bill_items) */
  async findOne(id: number): Promise<Bill> {
    const bill = await this.billRepository.findOne({
      where: { id },
      relations: ['items', 'tenant', 'room'],
    });
    if (!bill) throw new NotFoundException('账单不存在');
    return bill;
  }

  /** Confirm payment (update bill status + create rent_record, wrapped in transaction) */
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

      bill.status = 1;
      bill.paidAt = new Date();
      await manager.save(bill);

      const rentRecord = manager.create(RentRecord, {
        roomId: bill.roomId,
        billId: bill.id,
        type: 1,
        title: `收租-${bill.period}`,
        description: dto.paymentNote || `确认收款: ${bill.totalAmount}`,
        amount: dto.actualAmount ?? bill.totalAmount,
      });
      await manager.save(rentRecord);

      return bill;
    });
  }

  /** Send bill (mark sent_at) */
  async sendBill(id: number): Promise<Bill> {
    const bill = await this.findOne(id);
    if (!bill) throw new NotFoundException('账单不存在');
    bill.sentAt = new Date();
    return this.billRepository.save(bill);
  }

  /** Get current-period bill items for a room (API contract shape) */
  async findByRoom(roomId: number): Promise<{ roomName: string; tenantName: string; billItems: any[] }> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('房间不存在');

    const tenant = await this.tenantRepository.findOne({ where: { roomId, status: 1 } });

    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const currentBill = await this.billRepository.findOne({
      where: { roomId, period: monthStr },
      relations: ['items'],
    });

    const feeItems = await this.feeItemRepository.find({ where: { roomId }, order: { sortOrder: 'ASC' } });

    const billItems = feeItems.map(fee => {
      const matchedBillItem = currentBill?.items?.find(bi => bi.feeName === fee.name);
      return {
        name: fee.name,
        amount: matchedBillItem ? Number(matchedBillItem.amount) : (fee.enabled ? Number(fee.amount) || 0 : 0),
        type: fee.type === 0 ? 'fixed' : 'manual',
        feeId: fee.id,
      };
    });

    return {
      roomName: room.name,
      tenantName: tenant?.name || '',
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

      if (rentDay === 0) {
        const periodDate = dayjs(bill.period + '-01');
        dueDay = periodDate.endOf('month').date();
      } else {
        dueDay = rentDay;
      }

      const periodDate = dayjs(bill.period + '-01');
      const billMonth = periodDate.month();
      const billYear = periodDate.year();

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
