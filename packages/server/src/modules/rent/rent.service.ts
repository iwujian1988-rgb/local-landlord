import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import dayjs from 'dayjs';
import { SingleCharge } from './single-charge.entity';
import { RentRecord } from './rent-record.entity';
import { Room } from '../room/room.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Bill } from '../bill/bill.entity';
import { Property } from '../property/property.entity';
import { CreateSingleChargeDto } from './dto/create-single-charge.dto';
import { RemindTenantDto } from './dto/remind-tenant.dto';
import { FeeItem } from '../fee/fee-item.entity';
import { feeRuleAmountForMonths, feeRuleDueMonths, resolveFeeRules } from '../fee/fee-rules';

const RECORD_TYPE_MAP: Record<number, string> = {
  0: 'bill_sent', 1: 'bill_paid', 2: 'single_charge', 3: 'single_paid', 4: 'reminder', 5: 'deposit_paid',
};

const DOT_COLOR_MAP: Record<number, string> = {
  0: 'accent', 1: 'green', 2: 'orange', 3: 'green', 4: 'accent',
};

export interface PendingEntry {
  roomId: number;
  roomName: string;
  propertyName: string;
  propertyId: number;
  rent: number;
  tenantName: string;
  tenantId: number | null;
  contractEndDate: string;
  rentDay: number;
  payMonths: number;
  billId: number | null;
  billStatus: number;
  billPeriod: string | null;
  billPeriodEnd: string | null;
  totalAmount: number;
  paidAmount: number;
  overdueDays: number;
  daysUntil: number;
  hasOverdue: boolean;
  // When current month is NOT a due-month (押X付Y cycle off), this is the
  // next month where rent should be collected. Format: 'YYYY-MM'.
  nextDueMonth: string | null;
}

export interface PendingRentGroup {
  today: PendingEntry[];
  approaching: PendingEntry[];
  overdue: PendingEntry[];
  completed: PendingEntry[];
  // Tenants whose payMonths cycle means no rent is due this month.
  upcoming: PendingEntry[];
}

export interface BillListEntry {
  billId: number;
  roomId: number;
  roomName: string;
  propertyName: string;
  tenantId: number | null;
  tenantName: string;
  period: string;
  periodEnd: string | null;
  totalAmount: number;
  paidAmount: number;
  status: number;
  paidAt: string | null;
  createdAt: string;
}

export interface SingleChargeListEntry {
  id: number;
  roomId: number;
  roomName: string;
  propertyName: string;
  tenantName: string;
  feeType: string;
  amount: number;
  note: string;
  status: number;
  paidAt: string | null;
  createdAt: string;
}

export interface AllBillsResponse {
  period: string;
  bills: BillListEntry[];
  singleCharges: SingleChargeListEntry[];
}

@Injectable()
export class RentService {
  constructor(
    @InjectRepository(SingleCharge)
    private readonly singleChargeRepository: Repository<SingleCharge>,
    @InjectRepository(RentRecord)
    private readonly rentRecordRepository: Repository<RentRecord>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(FeeItem)
    private readonly feeItemRepository: Repository<FeeItem>,
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

  /** Verify single_charge belongs to landlord (via room → property chain) */
  async verifySingleChargeOwnership(singleChargeId: number, landlordId: number): Promise<void> {
    const charge = await this.singleChargeRepository.findOne({ where: { id: singleChargeId } });
    if (!charge) throw new NotFoundException('收款记录不存在');
    await this.verifyRoomOwnership(charge.roomId, landlordId);
  }

  /**
   * Pending rent list: grouped by today/approaching/overdue/completed/upcoming
   * Bucket rules:
   *   today       — current month is a due-month, today == rentDay, current bill unpaid
   *   approaching — current month is a due-month, rentDay - today ∈ [1, 3], current bill unpaid
   *   overdue     — current month is a due-month, today > rentDay (bill unpaid) OR has prior-period unpaid bills
   *   completed   — current bill (covering this month) paid
   *   upcoming    — current month is NOT a due-month (押X付Y cycle off), show next due month
   */
  async getPendingRent(landlordId: number): Promise<PendingRentGroup> {
    const properties = await this.propertyRepository.find({ where: { landlordId } });
    if (properties.length === 0) {
      return { today: [], approaching: [], overdue: [], completed: [], upcoming: [] };
    }
    const propertyMap = new Map<number, Property>();
    for (const p of properties) propertyMap.set(p.id, p);

    const propertyIds = properties.map(p => p.id);
    const rentedRooms = await this.roomRepository.find({
      where: { propertyId: In(propertyIds), status: 1 },
    });
    if (rentedRooms.length === 0) {
      return { today: [], approaching: [], overdue: [], completed: [], upcoming: [] };
    }

    const roomIds = rentedRooms.map(r => r.id);

    const allTenants = await this.tenantRepository.find({
      where: { roomId: In(roomIds), status: 1 },
    });
    const tenantMap = new Map<number, Tenant>();
    for (const t of allTenants) tenantMap.set(t.roomId, t);
    const activeTenantIds = allTenants.map(t => t.id);
    const legacyFeeItems = await this.feeItemRepository.find({ where: { roomId: In(roomIds) } });
    const legacyFeeMap = new Map<number, FeeItem[]>();
    for (const fee of legacyFeeItems) {
      const list = legacyFeeMap.get(fee.roomId) || [];
      list.push(fee);
      legacyFeeMap.set(fee.roomId, list);
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const todayDate = now.getDate();
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // A bill is a collection event; prepaid coverage is not another bill.
    const coveringBills = activeTenantIds.length > 0
      ? await this.billRepository
          .createQueryBuilder('bill')
          .where('bill.room_id IN (:...roomIds)', { roomIds })
          .andWhere('bill.tenant_id IN (:...tenantIds)', { tenantIds: activeTenantIds })
          .andWhere('bill.status != :cancelled', { cancelled: 4 })
          .andWhere('bill.period = :monthStr', { monthStr })
          .getMany()
      : [];
    const currentBillMap = new Map<number, Bill>();
    for (const b of coveringBills) currentBillMap.set(b.roomId, b);

    // For prior-overdue detection: any unpaid bill whose coverage window ended before this month.
    const unpaidBills = activeTenantIds.length > 0
      ? await this.billRepository.find({
          where: {
            roomId: In(roomIds),
            tenantId: In(activeTenantIds),
            status: In([0, 2, 3]),
          },
        })
      : [];
    const priorOverdueMap = new Map<number, boolean>();
    for (const b of unpaidBills) {
      if (b.period < monthStr) priorOverdueMap.set(b.roomId, true);
    }

    const todayList: PendingEntry[] = [];
    const approachingList: PendingEntry[] = [];
    const overdueList: PendingEntry[] = [];
    const completedList: PendingEntry[] = [];
    const upcomingList: PendingEntry[] = [];

    for (const room of rentedRooms) {
      const tenant = tenantMap.get(room.id) || null;
      const bill = currentBillMap.get(room.id) || null;
      const prop = propertyMap.get(room.propertyId);
      const rentDay = tenant?.rentDay ?? 10;
      const dueDay = rentDay === 0 ? lastDayOfMonth : Math.min(rentDay, lastDayOfMonth);
      const payMonths = tenant?.payMonths ?? 1;
      const hasPriorOverdue = priorOverdueMap.get(room.id) || false;
      const resolvedRules = resolveFeeRules(
        tenant?.feeRules,
        legacyFeeMap.get(room.id) || [],
        Number(room.rent) || 0,
      );
      const estimatedTotal = tenant
        ? resolvedRules.reduce((sum, rule) => {
            const months = feeRuleDueMonths(rule, payMonths, tenant.moveInDate, monthStr);
            return sum + feeRuleAmountForMonths(rule, months);
          }, 0)
        : 0;

      // Cycle check: is current month a due-month?
      let isDueMonth = estimatedTotal > 0 || resolvedRules.some(rule =>
        tenant ? feeRuleDueMonths(rule, payMonths, tenant.moveInDate, monthStr) > 0 : false,
      );
      let nextDueMonth: string | null = null;
      if (tenant && !isDueMonth) {
        for (let ahead = 1; ahead <= 12; ahead++) {
          const candidate = dayjs(monthStr + '-01').add(ahead, 'month').format('YYYY-MM');
          if (resolvedRules.some(rule => feeRuleDueMonths(rule, payMonths, tenant.moveInDate, candidate) > 0)) {
            nextDueMonth = candidate;
            break;
          }
        }
      }

      let overdueDays = 0;
      if (todayDate > dueDay) overdueDays = todayDate - dueDay;

      let daysUntil = 0;
      if (todayDate < dueDay) daysUntil = dueDay - todayDate;

      const entry: PendingEntry = {
        roomId: room.id,
        roomName: room.name,
        propertyName: prop?.name || '',
        propertyId: room.propertyId,
        rent: Number(room.rent) || 0,
        tenantName: tenant?.name || '',
        tenantId: tenant?.id || null,
        contractEndDate: tenant?.contractEndDate || '',
        rentDay,
        payMonths,
        billId: bill?.id || null,
        billStatus: bill?.status ?? 0,
        billPeriod: bill?.period || null,
        billPeriodEnd: bill?.periodEnd || null,
        totalAmount: Number(bill?.totalAmount) || estimatedTotal,
        paidAmount: Number(bill?.paidAmount) || 0,
        overdueDays,
        daysUntil,
        hasOverdue: hasPriorOverdue,
        nextDueMonth,
      };

      // Paid bills always show in completed, regardless of cycle.
      if (bill && bill.status === 1) {
        completedList.push(entry);
        continue;
      }

      // Prior overdue always shows in overdue (e.g., last cycle's unpaid bill).
      if (hasPriorOverdue) {
        overdueList.push(entry);
        continue;
      }

      // If current month is not a due-month, this tenant goes to "upcoming".
      if (!isDueMonth) {
        upcomingList.push(entry);
        continue;
      }

      // Otherwise bucket by today vs rentDay as before.
      if (todayDate > dueDay) {
        overdueList.push(entry);
      } else if (todayDate === dueDay) {
        todayList.push(entry);
      } else if (daysUntil >= 1 && daysUntil <= 3) {
        approachingList.push(entry);
      } else if (daysUntil > 3) {
        // It is not urgent yet, but it is still this month's receivable.
        // Keep it visible instead of making the rent homepage report zero
        // while the statistics page already reports an outstanding balance.
        upcomingList.push(entry);
      }
    }

    return {
      today: todayList,
      approaching: approachingList,
      overdue: overdueList,
      completed: completedList,
      upcoming: upcomingList,
    };
  }

  /**
   * All bills of a month for the landlord — every status, every room (vacant
   * rooms included, so bills of moved-out tenants stay auditable) — plus the
   * month's single charges (water/electric/repair etc.). Mirrors the stats V2
   * accounting so the numbers on this list always add up to the summary card:
   * bills by start-period == month, singles by created(pending)/paid(confirmed) date.
   */
  async getAllBills(landlordId: number, period?: string): Promise<AllBillsResponse> {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthStr = /^\d{4}-\d{2}$/.test(period || '')
      ? (period as string)
      : currentMonthStr;
    const [year, month] = monthStr.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    const properties = await this.propertyRepository.find({ where: { landlordId } });
    if (properties.length === 0) {
      return { period: monthStr, bills: [], singleCharges: [] };
    }
    const propertyMap = new Map<number, Property>();
    for (const p of properties) propertyMap.set(p.id, p);

    const rooms = await this.roomRepository.find({
      where: { propertyId: In(properties.map(p => p.id)) },
    });
    if (rooms.length === 0) {
      return { period: monthStr, bills: [], singleCharges: [] };
    }
    const roomMap = new Map<number, Room>();
    for (const r of rooms) roomMap.set(r.id, r);
    const roomIds = rooms.map(r => r.id);

    const bills = await this.billRepository.find({
      where: { roomId: In(roomIds), period: monthStr },
      order: { createdAt: 'DESC' },
    });

    // Bind dates as 'YYYY-MM-DD HH:mm:ss' strings: MySQL takes them natively,
    // and sqlite's driver binds Date objects as epoch numbers which silently
    // break the string comparison against stored datetime text.
    const sqlDateTime = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ` +
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    const singles = await this.singleChargeRepository
      .createQueryBuilder('sc')
      .where('sc.room_id IN (:...ids)', { ids: roomIds })
      .andWhere(
        '((sc.status = 0 AND sc.created_at >= :start AND sc.created_at < :end) ' +
        'OR (sc.status = 1 AND sc.paid_at >= :start AND sc.paid_at < :end))',
        { start: sqlDateTime(monthStart), end: sqlDateTime(monthEnd) },
      )
      .orderBy('sc.created_at', 'DESC')
      .getMany();

    const tenantIds = new Set<number>();
    for (const b of bills) if (b.tenantId) tenantIds.add(b.tenantId);
    for (const s of singles) if (s.tenantId) tenantIds.add(s.tenantId);
    const tenantNameMap = new Map<number, string>();
    if (tenantIds.size > 0) {
      const tenants = await this.tenantRepository.find({ where: { id: In([...tenantIds]) } });
      for (const t of tenants) tenantNameMap.set(t.id, t.name);
    }

    const toBillEntry = (b: Bill): BillListEntry => {
      const room = roomMap.get(b.roomId);
      return {
        billId: b.id,
        roomId: b.roomId,
        roomName: room?.name || `房间${b.roomId}`,
        propertyName: room ? (propertyMap.get(room.propertyId)?.name || '') : '',
        tenantId: b.tenantId || null,
        tenantName: tenantNameMap.get(b.tenantId) || '',
        period: b.period,
        periodEnd: b.periodEnd || null,
        totalAmount: Number(b.totalAmount) || 0,
        paidAmount: Number(b.paidAmount) || 0,
        status: b.status,
        paidAt: b.paidAt ? b.paidAt.toISOString() : null,
        createdAt: b.createdAt ? b.createdAt.toISOString() : '',
      };
    };

    const statusRank = (s: number) => (s === 1 ? 2 : s === 4 ? 3 : 1);
    const billEntries = bills
      .map(toBillEntry)
      .sort((a, b) => statusRank(a.status) - statusRank(b.status));

    const singleEntries: SingleChargeListEntry[] = singles.map(s => {
      const room = roomMap.get(s.roomId);
      return {
        id: s.id,
        roomId: s.roomId,
        roomName: room?.name || `房间${s.roomId}`,
        propertyName: room ? (propertyMap.get(room.propertyId)?.name || '') : '',
        tenantName: tenantNameMap.get(s.tenantId) || '',
        feeType: s.feeType,
        amount: Number(s.amount) || 0,
        note: s.note || '',
        status: s.status,
        paidAt: s.paidAt ? s.paidAt.toISOString() : null,
        createdAt: s.createdAt ? s.createdAt.toISOString() : '',
      };
    });

    return { period: monthStr, bills: billEntries, singleCharges: singleEntries };
  }

  /** Create single charge */
  async createSingleCharge(roomId: number, landlordId: number, dto: CreateSingleChargeDto): Promise<SingleCharge> {
    // Verify room ownership
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('房间不存在');
    const property = await this.propertyRepository.findOne({ where: { id: room.propertyId } });
    if (!property || property.landlordId !== landlordId) {
      throw new BadRequestException('无权操作该房间');
    }

    const tenant = await this.tenantRepository.findOne({
      where: { roomId, status: 1 },
    });
    if (!tenant) throw new BadRequestException('房间没有在租租客');

    const charge = this.singleChargeRepository.create({
      roomId,
      tenantId: tenant.id,
      feeType: dto.feeType,
      amount: dto.amount,
      note: dto.note || '',
      status: 0,
    });
    return this.singleChargeRepository.save(charge);
  }

  /** Confirm single charge with ownership check */
  async confirmSingleCharge(id: number, landlordId: number): Promise<SingleCharge> {
    const charge = await this.singleChargeRepository.findOne({
      where: { id },
      relations: ['tenant'],
    });
    if (!charge) throw new NotFoundException('收款记录不存在');
    await this.verifyRoomOwnership(charge.roomId, landlordId);

    if (charge.status === 1) {
      throw new BadRequestException('该收款已确认');
    }

    charge.status = 1;
    charge.paidAt = new Date();
    const saved = await this.singleChargeRepository.save(charge);

    const rentRecord = this.rentRecordRepository.create({
      roomId: charge.roomId,
      type: 2,
      title: `单独收款-${charge.feeType}`,
      description: charge.note || `单独收款: ${charge.amount}`,
      amount: charge.amount,
    });
    await this.rentRecordRepository.save(rentRecord);

    return saved;
  }

  /** Get rent records for a room (API contract shape with type as string, dotColor, time) */
  async getRecords(roomId: number) {
    const records = await this.rentRecordRepository.find({
      where: { roomId },
      order: { createdAt: 'DESC' },
    });
    return records.map(r => ({
      id: r.id,
      type: RECORD_TYPE_MAP[r.type] || 'other',
      title: r.title || '',
      description: r.description || '',
      amount: Number(r.amount) || 0,
      time: r.createdAt ? r.createdAt.toISOString().slice(0, 16).replace('T', ' ') : '',
      dotColor: DOT_COLOR_MAP[r.type] || 'accent',
    }));
  }

  /** Remind tenant (create reminder record type=4) */
  async remindTenant(roomId: number, dto: RemindTenantDto): Promise<RentRecord> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('房间不存在');

    const title = dto.title || `催缴提醒-${dto.month || ''}`;
    const description = dto.description || (dto.tenantId ? `租客ID: ${dto.tenantId}` : '');

    const rentRecord = this.rentRecordRepository.create({
      roomId,
      type: 4,
      title,
      description,
      amount: 0,
    });
    return this.rentRecordRepository.save(rentRecord);
  }
}
