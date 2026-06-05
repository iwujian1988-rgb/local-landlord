import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import dayjs from 'dayjs';
import { Room } from './room.entity';
import { Property } from '../property/property.entity';
import { Tenant } from '../tenant/tenant.entity';
import { FeeItem } from '../fee/fee-item.entity';
import { Bill } from '../bill/bill.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

/**
 * computeRoomDisplayStatus - compute display status based on room status, contract dates, rentDay
 * Status codes:
 *   0: vacant
 *   1: rented
 *   2: expiring (contract end < 30 days)
 *   3: overdue (today > rentDay)
 */
export function computeRoomDisplayStatus(
  roomStatus: number,
  contractEndDate: string | null,
  rentDay: number | undefined,
): number {
  if (roomStatus === 0) return 0;

  if (roomStatus === 1) {
    if (rentDay !== undefined && rentDay !== null) {
      const today = dayjs();
      let dueDay: number;

      if (rentDay === 0) {
        dueDay = today.endOf('month').date();
      } else {
        dueDay = rentDay;
      }

      if (today.date() > dueDay) {
        return 3;
      }
    }

    if (contractEndDate) {
      const endDate = dayjs(contractEndDate);
      const now = dayjs();
      const diffDays = endDate.diff(now, 'day');
      if (diffDays <= 30) return 2;
    }

    return 1;
  }

  return roomStatus;
}

export interface RoomStatusSummary {
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
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(FeeItem)
    private readonly feeItemRepository: Repository<FeeItem>,
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
  ) {}

  /** Verify that a property belongs to the given landlord */
  async verifyPropertyOwnership(propertyId: number, landlordId: number): Promise<void> {
    const property = await this.propertyRepository.findOne({ where: { id: propertyId } });
    if (!property) throw new NotFoundException('房源不存在');
    if (property.landlordId !== landlordId) {
      throw new ForbiddenException('无权访问该房源下的房间');
    }
  }

  /** Verify that a room belongs to a property owned by the given landlord */
  async verifyRoomOwnership(roomId: number, landlordId: number): Promise<void> {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['property'],
    });
    if (!room) throw new NotFoundException('房间不存在');
    if (!room.property || room.property.landlordId !== landlordId) {
      throw new ForbiddenException('无权访问该房间');
    }
  }

  /** Get rooms under a property (supports status filter) */
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

    const summary: RoomStatusSummary = {
      total: enrichedRooms.length,
      vacant: enrichedRooms.filter(r => r.displayStatus === 0).length,
      rented: enrichedRooms.filter(r => r.displayStatus === 1).length,
      expiring: enrichedRooms.filter(r => r.displayStatus === 2).length,
      overdue: enrichedRooms.filter(r => r.displayStatus === 3).length,
    };

    return { list: enrichedRooms, summary };
  }

  /** Get room detail (aggregated property + tenant + feeItems + latestBill) */
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

  /** Create room */
  async create(propertyId: number, dto: CreateRoomDto): Promise<Room> {
    const room = this.roomRepository.create({
      ...dto,
      propertyId,
      status: 0,
    });
    return this.roomRepository.save(room);
  }

  /** Update room */
  async update(id: number, dto: UpdateRoomDto): Promise<Room> {
    const room = await this.roomRepository.findOne({ where: { id } });
    if (!room) throw new NotFoundException('房间不存在');
    Object.assign(room, dto);
    return this.roomRepository.save(room);
  }

  /** Delete room */
  async remove(id: number): Promise<void> {
    const room = await this.roomRepository.findOne({ where: { id } });
    if (!room) throw new NotFoundException('房间不存在');

    const activeTenant = await this.tenantRepository.findOne({
      where: { roomId: id, status: 1 },
    });
    if (activeTenant) {
      throw new BadRequestException('房间有在租租客，无法删除');
    }

    await this.roomRepository.remove(room);
  }
}
