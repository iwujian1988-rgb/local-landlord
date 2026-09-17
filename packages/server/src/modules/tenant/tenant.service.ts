import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import dayjs from 'dayjs';
import { Tenant } from './tenant.entity';
import { Room } from '../room/room.entity';
import { Property } from '../property/property.entity';
import { Bill } from '../bill/bill.entity';
import { BillItem } from '../bill/bill-item.entity';
import { dueDateString } from '../bill/bill-due-date';
import { FeeItem } from '../fee/fee-item.entity';
import { RentRecord } from '../rent/rent-record.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { MoveOutDto } from './dto/move-out.dto';
import { FeeRule, feeRuleInitialAmount, feeRuleInitialMonths, feeRulesToResponse, normalizeFeeRules, resolveFeeRules } from '../fee/fee-rules';
import { retryMalformedMysqlPacket } from '../../common/database/mysql-retry';

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
    @InjectRepository(RentRecord)
    private readonly rentRecordRepository: Repository<RentRecord>,
    private readonly dataSource: DataSource,
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
    return this.dataSource.transaction(async manager => {
      const roomQuery = manager.getRepository(Room)
        .createQueryBuilder('room')
        .where('room.id = :roomId', { roomId });
      // Serialize registrations for the same room in production MySQL. SQL.js
      // used by tests has no pessimistic-lock support.
      if (this.dataSource.options.type === 'mysql') roomQuery.setLock('pessimistic_write');
      const room = await roomQuery.getOne();
      if (!room) throw new NotFoundException('房间不存在');

      const tenantRepo = manager.getRepository(Tenant);
      const existingTenant = await tenantRepo.findOne({ where: { roomId, status: 1 } });
      if (existingTenant) throw new BadRequestException('ROOM_OCCUPIED: 房间已有在租租客');

      const legacyFeeItems = await manager.getRepository(FeeItem).find({
        where: { roomId },
        order: { sortOrder: 'ASC' },
      });
      const feeRules = dto.feeItems !== undefined
        ? normalizeFeeRules(dto.feeItems)
        : resolveFeeRules(null, legacyFeeItems, Number(room.rent) || 0);
      const today = new Date().toISOString().slice(0, 10);
      const moveInDate = dto.moveInDate || today;
      const payMonths = dto.payMonths ?? 1;
      const tenant = tenantRepo.create({
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
        initialDepositAmount: dto.initialDepositAmount ?? null,
        moveInReading: dto.moveInReading ?? null,
        feeRules,
      });
      const saved = await tenantRepo.save(tenant);

      room.status = 1;
      await manager.getRepository(Room).save(room);
      await this.createFirstBill(manager, saved, room, payMonths, feeRules);
      return saved;
    });
  }

  /**
   * Build the first bill for a freshly created tenant.
   * period = 入住月, periodEnd = period + payMonths - 1.
   * If initialPaymentMethod is set → status=1, paidAt=initialPaymentDate, paidAmount=totalAmount.
   */
  private async createFirstBill(
    manager: EntityManager,
    tenant: Tenant,
    room: Room,
    payMonths: number,
    feeRules: FeeRule[],
  ): Promise<Bill | null> {
    const moveInDate = dayjs(tenant.moveInDate);
    const period = moveInDate.format('YYYY-MM');
    let periodEnd = period;

    // Idempotency: skip if a bill already covers this period
    const billRepo = manager.getRepository(Bill);
    const existing = await billRepo.findOne({
      where: { tenantId: tenant.id, period },
    });
    if (existing) {
      return null;
    }

    const items: { feeName: string; amount: number }[] = [];
    let totalAmount = 0;
    if (feeRules.length > 0) {
      for (const fee of feeRules) {
        if (!fee.enabled) continue;
        const months = feeRuleInitialMonths(fee, payMonths);
        if (months === 0) continue;
        const amt = feeRuleInitialAmount(fee, payMonths);
        items.push({ feeName: fee.name, amount: amt });
        totalAmount += amt;
        if (fee.isRent) periodEnd = moveInDate.add(months - 1, 'month').format('YYYY-MM');
      }
    }
    if (items.length === 0) {
      const rent = Number(room.rent) || 0;
      items.push({ feeName: '房租', amount: rent * payMonths });
      totalAmount = rent * payMonths;
    }

    // Frontend normally sends method + actual amount together. Keep method-only
    // clients backward compatible, while correctly representing a smaller
    // recorded amount as partial instead of falsely marking the full bill paid.
    const explicitAmount = Number(tenant.initialPaymentAmount) || 0;
    const recordedAmount = explicitAmount > 0
      ? Math.min(explicitAmount, totalAmount)
      : (tenant.initialPaymentMethod && tenant.initialDepositAmount == null ? totalAmount : 0);
    const paymentStatus = recordedAmount >= totalAmount && totalAmount > 0
      ? 1
      : (recordedAmount > 0 ? 3 : 0);
    const hasPayment = paymentStatus === 1 || paymentStatus === 3;
    const billData = {
      roomId: room.id,
      tenantId: tenant.id,
      period,
      periodEnd,
      dueDate: dueDateString(period, tenant.rentDay),
      totalAmount,
      paidAmount: recordedAmount,
      status: paymentStatus,
      photos: [] as string[],
      sentAt: hasPayment ? new Date() : (undefined as any),
      paidAt: hasPayment
        ? (tenant.initialPaymentDate ? new Date(tenant.initialPaymentDate) : new Date())
        : (undefined as any),
    };
    const bill = billRepo.create(billData);
    const savedBill = await billRepo.save(bill);

    const billItems = items.map(item =>
      manager.getRepository(BillItem).create({
        billId: savedBill.id,
        feeName: item.feeName,
        amount: item.amount,
      }),
    );
    await manager.getRepository(BillItem).save(billItems);

    if (hasPayment) {
      const methodLabels: Record<string, string> = {
        cash: '现金', wechat: '微信', alipay: '支付宝', bank: '银行转账',
      };
      const methodLabel = tenant.initialPaymentMethod
        ? (methodLabels[tenant.initialPaymentMethod] || tenant.initialPaymentMethod)
        : '未填写方式';
      const rentRecord = manager.getRepository(RentRecord).create({
        roomId: room.id,
        billId: savedBill.id,
        type: 1,
        title: paymentStatus === 1 ? '入住首期账单已收' : '入住首期账单部分付款',
        description: `${methodLabel} · ${tenant.initialPaymentDate || '入住时'}实收`,
        amount: recordedAmount,
        paymentAt: tenant.initialPaymentDate ? new Date(tenant.initialPaymentDate) : new Date(),
      });
      await manager.getRepository(RentRecord).save(rentRecord);
    }

    const depositReceived = Math.min(
      Math.max(0, Number(tenant.initialDepositAmount) || 0),
      Math.max(0, Number(tenant.deposit) || 0),
    );
    if (depositReceived > 0) {
      const depositRecord = manager.getRepository(RentRecord).create({
        roomId: room.id,
        billId: null,
        type: 5,
        title: '入住押金已收',
        description: `${tenant.initialPaymentDate || '入住时'}收取；押金不计入租金收入`,
        amount: depositReceived,
        paymentAt: tenant.initialPaymentDate ? new Date(tenant.initialPaymentDate) : new Date(),
      });
      await manager.getRepository(RentRecord).save(depositRecord);
    }

    return savedBill;
  }

  /** Update tenant info */
  async update(id: number, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('租客不存在');
    const { feeItems, ...tenantFields } = dto;
    Object.assign(tenant, tenantFields);
    if (feeItems !== undefined) tenant.feeRules = normalizeFeeRules(feeItems);
    return retryMalformedMysqlPacket(
      () => this.tenantRepository.save(tenant),
      () => this.logger.warn(`Retrying idempotent tenant update ${id} after malformed MySQL packet`),
    );
  }

  /**
   * Move out: update tenant status + room status + optional deposit refund +
   * compute prepaid rent refund for 押X付Y tenants who leave mid-cycle.
   */
  async moveOut(id: number, dto: MoveOutDto): Promise<Tenant> {
    return this.dataSource.transaction(async manager => {
      const tenantQuery = manager.getRepository(Tenant)
        .createQueryBuilder('tenant')
        .where('tenant.id = :id', { id });
      if (manager.connection.options.type === 'mysql') tenantQuery.setLock('pessimistic_write');
      const tenant = await tenantQuery.getOne();
      if (!tenant) throw new NotFoundException('租客不存在');
      if (tenant.status !== 1) throw new BadRequestException('该租客已退租');

      tenant.status = 0;
      tenant.moveOutDate = dto.moveOutDate || new Date().toISOString().slice(0, 10);

      if (dto.depositStatus != null) {
        tenant.depositStatus = dto.depositStatus;
        if (dto.depositRefundAmount != null) tenant.depositRefundAmount = dto.depositRefundAmount;
        if (dto.depositDeductReason != null) tenant.depositDeductReason = dto.depositDeductReason;
      }
      if (dto.moveOutReading != null) tenant.moveOutReading = dto.moveOutReading;

      tenant.prepaidRefundAmount = dto.prepaidRefundAmount != null
        ? dto.prepaidRefundAmount
        : await this.computePrepaidRefund(tenant, manager);

      const saved = await manager.getRepository(Tenant).save(tenant);

      // Close the remaining receivable. Actual cash already collected is kept
      // in rent_record and therefore remains visible in cash reports.
      await manager.getRepository(Bill)
        .createQueryBuilder()
        .update(Bill)
        .set({ status: 4 })
        .where('tenant_id = :tid', { tid: saved.id })
        .andWhere('status IN (:...statuses)', { statuses: [0, 2, 3] })
        .execute();

      const room = await manager.findOne(Room, { where: { id: tenant.roomId } });
      if (room) {
        room.status = 0;
        await manager.save(room);
      }

      const prepaidRefund = Number(saved.prepaidRefundAmount) || 0;
      if (prepaidRefund > 0) {
        await manager.save(manager.create(RentRecord, {
          roomId: saved.roomId,
          billId: null,
          type: 6,
          title: '退租预付租金退款',
          description: '退租时退还未使用的预付租金',
          amount: -prepaidRefund,
          paymentAt: new Date(),
        }));
      }

      return saved;
    });
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
  async computePrepaidRefund(tenant: Tenant, manager?: EntityManager): Promise<number> {
    if (!tenant.moveOutDate) return 0;

    const billRepository = manager?.getRepository(Bill) || this.billRepository;
    const roomRepository = manager?.getRepository(Room) || this.roomRepository;
    const latestPaidBill = await billRepository
      .createQueryBuilder('bill')
      .leftJoinAndSelect('bill.items', 'items')
      .where('bill.tenant_id = :tenantId', { tenantId: tenant.id })
      .andWhere('bill.status IN (:...statuses)', { statuses: [1, 3] })
      .andWhere('bill.paid_amount > 0')
      .orderBy('COALESCE(bill.period_end, bill.period)', 'DESC')
      .getOne();
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
    // The recorded move-out date is the first non-occupied/refundable day.
    const unusedAfterMoveOut = moveOutDay.isAfter(periodEndDate)
      ? 0
      : Math.max(0, periodEndDate.diff(moveOutDay, 'day') + 1);

    const totalUnusedDays = overpaidBeforeMoveIn + unusedAfterMoveOut;
    if (totalUnusedDays <= 0) return 0;

    const room = await roomRepository.findOne({ where: { id: tenant.roomId } });
    if (!room) return 0;
    const coverageMonths = Math.max(
      1,
      (dayjs(effectivePeriodEnd + '-01').year() - dayjs(latestPaidBill.period + '-01').year()) * 12
        + dayjs(effectivePeriodEnd + '-01').month() - dayjs(latestPaidBill.period + '-01').month() + 1,
    );
    const historicalRentItem = latestPaidBill.items?.find(item => item.feeName === '房租');
    const monthlyRent = historicalRentItem
      ? Number(historicalRentItem.amount) / coverageMonths
      : Number(room.rent) || 0;
    if (monthlyRent <= 0) return 0;

    // Standard landlord convention: 日租金 = 月租 / 30 (not / 实际天数)
    const dailyRate = monthlyRent / 30;
    const refund = Math.round(dailyRate * totalUnusedDays * 100) / 100;
    return Math.max(0, Math.min(refund, Number(latestPaidBill.paidAmount) || 0));
  }

  /** Get tenant detail */
  async findOne(id: number): Promise<any> {
    const tenant = await this.tenantRepository.findOne({
      where: { id },
      relations: ['room', 'room.property'],
    });
    if (!tenant) throw new NotFoundException('租客不存在');
    const legacyFeeItems = await this.feeItemRepository.find({
      where: { roomId: tenant.roomId },
      order: { sortOrder: 'ASC' },
    });
    const rules = resolveFeeRules(tenant.feeRules, legacyFeeItems, Number(tenant.room?.rent) || 0);
    return { ...tenant, feeItems: feeRulesToResponse(rules) };
  }
}
