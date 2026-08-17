import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UtilityReadingController } from './utility-reading.controller';
import { UtilityReadingService } from './utility-reading.service';
import { UtilityReading } from './utility-reading.entity';
import { Room } from '../room/room.entity';
import { Property } from '../property/property.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Bill } from '../bill/bill.entity';
import { BillItem } from '../bill/bill-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UtilityReading, Room, Property, Tenant, Bill, BillItem])],
  controllers: [UtilityReadingController],
  providers: [UtilityReadingService],
  exports: [UtilityReadingService],
})
export class UtilityReadingModule {}
