import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillController } from './bill.controller';
import { BillService } from './bill.service';
import { Bill } from './bill.entity';
import { BillItem } from './bill-item.entity';
import { RentRecord } from '../rent/rent-record.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Room } from '../room/room.entity';
import { Property } from '../property/property.entity';
import { FeeItem } from '../fee/fee-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Bill, BillItem, RentRecord, Tenant, Room, Property, FeeItem])],
  controllers: [BillController],
  providers: [BillService],
  exports: [BillService],
})
export class BillModule {}
