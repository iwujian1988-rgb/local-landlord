import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import dayjs from 'dayjs';
import { Tenant } from './tenant.entity';
import { Room } from '../room/room.entity';
import { Property } from '../property/property.entity';
import { Bill } from '../bill/bill.entity';
import { BillItem } from '../bill/bill-item.entity';
import { FeeItem } from '../fee/fee-item.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { MoveOutDto } from './dto/move-out.dto';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
    @InjectRepository(BillItem)
    private readonly billItemRepository: Repository<BillItem>,
    @InjectRepository(FeeItem)
    private readonly feeItemRepository: Repository<FeeItem>,
  ) {}

  /** Verify that a room belongs to a property owned by the given landlord */
  async verifyRoomOwnership(roomId: number, landlordId: number): Promise<void> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('房间不存在');
    const property = await this.propertyRepository.findOne({ where: { id: room.propertyId } });
    if (!property || property.landlordId !== landlordId) {
      throw new ForbiddenException('无权访问该房间');
    }
  }

  /** Verify that a tenant's room belongs to a property owned by the given landlord */
  async verifyTenantOwnership(tenantId: number, landlordId: number): Promise<void> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('租客不存在');
    const room = await this.roomRepository.findOne({ where: { id: tenant.roomId } });
    if (!room) throw new NotFoundException('房间不存在');
    const property = await this.propertyRepository.findOne({ where: { id: room.propertyId } });
    if (!property || property.landlordId !== landlordId) {
      throw new ForbiddenException('无权访问该租客');
    }
  }

  /**
   * Create tenant (also updates room status to rented) + auto-create first bill.
   *
   * 押X付Y 入住当天，房东应收押金 + 首期房租（覆盖入住月起 payMonths 个月）。
   * 这里自动建第一笔账单，避免入住日 ≠ rentDay 时 cron 永远等不到第一周期。
   * 如果 dto.initialPaymentMethod 有值（表示已实收），账单 status=1，paidAt=initialPaymentDate。
   */
  async create(roomId: number, dto: CreateTenantDto): Promise<Tenant> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('房间不存在');

    const existingTenant = await this.tenantRepository.findOne({
      where: { roomId, status: 1 },
    });
    if (existingTenant) {
      throw new BadRequestException('ROOM_OCCUPIED: 房间已有在租租客');
    }

    const today = new Date().toISOString().slice(0, 10);
    const moveInDate = dto.moveInDate || today;
    const payMonths = dto.payMonths ?? 1;

    const tenantData: Partial<Tenant> = {
      roomId,
      name: dto.name,
      phone: dto.phone,
      moveInDate,
      contractEndDate: dto.contractEndDate || undefined,
      rentDay: dto.rentDay ?? 10,
      payMonths,
      deposit: dto.deposit ?? undefined,
      note: dto.note ?? undefined,
      status: 1,
      initialPaymentMethod: dto.initialPaymentMethod ?? null,
      initialPaymentDate: dto.initialPaymentDate ?? null,
      initialPaymentAmount: dto.initialPaymentAmount ?? null,
      moveInReading: dto.moveInReading ?? null,
    };
    const tenant = this.tenantRepository.create(tenantData);
    const saved = await this.tenantRepository.save(tenant);

    room.status = 1;
    await this.roomRepository.save(room);

    // Auto-create first bill covering [moveInMonth .. moveInMonth + payMonths - 1].
    // Skip if a bill already exists for that period (idempotent on retries).
    await this.createFirstBill(saved, room, payMonths).catch(err => {
      this.logger.error(`createFirstBill failed for tenant ${saved.id}: ${err?.message}`, err?.stack);
    });

    return saved;
  }

  /**
   * Build the first bill for a freshly created tenant.
   * period = 入住月, periodEnd = period + payMonths - 1.
   * If initialPaymentMethod is set → status=1, paidAt=initialPaymentDate, paidAmount=totalAmount.
   */
  private async createFirstBill(
    tenant: Tenant,
    room: Room,
    payMonths: number,
  ): Promise<Bill | null> {
    const moveInDate = dayjs(tenant.moveInDate);
    const period = moveInDate.format('YYYY-MM');
    const periodEnd = moveInDate.add(payMonths - 1, 'month').format('YYYY-MM');

    // Idempotency: skip if a bill already covers this period
    const existing = await this.billRepository.findOne({
      where: { roomId: room.id, period },
    });
    if (existing) {
      return null;
    }

    const feeItems = await this.feeItemRepository.find({
      where: { roomId: room.id },
      order: { sortOrder: 'ASC' },
    });

    const items: { feeName: string; amount: number }[] = [];
    let totalAmount = 0;
    if (feeItems.length > 0) {
      for (const fee of feeItems) {
        if (!fee.enabled) continue;
        const baseAmt = Number(fee.amount) || 0;
        // Fixed items × payMonths — unless cycleMode='monthly' (e.g. 停车管理费
        // charged per-month regardless of payMonths). Manual items start at 0.
        const multiply = fee.type === 0 && fee.cycleMode !== 'monthly';
        const amt = fee.type === 0 ? (multiply ? baseAmt * payMonths : baseAmt) : 0;
        items.push({ feeName: fee.name, amount: amt });
        totalAmount += amt;
      }
    }
    if (items.length === 0) {
      const rent = Number(room.rent) || 0;
      items.push({ feeName: '房租', amount: rent * payMonths });
      totalAmount = rent * payMonths;
    }

    const isPaid = !!tenant.initialPaymentMethod;
    const billData = {
      roomId: room.id,
      tenantId: tenant.id,
      period,
      periodEnd,
      totalAmount,
      paidAmount: isPaid ? totalAmount : 0,
      status: isPaid ? 1 : 0,
      photos: [] as string[],
      sentAt: isPaid ? new Date() : (undefined as any),
      paidAt: isPaid
        ? (tenant.initialPaymentDate ? new Date(tenant.initialPaymentDate) : new Date())
        : (undefined as any),
    };
    const bill = this.billRepository.create(billData);
    const savedBill = await this.billRepository.save(bill);

    const billItems = items.map(item =>
      this.billItemRepository.create({
        billId: savedBill.id,
        feeName: item.feeName,
        amount: item.amount,
      }),
    );
    await this.billItemRepository.save(billItems);

    return savedBill;
  }

  /** Update tenant info */
  async update(id: number, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('租客不存在');
    Object.assign(tenant, dto);
    return this.tenantRepository.save(tenant);
  }

  /**
   * Move out: update tenant status + room status + optional deposit refund +
   * compute prepaid rent refund for 押X付Y tenants who leave mid-cycle.
   */
  async moveOut(id: number, dto: MoveOutDto): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('租客不存在');

    if (tenant.status !== 1) {
      throw new BadRequestException('该租客已退租');
    }

    tenant.status = 0;
    tenant.moveOutDate = dto.moveOutDate || new Date().toISOString().slice(0, 10);

    if (dto.depositStatus != null) {
      tenant.depositStatus = dto.depositStatus;
      if (dto.depositRefundAmount != null) {
        tenant.depositRefundAmount = dto.depositRefundAmount;
      }
      if (dto.depositDeductReason != null) {
        tenant.depositDeductReason = dto.depositDeductReason;
      }
    }

    if (dto.moveOutReading != null) {
      tenant.moveOutReading = dto.moveOutReading;
    }

    // Prepaid rent refund: prefer frontend-provided value, otherwise auto-compute.
    if (dto.prepaidRefundAmount != null) {
      tenant.prepaidRefundAmount = dto.prepaidRefundAmount;
    } else {
      const computed = await this.computePrepaidRefund(tenant);
      tenant.prepaidRefundAmount = computed;
    }

    const saved = await this.tenantRepository.save(tenant);

    // P1: Cancel pending/partial/overdue bills so they don't keep催收. status=4
    // means "退租作废". Paid bills (status=1) are kept for history.
    await this.billRepository
      .createQueryBuilder()
      .update(Bill)
      .set({ status: 4 })
      .where('tenant_id = :tid', { tid: saved.id })
      .andWhere('status IN (:...statuses)', { statuses: [0, 2, 3] })
      .execute();

    const room = await this.roomRepository.findOne({ where: { id: tenant.roomId } });
    if (room) {
      room.status = 0;
      await this.roomRepository.save(room);
    }

    return saved;
  }

  /**
   * Compute prepaid rent refund for early move-out.
   *
   * Algorithm: find the latest paid (status=1) bill for this tenant, look at
   * its [period..periodEnd] cycle (the months of prepayment). The refund covers
   * TWO classes of days that the tenant paid for but didn't actually use:
   *
   *   1. overpaidBeforeMoveIn — days between period start and moveInDate when
   *      the tenant moved in mid-month but the bill charged for the whole month.
   *      E.g. moveIn=4/15, period='2026-04' → landlord charged 4/1-4/14 unfairly.
   *
   *   2. unusedAfterMoveOut — days between moveOutDate and end of periodEnd
   *      month (the original logic; covers early move-out at the tail).
   *
   * Refund = (overpaidBeforeMoveIn + unusedAfterMoveOut) × (monthly rent / 30).
   *
   * Returns 0 if no paid bill exists, or moveOutDate is at/after end of
   * periodEnd month AND moveInDate was on/before period start.
   */
  async computePrepaidRefund(tenant: Tenant): Promise<number> {
    if (!tenant.moveOutDate) return 0;

    const latestPaidBill = await this.billRepository.findOne({
      where: { tenantId: tenant.id, status: 1 },
      order: { periodEnd: 'DESC' },
    });
    if (!latestPaidBill) return 0;

    // Use periodEnd if set, else period (legacy single-month bills)
    const effectivePeriodEnd = latestPaidBill.periodEnd || latestPaidBill.period;
    const periodStart = dayjs(latestPaidBill.period + '-01').startOf('day');
    const periodEndDate = dayjs(effectivePeriodEnd + '-01').endOf('month');

    const moveOutDay = dayjs(tenant.moveOutDate);
    const moveInDay = tenant.moveInDate ? dayjs(tenant.moveInDate) : null;

    // Days charged for but tenant hadn't moved in yet (move-in was mid-cycle)
    const overpaidBeforeMoveIn =
      moveInDay && moveInDay.isAfter(periodStart)
        ? moveInDay.diff(periodStart, 'day')
        : 0;

    // Days charged for but tenant has already moved out (tail of cycle)
    const unusedAfterMoveOut = Math.max(0, periodEndDate.diff(moveOutDay, 'day'));

    const totalUnusedDays = overpaidBeforeMoveIn + unusedAfterMoveOut;
    if (totalUnusedDays <= 0) return 0;

    const room = await this.roomRepository.findOne({ where: { id: tenant.roomId } });
    if (!room) return 0;
    const monthlyRent = Number(room.rent) || 0;
    if (monthlyRent <= 0) return 0;

    // Standard landlord convention: 日租金 = 月租 / 30 (not / 实际天数)
    const dailyRate = monthlyRent / 30;
    const refund = Math.round(dailyRate * totalUnusedDays * 100) / 100;
    return Math.max(0, refund);
  }

  /** Get tenant detail */
  async findOne(id: number): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { id },
      relations: ['room', 'room.property'],
    });
    if (!tenant) throw new NotFoundException('租客不存在');
    return tenant;
  }
}
