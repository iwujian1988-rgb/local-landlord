import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Landlord } from './landlord.entity';

@Injectable()
export class LandlordService {
  constructor(
    @InjectRepository(Landlord)
    private readonly landlordRepository: Repository<Landlord>,
  ) {}

  /** 获取房东信息 */
  async findOne(id: number): Promise<Landlord> {
    const landlord = await this.landlordRepository.findOne({ where: { id } });
    if (!landlord) throw new NotFoundException('房东不存在');
    return landlord;
  }

  /** 更新房东信息 */
  async update(
    id: number,
    data: { name?: string; phone?: string; avatar?: string; defaultPayeeName?: string; paymentNote?: string },
  ): Promise<Landlord> {
    const landlord = await this.landlordRepository.findOne({ where: { id } });
    if (!landlord) throw new NotFoundException('房东不存在');
    Object.assign(landlord, data);
    return this.landlordRepository.save(landlord);
  }
}
