import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeeItem } from './fee-item.entity';
import { CreateFeeItemDto } from './dto/create-fee-item.dto';
import { UpdateFeeItemDto } from './dto/update-fee-item.dto';

@Injectable()
export class FeeService {
  constructor(
    @InjectRepository(FeeItem)
    private readonly feeItemRepository: Repository<FeeItem>,
  ) {}

  /** 获取房间的费用项列表 */
  async findByRoom(roomId: number): Promise<FeeItem[]> {
    return this.feeItemRepository.find({
      where: { roomId },
      order: { sortOrder: 'ASC' },
    });
  }

  /** 添加费用项 */
  async create(roomId: number, dto: CreateFeeItemDto): Promise<FeeItem> {
    // 获取当前最大排序值
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

  /** 更新费用项 */
  async update(id: number, dto: UpdateFeeItemDto): Promise<FeeItem> {
    const feeItem = await this.feeItemRepository.findOne({ where: { id } });
    if (!feeItem) throw new NotFoundException('费用项不存在');
    Object.assign(feeItem, dto);
    return this.feeItemRepository.save(feeItem);
  }

  /** 删除费用项 */
  async remove(id: number): Promise<void> {
    const feeItem = await this.feeItemRepository.findOne({ where: { id } });
    if (!feeItem) throw new NotFoundException('费用项不存在');
    await this.feeItemRepository.remove(feeItem);
  }

  /** 排序：接收 id 数组，按顺序重新设置 sortOrder */
  async sortByRoom(roomId: number, ids: number[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await this.feeItemRepository.update({ id: ids[i], roomId }, { sortOrder: i });
    }
  }
}
