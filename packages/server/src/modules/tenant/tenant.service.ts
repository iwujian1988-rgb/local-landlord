import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';
import { Room } from '../room/room.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
  ) {}

  /** 登记租客（同时更新房间 status 为已出租） */
  async create(roomId: number, dto: CreateTenantDto): Promise<Tenant> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('房间不存在');

    // 检查房间是否已有在租租客
    const existingTenant = await this.tenantRepository.findOne({
      where: { roomId, status: 1 },
    });
    if (existingTenant) {
      throw new BadRequestException('ROOM_OCCUPIED: 房间已有在租租客');
    }

    // 创建租客
    const tenant = this.tenantRepository.create({
      ...dto,
      roomId,
      status: 1, // 在租
    });
    const saved = await this.tenantRepository.save(tenant);

    // 更新房间状态为已出租
    room.status = 1;
    await this.roomRepository.save(room);

    return saved;
  }

  /** 更新租客信息 */
  async update(id: number, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('租客不存在');
    Object.assign(tenant, dto);
    return this.tenantRepository.save(tenant);
  }

  /** 退租：更新租客 status + 房间 status */
  async moveOut(id: number, moveOutDate: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('租客不存在');

    if (tenant.status !== 1) {
      throw new BadRequestException('该租客已退租');
    }

    tenant.status = 0; // 已退租
    tenant.moveOutDate = moveOutDate;
    const saved = await this.tenantRepository.save(tenant);

    // 更新房间状态为空置
    const room = await this.roomRepository.findOne({ where: { id: tenant.roomId } });
    if (room) {
      room.status = 0;
      await this.roomRepository.save(room);
    }

    return saved;
  }

  /** 获取租客详情 */
  async findOne(id: number): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { id },
      relations: ['room', 'room.property'],
    });
    if (!tenant) throw new NotFoundException('租客不存在');
    return tenant;
  }
}
