import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

export interface PendingRentGroup {
  today: any[];
  expiringSoon: any[];
  overdue: any[];
  completed: any[];
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

  /**
   * Pending rent list: grouped by today/expiringSoon/overdue/completed
   * Optimized with batch loading instead of N+1 queries.
   */
  async getPendingRent(landlordId: number): Promise<PendingRentGroup> {
    // 1. Get all rented rooms for this landlord in one query
    const rentedRooms = await this.roomRepository
      .createQueryBuilder('room')
      .innerJoin('room.property', 'property')
      .where('property.landlordId = :landlordId', { landlordId })
      .andWhere('room.status = 1')
      .getMany();

    if (rentedRooms.length === 0) {
      return { today: [], expiringSoon: [], overdue: [], completed: [] };
    }

    const roomIds = rentedRooms.map(r => r.id);

    // 2. Batch load all active tenants for these rooms
    const allTenants = await this.tenantRepository.find({
      where: { roomId: In(roomIds), status: 1 },
    });
    const tenantMap = new Map<number, Tenant>();
    for (const t of allTenants) {
      tenantMap.set(t.roomId, t);
    }

    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 3. Batch load current month bills for these rooms
    const currentBills = await this.billRepository.find({
      where: { roomId: In(roomIds), period: monthStr },
      relations: ['items'],
    });
    const currentBillMap = new Map<number, Bill>();
    for (const b of currentBills) {
      currentBillMap.set(b.roomId, b);
    }

    // 4. Batch load all unpaid bills for overdue detection
    const unpaidBills = await this.billRepository.find({
      where: { roomId: In(roomIds), status: 0 },
    });
    const overdueBillsMap = new Map<number, Bill[]>();
    for (const b of unpaidBills) {
      if (b.period < monthStr) {
        const list = overdueBillsMap.get(b.roomId) || [];
        list.push(b);
        overdueBillsMap.set(b.roomId, list);
      }
    }

    const todayList: any[] = [];
    const expiringSoonList: any[] = [];
    const overdueList: any[] = [];
    const completedList: any[] = [];

    for (const room of rentedRooms) {
      const activeTenant = tenantMap.get(room.id) || null;
      const currentBill = currentBillMap.get(room.id) || null;
      const trulyOverdue = overdueBillsMap.get(room.id) || [];

      const rentEntry = {
        roomId: room.id,
        roomName: room.name,
        rent: room.rent,
        tenantName: activeTenant?.name || '',
        tenantId: activeTenant?.id || null,
        contactEndDate: activeTenant?.contractEndDate || '',
        rentDay: activeTenant?.rentDay || 10,
        billId: currentBill?.id || null,
        billStatus: currentBill?.status ?? null,
        totalAmount: currentBill?.totalAmount || 0,
        hasOverdue: trulyOverdue.length > 0,
      };

      if (currentBill && currentBill.status === 1) {
        completedList.push(rentEntry);
      } else if (trulyOverdue.length > 0) {
        overdueList.push(rentEntry);
      } else if (currentBill && currentBill.status === 0) {
        const rentDay = activeTenant?.rentDay || 10;
        const dayOfMonth = now.getDate();
        if (dayOfMonth === rentDay) {
          todayList.push(rentEntry);
        } else if (dayOfMonth > rentDay) {
          overdueList.push(rentEntry);
        } else {
          todayList.push(rentEntry);
        }
      } else {
        const contractEnd = activeTenant?.contractEndDate;
        if (contractEnd) {
          const diffDays = Math.ceil(
            (new Date(contractEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (diffDays <= 30 && diffDays > 0) {
            expiringSoonList.push(rentEntry);
          } else {
            todayList.push(rentEntry);
          }
        } else {
          todayList.push(rentEntry);
        }
      }
    }

    return {
      today: todayList,
      expiringSoon: expiringSoonList,
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

  /** Confirm single charge */
  async confirmSingleCharge(id: number): Promise<SingleCharge> {
    const charge = await this.singleChargeRepository.findOne({
      where: { id },
      relations: ['tenant'],
    });
    if (!charge) throw new NotFoundException('收款记录不存在');

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

  /** Get rent records for a room */
  async getRecords(roomId: number): Promise<RentRecord[]> {
    return this.rentRecordRepository.find({
      where: { roomId },
      relations: ['bill'],
      order: { createdAt: 'DESC' },
    });
  }

  /** Remind tenant (create reminder record type=4) */
  async remindTenant(roomId: number, dto: RemindTenantDto): Promise<RentRecord> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('房间不存在');

    const rentRecord = this.rentRecordRepository.create({
      roomId,
      type: 4,
      title: dto.title,
      description: dto.description || '',
      amount: 0,
    });
    return this.rentRecordRepository.save(rentRecord);
  }
}
