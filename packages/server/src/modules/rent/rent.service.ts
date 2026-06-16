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

const RECORD_TYPE_MAP: Record<number, string> = {
  0: 'bill_sent', 1: 'bill_paid', 2: 'single_charge', 3: 'single_paid', 4: 'reminder',
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

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const todayDate = now.getDate();

    // Find any bill that covers the current month (handles multi-month cycles).
    const coveringBills = await this.billRepository
      .createQueryBuilder('bill')
      .where('bill.room_id IN (:...roomIds)', { roomIds })
      .andWhere(
        '((bill.period <= :monthStr AND bill.period_end >= :monthStr) ' +
        'OR (bill.period = :monthStr AND bill.period_end IS NULL))',
        { monthStr },
      )
      .getMany();
    const currentBillMap = new Map<number, Bill>();
    for (const b of coveringBills) currentBillMap.set(b.roomId, b);

    // For prior-overdue detection: any unpaid bill whose coverage window ended before this month.
    const unpaidBills = await this.billRepository.find({
      where: { roomId: In(roomIds), status: In([0, 2, 3]) },
    });
    const priorOverdueMap = new Map<number, boolean>();
    for (const b of unpaidBills) {
      const effectiveEnd = b.periodEnd || b.period;
      if (effectiveEnd < monthStr) priorOverdueMap.set(b.roomId, true);
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
      const payMonths = tenant?.payMonths ?? 1;
      const hasPriorOverdue = priorOverdueMap.get(room.id) || false;

      // Cycle check: is current month a due-month?
      let isDueMonth = true;
      let nextDueMonth: string | null = null;
      if (tenant && payMonths > 1) {
        const moveIn = dayjs(tenant.moveInDate);
        const monthsSinceMoveIn = (currentYear - moveIn.year()) * 12 + (currentMonth - moveIn.month());
        if (monthsSinceMoveIn < 0) {
          // Tenant moves in future — first due is the first rentDay at/after moveIn
          isDueMonth = false;
          nextDueMonth = dayjs(moveIn).format('YYYY-MM');
        } else if (monthsSinceMoveIn % payMonths === 0) {
          isDueMonth = true;
        } else {
          isDueMonth = false;
          const monthsAhead = payMonths - (monthsSinceMoveIn % payMonths);
          nextDueMonth = dayjs(monthStr + '-01').add(monthsAhead, 'month').format('YYYY-MM');
        }
      }

      let overdueDays = 0;
      if (todayDate > rentDay) overdueDays = todayDate - rentDay;

      let daysUntil = 0;
      if (todayDate < rentDay) daysUntil = rentDay - todayDate;

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
        totalAmount: Number(bill?.totalAmount) || (Number(room.rent) || 0) * payMonths,
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
      if (todayDate > rentDay) {
        overdueList.push(entry);
      } else if (todayDate === rentDay) {
        todayList.push(entry);
      } else if (daysUntil >= 1 && daysUntil <= 3) {
        approachingList.push(entry);
      }
      // daysUntil > 3: not yet due, don't show
    }

    return {
      today: todayList,
      approaching: approachingList,
      overdue: overdueList,
      completed: completedList,
      upcoming: upcomingList,
    };
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
