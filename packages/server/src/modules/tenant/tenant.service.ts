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
import { FeeRule, feeRuleAmountForMonths, feeRuleBillingMonths, feeRuleDueMonths, feeRuleInitialAmount, feeRuleInitialMonths, feeRulesToResponse, normalizeFeeRules, normalizeUpdatedFeeRules, resolveFeeRules } from '../fee/fee-rules';
import { retryMalformedMysqlPacket } from '../../common/database/mysql-retry';
import { createHash } from 'crypto';

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
      if (room.status === 2) throw new BadRequestException('请先让这个房间重新显示，再登记租客');

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
    const recordedAmount = tenant.initialPaymentAmount != null
      ? Math.min(Math.max(0, explicitAmount), totalAmount)
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

  private async buildFeePreview(tenant: Tenant, dto: UpdateTenantDto) {
    const room = await this.roomRepository.findOneByOrFail({ id: tenant.roomId });
    const legacyFees = await this.feeItemRepository.findBy({ roomId: tenant.roomId });
    const previous = resolveFeeRules(tenant.feeRules, legacyFees, Number(room.rent) || 0);
    const payMonths = dto.payMonths ?? tenant.payMonths;
    let next = dto.feeItems !== undefined
      ? normalizeUpdatedFeeRules(dto.feeItems, previous, tenant.payMonths)
      : previous.map(rule => ({ ...rule,
          ...(rule.collectionTiming !== 'arrears' ? { initialMonths: feeRuleInitialMonths(rule, tenant.payMonths) } : {}),
          ...(rule.isRent && dto.payMonths != null ? { billingMonths: payMonths } : {}),
        }));
    const bills = await this.billRepository.find({ where: { tenantId: tenant.id }, relations: ['items'] });
    const current = dayjs().format('YYYY-MM');
    next = next.map(rule => {
      const old = previous.find(item => rule.isRent ? !!item.isRent : !item.isRent && item.name === rule.name);
      const changed = !old || Number(old.amount) !== Number(rule.amount) || old.enabled !== rule.enabled
        || old.type !== rule.type || old.collectionTiming !== rule.collectionTiming
        || feeRuleBillingMonths(old, tenant.payMonths) !== feeRuleBillingMonths(rule, payMonths);
      if (!changed) return { ...rule, effectivePeriod: old?.effectivePeriod };
      let effective = current;
      if (rule.isRent) {
        for (const bill of bills) {
          const covered = bill.periodEnd || bill.period;
          if (covered >= effective) effective = dayjs(`${covered}-01`).add(1, 'month').format('YYYY-MM');
        }
      } else {
        while (bills.some(b => b.period === effective && b.items?.some(item => item.feeName === (old?.name || rule.name)))) {
          effective = dayjs(`${effective}-01`).add(1, 'month').format('YYYY-MM');
        }
      }
      return { ...rule, effectivePeriod: effective };
    });
    const rows = next.filter(rule => rule.enabled).map(rule => {
      let period = rule.effectivePeriod || current;
      for (let i = 0; i < 120 && feeRuleDueMonths(rule, payMonths, tenant.moveInDate, period) === 0; i++) {
        period = dayjs(`${period}-01`).add(1, 'month').format('YYYY-MM');
      }
      const months = feeRuleDueMonths(rule, payMonths, tenant.moveInDate, period);
      return { name: rule.name, period, dueDate: dueDateString(period, dto.rentDay ?? tenant.rentDay),
        amount: feeRuleAmountForMonths(rule, months), manual: rule.type === 1 };
    });
    const token = createHash('sha256').update(JSON.stringify({ next, rows,
      bills: bills.map(b => [b.id, b.period, b.periodEnd, b.updatedAt]) })).digest('hex');
    return { rules: next, rows, token };
  }

  async previewFees(id: number, dto: UpdateTenantDto) {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('租客不存在');
    const { rows, token } = await this.buildFeePreview(tenant, dto);
    return { rows, token };
  }

  /** Update tenant info */
  async update(id: number, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('租客不存在');
    const { feeItems, feePreviewToken, ...tenantFields } = dto;
    const preview = (feeItems !== undefined || dto.payMonths !== undefined)
      ? await this.buildFeePreview(tenant, dto) : null;
    if (preview && feePreviewToken && feePreviewToken !== preview.token) {
      throw new BadRequestException('保存前账单发生了变化，请返回后重新打开，再保存一次');
    }
    if (feeItems !== undefined) {
      const room = await this.roomRepository.findOneByOrFail({ id: tenant.roomId });
      const legacyFees = await this.feeItemRepository.findBy({ roomId: tenant.roomId });
      const previous = resolveFeeRules(tenant.feeRules, legacyFees, Number(room.rent) || 0);
      tenant.feeRules = preview!.rules;
    }
    if (feeItems === undefined && dto.payMonths != null && dto.payMonths !== tenant.payMonths) {
      const room = await this.roomRepository.findOneByOrFail({ id: tenant.roomId });
      const legacyFees = await this.feeItemRepository.findBy({ roomId: tenant.roomId });
      tenant.feeRules = preview!.rules;
    }
    Object.assign(tenant, tenantFields);
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

      // Moving out ends the tenancy, not the landlord's receivable.
      if (dto.debtAction === 'waive') {
        if (!dto.debtReason?.trim()) throw new BadRequestException('减免欠款请填写原因');
        const outstanding = await manager.getRepository(Bill).findBy({ tenantId: saved.id });
        const waived = outstanding.filter(b => [0, 2, 3].includes(b.status))
          .reduce((sum, b) => sum + Math.max(0, Number(b.totalAmount) - Number(b.paidAmount)), 0);
        await manager.save(manager.create(RentRecord, { roomId: saved.roomId, type: 8,
          title: '退租欠款减免', description: `${saved.name}：减免${waived.toFixed(2)}元；${dto.debtReason.trim()}`,
          amount: 0, paymentAt: new Date() }));
        await manager.getRepository(Bill)
        .createQueryBuilder()
        .update(Bill)
        .set({ status: 4 })
        .where('tenant_id = :tid', { tid: saved.id })
        .andWhere('status IN (:...statuses)', { statuses: [0, 2, 3] })
        .execute();
      }

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
   * Refund unearned rent receipts across the tenant's paid/partial bills.
   * Partial receipts pay rent first (up to that bill's rent charge). Occupied
   * rent is earned before any refund; unpaid rent is never refundable cash.
   * Preserve the existing monthly-rent / 30 convention for unused days and
   * treat move-out day as the first refundable day.
   */
  async computePrepaidRefund(tenant: Tenant, manager?: EntityManager): Promise<number> {
    if (!tenant.moveOutDate) return 0;

    const billRepository = manager?.getRepository(Bill) || this.billRepository;
    const roomRepository = manager?.getRepository(Room) || this.roomRepository;
    const paidBills = await billRepository
      .createQueryBuilder('bill')
      .leftJoinAndSelect('bill.items', 'items')
      .where('bill.tenant_id = :tenantId', { tenantId: tenant.id })
      .andWhere('bill.status IN (:...statuses)', { statuses: [1, 2, 3] })
      .andWhere('bill.paid_amount > 0')
      .orderBy('COALESCE(bill.period_end, bill.period)', 'DESC')
      .getMany();
    const room = await roomRepository.findOne({ where: { id: tenant.roomId } });
    if (!room) return 0;
    const moveOutDay = dayjs(tenant.moveOutDate).startOf('day');
    const moveInDay = dayjs(tenant.moveInDate).startOf('day');
    const rentNames = new Set(['房租', ...(tenant.feeRules || []).filter(rule => rule.isRent).map(rule => rule.name)]);
    let refundCents = 0;
    for (const bill of paidBills) {
      const periodStart = dayjs(bill.period + '-01').startOf('day');
      const endMonth = dayjs((bill.periodEnd || bill.period) + '-01');
      const periodEnd = endMonth.add(1, 'month').startOf('month');
      const coverageMonths = Math.max(1, endMonth.diff(periodStart, 'month') + 1);
      const rentItems = (bill.items || []).filter(item => rentNames.has(item.feeName));
      // A populated snapshot without rent is a utility/other-fee bill. Only
      // truly legacy bills lacking all items may use the room rent fallback.
      const rentTotal = rentItems.length
        ? rentItems.reduce((sum, item) => sum + Number(item.amount), 0)
        : (bill.items?.length ? 0 : (Number(room.rent) || 0) * coverageMonths);
      if (rentTotal <= 0) continue;

      const totalDays = periodEnd.diff(periodStart, 'day');
      const beforeMoveIn = Math.max(0, Math.min(totalDays, moveInDay.diff(periodStart, 'day')));
      const afterMoveOut = Math.max(0, Math.min(totalDays, periodEnd.diff(moveOutDay, 'day')));
      const unusedDays = Math.min(totalDays, beforeMoveIn + afterMoveOut);
      const rentCents = Math.round(rentTotal * 100);
      const unusedCents = Math.min(rentCents, Math.round((rentTotal / coverageMonths / 30) * unusedDays * 100));
      const earnedCents = rentCents - unusedCents;
      const receivedRentCents = Math.min(rentCents, Math.round(Number(bill.paidAmount) * 100));
      refundCents += Math.max(0, receivedRentCents - earnedCents);
    }
    return refundCents / 100;
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
