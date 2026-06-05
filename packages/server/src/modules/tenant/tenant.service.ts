import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';
import { Room } from '../room/room.entity';
import { Property } from '../property/property.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
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

  /** Create tenant (also updates room status to rented) */
  async create(roomId: number, dto: CreateTenantDto): Promise<Tenant> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('房间不存在');

    const existingTenant = await this.tenantRepository.findOne({
      where: { roomId, status: 1 },
    });
    if (existingTenant) {
      throw new BadRequestException('ROOM_OCCUPIED: 房间已有在租租客');
    }

    const tenant = this.tenantRepository.create({
      ...dto,
      roomId,
      status: 1,
    });
    const saved = await this.tenantRepository.save(tenant);

    room.status = 1;
    await this.roomRepository.save(room);

    return saved;
  }

  /** Update tenant info */
  async update(id: number, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('租客不存在');
    Object.assign(tenant, dto);
    return this.tenantRepository.save(tenant);
  }

  /** Move out: update tenant status + room status */
  async moveOut(id: number, moveOutDate: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('租客不存在');

    if (tenant.status !== 1) {
      throw new BadRequestException('该租客已退租');
    }

    tenant.status = 0;
    tenant.moveOutDate = moveOutDate;
    const saved = await this.tenantRepository.save(tenant);

    const room = await this.roomRepository.findOne({ where: { id: tenant.roomId } });
    if (room) {
      room.status = 0;
      await this.roomRepository.save(room);
    }

    return saved;
  }

  /** Get tenant detail */
  async findOne(id: number): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { id },
      relations: ['room', 'room.property'],
    });
    if (!tenant) throw new NotFoundException('租客不存在');
    return tenant;
  }
}
