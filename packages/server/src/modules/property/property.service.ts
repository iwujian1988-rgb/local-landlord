import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

interface PropertyWithStats extends Property {
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

  /** 获取房源列表（按 landlord_id 过滤） */
  async findAll(landlordId: number): Promise<PropertyWithStats[]> {
    const properties = await this.propertyRepository.find({
      where: { landlordId },
      order: { createdAt: 'DESC' },
    });

    // 为每个房源附加统计数据
    const result: PropertyWithStats[] = [];
    for (const property of properties) {
      const stats = await this.getPropertyStats(property.id);
      result.push({ ...property, ...stats });
    }
    return result;
  }

  /** 获取房源详情（含统计） */
  async findOne(id: number): Promise<PropertyWithStats> {
    const property = await this.propertyRepository.findOne({
      where: { id },
      relations: ['landlord'],
    });
    if (!property) throw new NotFoundException('房源不存在');

    const stats = await this.getPropertyStats(id);
    return { ...property, ...stats };
  }

  /** 创建房源 */
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

  /** 更新房源 */
  async update(id: number, dto: UpdatePropertyDto): Promise<Property> {
    const property = await this.propertyRepository.findOne({ where: { id } });
    if (!property) throw new NotFoundException('房源不存在');

    Object.assign(property, dto);
    return this.propertyRepository.save(property);
  }

  /** 删除房源（级联删除所有关联数据） */
  async remove(id: number): Promise<void> {
    await this.propertyRepository.manager.transaction(async (manager) => {
      const property = await manager.findOne(Property, { where: { id } });
      if (!property) throw new NotFoundException('房源不存在');

      // 检查是否有在租房间
      const rentedCount = await manager.count(Room, {
        where: { propertyId: id, status: 1 },
      });
      if (rentedCount > 0) {
        throw new BadRequestException('该房源下有在租房间，无法删除');
      }

      // 获取该房源下所有房间ID
      const rooms = await manager.find(Room, {
        where: { propertyId: id },
        select: ['id'],
      });
      const roomIds = rooms.map(r => r.id);

      if (roomIds.length > 0) {
        // 获取所有相关账单ID
        const bills = await manager.find(Bill, {
          where: { roomId: In(roomIds) },
          select: ['id'],
        });
        const billIds = bills.map(b => b.id);

        // 1. 删除 bill_item（依赖 bill）
        if (billIds.length > 0) {
          await manager.delete(BillItem, { billId: In(billIds) });
        }

        // 2. 删除 rent_record
        await manager.delete(RentRecord, { roomId: In(roomIds) });

        // 3. 删除 single_charge
        await manager.delete(SingleCharge, { roomId: In(roomIds) });

        // 4. 删除 bill
        await manager.delete(Bill, { roomId: In(roomIds) });

        // 5. 删除 document
        await manager.delete(Document, { roomId: In(roomIds) });

        // 6. 删除 fee_item
        await manager.delete(FeeItem, { roomId: In(roomIds) });

        // 7. 删除 tenant
        await manager.delete(Tenant, { roomId: In(roomIds) });

        // 8. 删除 room
        await manager.delete(Room, { propertyId: id });
      }

      // 9. 删除 property
      await manager.remove(Property, property);
    });
  }

  /** 计算房源统计数据 */
  private async getPropertyStats(propertyId: number) {
    const rooms = await this.roomRepository.find({ where: { propertyId } });
    const roomCount = rooms.length;

    // 已租房间（status=1 已出租）
    const rentedCount = rooms.filter(r => r.status === 1).length;
    // 空置房间（status=0 空置）
    const vacantCount = rooms.filter(r => r.status === 0).length;

    // 逾期账单数
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const overdueCount = await this.billRepository
      .createQueryBuilder('bill')
      .innerJoin('bill.room', 'room')
      .where('room.propertyId = :propertyId', { propertyId })
      .andWhere('bill.status = 0')
      .andWhere('bill.period <= :period', { period: monthStr })
      .getCount();

    // 月预期收入：所有房间的租金 + 已启用的费用项
    let monthlyExpectedIncome = 0;
    for (const room of rooms) {
      monthlyExpectedIncome += Number(room.rent) || 0;
    }
    const feeItems = await this.feeItemRepository
      .createQueryBuilder('fi')
      .innerJoin('fi.room', 'room')
      .where('room.propertyId = :propertyId', { propertyId })
      .andWhere('fi.enabled = 1')
      .andWhere('fi.isRent = 0')
      .getMany();
    for (const item of feeItems) {
      monthlyExpectedIncome += Number(item.amount) || 0;
    }

    return { roomCount, rentedCount, vacantCount, overdueCount, monthlyExpectedIncome };
  }
}
