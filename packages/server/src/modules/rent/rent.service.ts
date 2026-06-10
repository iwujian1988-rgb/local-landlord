import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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
  billId: number | null;
  billStatus: number;
  totalAmount: number;
  overdueDays: number;
  daysUntil: number;
  hasOverdue: boolean;
}

export interface PendingRentGroup {
  today: PendingEntry[];
  approaching: PendingEntry[];
  overdue: PendingEntry[];
  completed: PendingEntry[];
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

  /**
   * Pending rent list: grouped by today/approaching/overdue/completed
   * Bucket rules per API-CONTRACT.md:
   *   today       — today == rentDay, current bill unpaid
   *   approaching — rentDay - today ∈ [1, 3], current bill unpaid
   *   overdue     — today > rentDay (current bill unpaid) OR has prior-period unpaid bills
   *   completed   — current bill paid
   */
  async getPendingRent(landlordId: number): Promise<PendingRentGroup> {
    const properties = await this.propertyRepository.find({ where: { landlordId } });
    if (properties.length === 0) {
      return { today: [], approaching: [], overdue: [], completed: [] };
    }
    const propertyMap = new Map<number, Property>();
    for (const p of properties) propertyMap.set(p.id, p);

    const propertyIds = properties.map(p => p.id);
    const rentedRooms = await this.roomRepository.find({
      where: { propertyId: In(propertyIds), status: 1 },
    });
    if (rentedRooms.length === 0) {
      return { today: [], approaching: [], overdue: [], completed: [] };
    }

    const roomIds = rentedRooms.map(r => r.id);

    const allTenants = await this.tenantRepository.find({
      where: { roomId: In(roomIds), status: 1 },
    });
    const tenantMap = new Map<number, Tenant>();
    for (const t of allTenants) tenantMap.set(t.roomId, t);

    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const todayDate = now.getDate();

    const currentBills = await this.billRepository.find({
      where: { roomId: In(roomIds), period: monthStr },
    });
    const currentBillMap = new Map<number, Bill>();
    for (const b of currentBills) currentBillMap.set(b.roomId, b);

    const unpaidBills = await this.billRepository.find({
      where: { roomId: In(roomIds), status: 0 },
    });
    const priorOverdueMap = new Map<number, boolean>();
    for (const b of unpaidBills) {
      if (b.period < monthStr) priorOverdueMap.set(b.roomId, true);
    }

    const todayList: PendingEntry[] = [];
    const approachingList: PendingEntry[] = [];
    const overdueList: PendingEntry[] = [];
    const completedList: PendingEntry[] = [];

    for (const room of rentedRooms) {
      const tenant = tenantMap.get(room.id) || null;
      const bill = currentBillMap.get(room.id) || null;
      const prop = propertyMap.get(room.propertyId);
      const rentDay = tenant?.rentDay ?? 10;
      const hasPriorOverdue = priorOverdueMap.get(room.id) || false;

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
        billId: bill?.id || null,
        billStatus: bill?.status ?? 0,
        totalAmount: Number(bill?.totalAmount) || Number(room.rent) || 0,
        overdueDays,
        daysUntil,
        hasOverdue: hasPriorOverdue,
      };

      if (bill && bill.status === 1) {
        completedList.push(entry);
      } else if (hasPriorOverdue || todayDate > rentDay) {
        overdueList.push(entry);
      } else if (todayDate === rentDay) {
        todayList.push(entry);
      } else if (daysUntil >= 1 && daysUntil <= 3) {
        approachingList.push(entry);
      } else {
        // Not due yet (daysUntil > 3), don't show in any bucket
      }
    }

    return {
      today: todayList,
      approaching: approachingList,
      overdue: overdueList,
      completed: completedList,
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
