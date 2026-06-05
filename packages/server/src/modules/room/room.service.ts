import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as dayjs from 'dayjs';
import { Room } from './room.entity';
import { Tenant } from '../tenant/tenant.entity';
import { FeeItem } from '../fee/fee-item.entity';
import { Bill } from '../bill/bill.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

/**
 * computeRoomDisplayStatus - 根据房间原始状态、租约日期、rentDay计算展示状态
 * 状态码：
 *   0: 空置（vacant）
 *   1: 已出租（rented）
 *   2: 即将到期（expiring - 距合同结束<30天）
 *   3: 已逾期（overdue - today > rentDay）
 */
export function computeRoomDisplayStatus(
  roomStatus: number,
  contractEndDate: string | null,
  rentDay: number | undefined,
): number {
  // 空置的房间
  if (roomStatus === 0) return 0;

  // 已出租的房间
  if (roomStatus === 1) {
    // rentDay 逾期判断
    if (rentDay !== undefined && rentDay !== null) {
      const today = dayjs();
      let dueDay: number;

      // rentDay=0 当作月底，取当月最后一天
      if (rentDay === 0) {
        dueDay = today.endOf('month').date();
      } else {
        dueDay = rentDay;
      }

      // today > rentDay → 逾期
      if (today.date() > dueDay) {
        return 3; // 已逾期
      }
    }

    if (contractEndDate) {
      const endDate = dayjs(contractEndDate);
      const now = dayjs();
      const diffDays = endDate.diff(now, 'day');
      if (diffDays <= 30) return 2; // 即将到期
    }

    return 1; // 正常已出租
  }

  return roomStatus;
}

interface RoomStatusSummary {
  total: number;
  vacant: number;
  rented: number;
  expiring: number;
  overdue: number;
}

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(FeeItem)
    private readonly feeItemRepository: Repository<FeeItem>,
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
  ) {}

  /** 获取房源下的房间列表（支持 status 筛选） */
  async findByProperty(
    propertyId: number,
    status?: number,
  ): Promise<{ list: Room[]; summary: RoomStatusSummary }> {
    const where: any = { propertyId };
    if (status !== undefined) {
      where.status = status;
    }

    const rooms = await this.roomRepository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['tenants'],
    });

    // 计算展示状态
    const enrichedRooms: any[] = [];
    for (const room of rooms) {
      const activeTenant = room.tenants?.find(t => t.status === 1) || null;
      const contractEndDate = activeTenant?.contractEndDate || null;
      const rentDay = activeTenant?.rentDay;

      enrichedRooms.push({
        ...room,
        displayStatus: computeRoomDisplayStatus(room.status, contractEndDate, rentDay),
        activeTenant: activeTenant
          ? {
              id: activeTenant.id,
              name: activeTenant.name,
              phone: activeTenant.phone,
              moveInDate: activeTenant.moveInDate,
              contractEndDate: activeTenant.contractEndDate,
            }
          : null,
      });
    }

    // 统计汇总
    const summary: RoomStatusSummary = {
      total: enrichedRooms.length,
      vacant: enrichedRooms.filter(r => r.displayStatus === 0).length,
      rented: enrichedRooms.filter(r => r.displayStatus === 1).length,
      expiring: enrichedRooms.filter(r => r.displayStatus === 2).length,
      overdue: enrichedRooms.filter(r => r.displayStatus === 3).length,
    };

    return { list: enrichedRooms, summary };
  }

  /** 获取房间详情（聚合 property + tenant + feeItems + latestBill） */
  async findOne(id: number): Promise<any> {
    const room = await this.roomRepository.findOne({
      where: { id },
      relations: ['property', 'property.landlord'],
    });
    if (!room) throw new NotFoundException('房间不存在');

    const tenants = await this.tenantRepository.find({
      where: { roomId: id },
      order: { createdAt: 'DESC' },
    });
    const activeTenant = tenants.find(t => t.status === 1) || null;

    const feeItems = await this.feeItemRepository.find({
      where: { roomId: id },
      order: { sortOrder: 'ASC' },
    });

    const latestBill = await this.billRepository.findOne({
      where: { roomId: id },
      order: { createdAt: 'DESC' },
      relations: ['items'],
    });

    return {
      ...room,
      displayStatus: computeRoomDisplayStatus(
        room.status,
        activeTenant?.contractEndDate || null,
        activeTenant?.rentDay,
      ),
      activeTenant,
      tenants,
      feeItems,
      latestBill,
    };
  }

  /** 创建房间 */
  async create(propertyId: number, dto: CreateRoomDto): Promise<Room> {
    const room = this.roomRepository.create({
      ...dto,
      propertyId,
      status: 0, // 默认空置
    });
    return this.roomRepository.save(room);
  }

  /** 更新房间 */
  async update(id: number, dto: UpdateRoomDto): Promise<Room> {
    const room = await this.roomRepository.findOne({ where: { id } });
    if (!room) throw new NotFoundException('房间不存在');
    Object.assign(room, dto);
    return this.roomRepository.save(room);
  }

  /** 删除房间 */
  async remove(id: number): Promise<void> {
    const room = await this.roomRepository.findOne({ where: { id } });
    if (!room) throw new NotFoundException('房间不存在');

    // 检查是否有在租租客
    const activeTenant = await this.tenantRepository.findOne({
      where: { roomId: id, status: 1 },
    });
    if (activeTenant) {
      throw new BadRequestException('房间有在租租客，无法删除');
    }

    await this.roomRepository.remove(room);
  }

}
