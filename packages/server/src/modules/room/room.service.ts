import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Room } from './room.entity';
import { Property } from '../property/property.entity';
import { Tenant } from '../tenant/tenant.entity';
import { FeeItem } from '../fee/fee-item.entity';
import { Bill } from '../bill/bill.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

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

  /** Get all rooms for a landlord across all properties */
  async findAllForLandlord(landlordId: number): Promise<any[]> {
    const properties = await this.propertyRepository.find({ where: { landlordId } });
    if (properties.length === 0) return [];

    const propertyIds = properties.map(p => p.id);
    const propertyMap = new Map<number, Property>();
    for (const p of properties) propertyMap.set(p.id, p);

    const rooms = await this.roomRepository.find({
      where: { propertyId: In(propertyIds) },
      order: { createdAt: 'DESC' },
    });
    if (rooms.length === 0) return [];

    const roomIds = rooms.map(r => r.id);

    const tenants = await this.tenantRepository.find({
      where: { roomId: In(roomIds), status: 1 },
    });
    const tenantMap = new Map<number, Tenant>();
    for (const t of tenants) tenantMap.set(t.roomId, t);

    const feeItems = await this.feeItemRepository.find({
      where: { roomId: In(roomIds) },
      order: { sortOrder: 'ASC' },
    });
    const feeMap = new Map<number, FeeItem[]>();
    for (const f of feeItems) {
      const list = feeMap.get(f.roomId) || [];
      list.push(f);
      feeMap.set(f.roomId, list);
    }

    const result: any[] = [];
    for (const room of rooms) {
      const tenant = tenantMap.get(room.id);
      const prop = propertyMap.get(room.propertyId);
      const fees = (feeMap.get(room.id) || []).map(f => ({
        id: f.id,
        name: f.name,
        type: f.type === 0 ? 'fixed' : 'manual',
        amount: Number(f.amount) || 0,
        enabled: !!f.enabled,
        isRent: !!f.isRent,
      }));

      const rentDay = tenant?.rentDay ?? 10;
      const today = new Date().getDate();
      const monthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const currentBill = await this.billRepository.findOne({ where: { roomId: room.id, period: monthStr } });

      let overdueDays = 0;
      if (room.status === 1 && currentBill && currentBill.status !== 1 && today > rentDay) {
        overdueDays = today - rentDay;
      }

      let displayStatus = 'vacant';
      if (room.status === 1) {
        if (overdueDays > 0) displayStatus = 'overdue';
        else if (rentDay - today >= 1 && rentDay - today <= 3) displayStatus = 'approaching';
        else displayStatus = 'rented';
      }

      result.push({
        id: room.id,
        name: room.name,
        rent: Number(room.rent) || 0,
        status: room.status,
        images: room.images || [],
        propertyId: room.propertyId,
        propertyName: prop?.name || '',
        tenantName: tenant?.name || '',
        tenantId: tenant?.id || null,
        rentDay,
        displayStatus,
        overdueDays,
        feeItems: fees,
      });
    }

    return result;
  }

  /** Get rooms under a property (API contract shape with propertyName, totalAmount, string displayStatus) */
  async findByProperty(
    propertyId: number,
    status?: number,
  ): Promise<any> {
    const property = await this.propertyRepository.findOne({ where: { id: propertyId } });

    const where: any = { propertyId };
    if (status !== undefined) {
      where.status = status;
    }

    const rooms = await this.roomRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    const roomIds = rooms.map(r => r.id);

    const tenants = roomIds.length > 0
      ? await this.tenantRepository.find({ where: { roomId: In(roomIds), status: 1 } })
      : [];
    const tenantMap = new Map<number, Tenant>();
    for (const t of tenants) tenantMap.set(t.roomId, t);

    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = now.getDate();

    const currentBills = roomIds.length > 0
      ? await this.billRepository.find({ where: { roomId: In(roomIds), period: monthStr } })
      : [];
    const billMap = new Map<number, Bill>();
    for (const b of currentBills) billMap.set(b.roomId, b);

    const enrichedRooms: any[] = [];
    let vacant = 0, rented = 0, overdue = 0;

    for (const room of rooms) {
      const tenant = tenantMap.get(room.id);
      const bill = billMap.get(room.id);
      const rentDay = tenant?.rentDay ?? 10;
      let overdueDays = 0;

      let displayStatus = 'vacant';
      if (room.status === 1) {
        const billOverdue = bill && bill.status !== 1 && today > rentDay;
        if (billOverdue) {
          displayStatus = 'overdue';
          overdueDays = today - rentDay;
        } else if (rentDay - today >= 1 && rentDay - today <= 3) {
          displayStatus = 'approaching';
        } else {
          displayStatus = 'rented';
        }
      }

      if (displayStatus === 'vacant') vacant++;
      else if (displayStatus === 'overdue') overdue++;
      else rented++;

      enrichedRooms.push({
        id: room.id,
        name: room.name,
        rent: Number(room.rent) || 0,
        status: room.status,
        images: room.images || [],
        displayStatus,
        tenantName: tenant?.name || '',
        rentDay,
        overdueDays,
        contractEndDate: tenant?.contractEndDate || '',
        totalAmount: bill ? Number(bill.totalAmount) || 0 : 0,
      });
    }

    return {
      list: enrichedRooms,
      summary: { total: rooms.length, vacant, rented, overdue },
      propertyName: property?.name || '',
    };
  }

  /** Get room detail (aggregated property + tenant + feeItems + latestBill) */
  async findOne(id: number): Promise<any> {
    const room = await this.roomRepository.findOne({
      where: { id },
      relations: ['property'],
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
    });

    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentBill = await this.billRepository.findOne({ where: { roomId: id, period: monthStr } });
    const rentDay = activeTenant?.rentDay ?? 10;
    const today = now.getDate();
    let overdueDays = 0;
    if (room.status === 1 && currentBill && currentBill.status !== 1 && today > rentDay) {
      overdueDays = today - rentDay;
    }

    let displayStatus = 'vacant';
    if (room.status === 1) {
      if (overdueDays > 0) displayStatus = 'overdue';
      else if (rentDay - today >= 1 && rentDay - today <= 3) displayStatus = 'approaching';
      else displayStatus = 'rented';
    }

    return {
      id: room.id,
      name: room.name,
      rent: Number(room.rent) || 0,
      status: room.status,
      deposit: room.deposit || 0,
      area: room.area || '',
      floor: room.floor || '',
      orientation: room.orientation || '',
      facilities: room.facilities || [],
      images: room.images || [],
      note: room.note || '',
      availableDate: room.availableDate || null,
      propertyId: room.propertyId,
      property: room.property ? { id: room.property.id, name: room.property.name } : null,
      tenant: activeTenant ? {
        id: activeTenant.id,
        name: activeTenant.name,
        phone: activeTenant.phone || '',
        rentDay: activeTenant.rentDay,
        contractEndDate: activeTenant.contractEndDate || '',
        moveInDate: activeTenant.moveInDate || '',
        deposit: activeTenant.deposit || 0,
        note: activeTenant.note || '',
      } : null,
      feeItems: feeItems.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type === 0 ? 'fixed' : 'manual',
        amount: Number(f.amount) || 0,
        enabled: !!f.enabled,
        isRent: !!f.isRent,
      })),
      historyTenants: tenants
        .filter(t => t.status !== 1)
        .map(t => ({
          id: t.id,
          name: t.name,
          phone: t.phone || '',
          moveInDate: t.moveInDate || '',
          moveOutDate: t.moveOutDate || '',
        })),
      latestBill: latestBill ? {
        id: latestBill.id,
        period: latestBill.period,
        totalAmount: Number(latestBill.totalAmount) || 0,
        status: latestBill.status,
      } : null,
      displayStatus,
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

  /** Update room (handles checkout action) */
  async update(id: number, dto: UpdateRoomDto): Promise<Room> {
    const room = await this.roomRepository.findOne({ where: { id } });
    if (!room) throw new NotFoundException('房间不存在');

    if (dto.action === 'checkout') {
      room.status = 0;
      await this.roomRepository.save(room);
      const activeTenant = await this.tenantRepository.findOne({
        where: { roomId: id, status: 1 },
      });
      if (activeTenant) {
        activeTenant.status = 0;
        activeTenant.moveOutDate = new Date().toISOString().slice(0, 10);
        await this.tenantRepository.save(activeTenant);
      }
      return room;
    }

    const { action, ...rest } = dto as any;

    // Prevent setting status=1 (rented) without an active tenant
    if (rest.status === 1 && room.status !== 1) {
      const activeTenant = await this.tenantRepository.findOne({
        where: { roomId: id, status: 1 },
      });
      if (!activeTenant) {
        throw new BadRequestException('房间没有在租租客，无法标记为已租');
      }
    }

    Object.assign(room, rest);
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
