import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeeController } from './fee.controller';
import { FeeService } from './fee.service';
import { FeeItem } from './fee-item.entity';
import { Room } from '../room/room.entity';
import { Property } from '../property/property.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FeeItem, Room, Property])],
  controllers: [FeeController],
  providers: [FeeService],
  exports: [FeeService],
})
export class FeeModule {}
