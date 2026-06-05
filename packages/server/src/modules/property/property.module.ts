import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { Property } from './property.entity';
import { Room } from '../room/room.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Bill } from '../bill/bill.entity';
import { BillItem } from '../bill/bill-item.entity';
import { FeeItem } from '../fee/fee-item.entity';
import { Document } from '../document/document.entity';
import { RentRecord } from '../rent/rent-record.entity';
import { SingleCharge } from '../rent/single-charge.entity';
import { Landlord } from '../landlord/landlord.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Property, Room, Tenant, Bill, BillItem, FeeItem, Document, RentRecord, SingleCharge, Landlord])],
  controllers: [PropertyController],
  providers: [PropertyService],
  exports: [PropertyService],
})
export class PropertyModule {}
