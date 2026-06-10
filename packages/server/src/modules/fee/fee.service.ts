import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeeItem } from './fee-item.entity';
import { Room } from '../room/room.entity';
import { Property } from '../property/property.entity';
import { CreateFeeItemDto } from './dto/create-fee-item.dto';
import { UpdateFeeItemDto } from './dto/update-fee-item.dto';

@Injectable()
export class FeeService {
  constructor(
    @InjectRepository(FeeItem)
    private readonly feeItemRepository: Repository<FeeItem>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
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

  /** Verify fee item belongs to landlord (via room -> property chain) */
  async verifyFeeItemOwnership(feeItemId: number, landlordId: number): Promise<void> {
    const feeItem = await this.feeItemRepository.findOne({ where: { id: feeItemId } });
    if (!feeItem) throw new NotFoundException('费用项不存在');
    await this.verifyRoomOwnership(feeItem.roomId, landlordId);
  }

  /** Get fee items for a room (with type as string) */
  async findByRoom(roomId: number) {
    const items = await this.feeItemRepository.find({
      where: { roomId },
      order: { sortOrder: 'ASC' },
    });
    return items.map(f => ({
      id: f.id,
      name: f.name,
      type: f.type === 0 ? 'fixed' : 'manual',
      amount: Number(f.amount) || 0,
      enabled: !!f.enabled,
      isRent: !!f.isRent,
    }));
  }

  /** Batch save fee items for a room */
  async batchSave(roomId: number, fees: any[]) {
    for (const fee of fees) {
      if (!fee.name || !fee.name.trim()) {
        throw new BadRequestException('费用项名称不能为空');
      }
      if (fee.amount !== undefined && fee.amount < 0) {
        throw new BadRequestException('费用金额不能为负数');
      }
    }

    // Delete existing fee items for this room
    await this.feeItemRepository.delete({ roomId });

    // Create new fee items
    const entities = fees.map((fee, index) => this.feeItemRepository.create({
      roomId,
      name: fee.name,
      type: fee.type === 'fixed' ? 0 : 1,
      amount: fee.amount || 0,
      enabled: fee.enabled !== false ? 1 : 0,
      isRent: fee.isRent ? 1 : 0,
      sortOrder: index,
    }));

    const saved = await this.feeItemRepository.save(entities);
    return saved.map(f => ({
      id: f.id,
      name: f.name,
      type: f.type === 0 ? 'fixed' : 'manual',
      amount: Number(f.amount) || 0,
      enabled: !!f.enabled,
      isRent: !!f.isRent,
    }));
  }

  /** Add fee item */
  async create(roomId: number, dto: CreateFeeItemDto): Promise<FeeItem> {
    const maxOrder = await this.feeItemRepository
      .createQueryBuilder('fi')
      .where('fi.roomId = :roomId', { roomId })
      .select('MAX(fi.sortOrder)', 'max')
      .getRawOne();

    const nextOrder = (maxOrder?.max ?? -1) + 1;

    const feeItem = this.feeItemRepository.create({
      ...dto,
      roomId,
      sortOrder: nextOrder,
      enabled: dto.enabled ?? 1,
      isRent: dto.isRent ?? 0,
    });
    return this.feeItemRepository.save(feeItem);
  }

  /** Update fee item */
  async update(id: number, dto: UpdateFeeItemDto): Promise<FeeItem> {
    const feeItem = await this.feeItemRepository.findOne({ where: { id } });
    if (!feeItem) throw new NotFoundException('费用项不存在');
    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('费用项名称不能为空');
    }
    if (dto.amount !== undefined && dto.amount < 0) {
      throw new BadRequestException('费用金额不能为负数');
    }
    Object.assign(feeItem, dto);
    return this.feeItemRepository.save(feeItem);
  }

  /** Delete fee item */
  async remove(id: number): Promise<void> {
    const feeItem = await this.feeItemRepository.findOne({ where: { id } });
    if (!feeItem) throw new NotFoundException('费用项不存在');
    await this.feeItemRepository.remove(feeItem);
  }

  /** Sort: reorder fee items by given id array */
  async sortByRoom(roomId: number, ids: number[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await this.feeItemRepository.update({ id: ids[i], roomId }, { sortOrder: i });
    }
  }
}
