import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Property } from './property.entity';
import { Landlord } from '../landlord/landlord.entity';
import { Room } from '../room/room.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Bill } from '../bill/bill.entity';
import { BillItem } from '../bill/bill-item.entity';
import { FeeItem } from '../fee/fee-item.entity';
import { Document } from '../document/document.entity';
import { RentRecord } from '../rent/rent-record.entity';
import { SingleCharge } from '../rent/single-charge.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

export interface PropertyWithStats extends Property {
  roomCount?: number;
  rentedCount?: number;
  vacantCount?: number;
  overdueCount?: number;
  monthlyExpectedIncome?: number;
}

@Injectable()
export class PropertyService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
    @InjectRepository(FeeItem)
    private readonly feeItemRepository: Repository<FeeItem>,
    @InjectRepository(Landlord)
    private readonly landlordRepository: Repository<Landlord>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(RentRecord)
    private readonly rentRecordRepository: Repository<RentRecord>,
    @InjectRepository(SingleCharge)
    private readonly singleChargeRepository: Repository<SingleCharge>,
    @InjectRepository(BillItem)
    private readonly billItemRepository: Repository<BillItem>,
  ) {}

  /** Get properties for a landlord */
  async findAll(landlordId: number): Promise<PropertyWithStats[]> {
    const properties = await this.propertyRepository.find({
      where: { landlordId },
      order: { createdAt: 'DESC' },
    });

    const result: PropertyWithStats[] = [];
    for (const property of properties) {
      const stats = await this.getPropertyStats(property.id);
      result.push({ ...property, ...stats });
    }
    return result;
  }

  /** Get property detail with ownership check */
  async findOne(id: number, userId?: number, isAdmin?: boolean): Promise<PropertyWithStats> {
    const property = await this.propertyRepository.findOne({
      where: { id },
    });
    if (!property) throw new NotFoundException('房源不存在');

    // Ownership check: non-admin users can only access their own properties
    if (userId && !isAdmin && property.landlordId !== userId) {
      throw new ForbiddenException('无权访问该房源');
    }

    const stats = await this.getPropertyStats(id);
    return { ...property, ...stats };
  }

  /** Create property */
  async create(landlordId: number, dto: CreatePropertyDto): Promise<Property> {
    const count = await this.propertyRepository.count({ where: { landlordId } });
    const landlord = await this.landlordRepository.findOne({ where: { id: landlordId } });
    if (landlord) {
      if (landlord.status === 0) {
        throw new BadRequestException('账号已禁用，无法创建房源');
      }
      const max = landlord.maxProperties ?? 10;
      if (max > 0 && count >= max) {
        throw new BadRequestException(`[30003] 房源数量已达上限（${max}套），无法继续添加`);
      }
    }

    const property = this.propertyRepository.create({
      ...dto,
      landlordId,
    });
    return this.propertyRepository.save(property);
  }

  /** Update property with ownership check */
  async update(id: number, dto: UpdatePropertyDto, userId?: number, isAdmin?: boolean): Promise<Property> {
    const property = await this.propertyRepository.findOne({ where: { id } });
    if (!property) throw new NotFoundException('房源不存在');

    // Ownership check
    if (userId && !isAdmin && property.landlordId !== userId) {
      throw new ForbiddenException('无权修改该房源');
    }

    Object.assign(property, dto);
    return this.propertyRepository.save(property);
  }

  /** Delete property with ownership check */
  async remove(id: number, userId?: number, isAdmin?: boolean): Promise<void> {
    // Verify ownership first
    const property = await this.propertyRepository.findOne({ where: { id } });
    if (!property) throw new NotFoundException('房源不存在');

    if (userId && !isAdmin && property.landlordId !== userId) {
      throw new ForbiddenException('无权删除该房源');
    }

    await this.propertyRepository.manager.transaction(async (manager) => {
      const prop = await manager.findOne(Property, { where: { id } });
      if (!prop) throw new NotFoundException('房源不存在');

      // Check for rented rooms
      const rentedCount = await manager.count(Room, {
        where: { propertyId: id, status: 1 },
      });
      if (rentedCount > 0) {
        throw new BadRequestException('该房源下有在租房间，无法删除');
      }

      // Get all room IDs under this property
      const rooms = await manager.find(Room, {
        where: { propertyId: id },
        select: ['id'],
      });
      const roomIds = rooms.map(r => r.id);

      if (roomIds.length > 0) {
        const bills = await manager.find(Bill, {
          where: { roomId: In(roomIds) },
          select: ['id'],
        });
        const billIds = bills.map(b => b.id);

        if (billIds.length > 0) {
          await manager.delete(BillItem, { billId: In(billIds) });
        }

        await manager.delete(RentRecord, { roomId: In(roomIds) });
        await manager.delete(SingleCharge, { roomId: In(roomIds) });
        await manager.delete(Bill, { roomId: In(roomIds) });
        await manager.delete(Document, { roomId: In(roomIds) });
        await manager.delete(FeeItem, { roomId: In(roomIds) });
        await manager.delete(Tenant, { roomId: In(roomIds) });
        await manager.delete(Room, { propertyId: id });
      }

      await manager.remove(Property, prop);
    });
  }

  /** Calculate property statistics */
  private async getPropertyStats(propertyId: number) {
    const rooms = await this.roomRepository.find({ where: { propertyId } });
    const roomCount = rooms.length;

    const rentedCount = rooms.filter(r => r.status === 1).length;
    const vacantCount = rooms.filter(r => r.status === 0).length;

    // Overdue bills
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const overdueCount = await this.billRepository
      .createQueryBuilder('bill')
      .innerJoin('bill.room', 'room')
      .where('room.propertyId = :propertyId', { propertyId })
      .andWhere('bill.status IN (:...statuses)', { statuses: [0, 2, 3] })
      .andWhere('bill.period <= :period', { period: monthStr })
      .andWhere('COALESCE(bill.period_end, bill.period) <= :period', { period: monthStr })
      .getCount();

    // Monthly expected income for active rented rooms only. This is not
    // theoretical capacity; vacant rooms must not inflate "本月应收".
    let monthlyExpectedIncome = 0;
    for (const room of rooms) {
      if (room.status !== 1) continue;
      const tenant = await this.tenantRepository.findOne({ where: { roomId: room.id, status: 1 } });
      if (!tenant) continue;
      const payMonths = tenant.payMonths ?? 1;
      const feeItems = await this.feeItemRepository.find({ where: { roomId: room.id, enabled: 1 } });
      let roomExpected = 0;
      for (const item of feeItems) {
        if (item.type === 0) {
          roomExpected += (Number(item.amount) || 0) * (item.cycleMode === 'monthly' ? 1 : payMonths);
        }
      }
      monthlyExpectedIncome += roomExpected > 0 ? roomExpected : (Number(room.rent) || 0) * payMonths;
    }

    return { roomCount, rentedCount, vacantCount, overdueCount, monthlyExpectedIncome };
  }
}
