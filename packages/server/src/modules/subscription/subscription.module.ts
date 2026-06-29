import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { Bill } from '../bill/bill.entity';
import { BillItem } from '../bill/bill-item.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Room } from '../room/room.entity';
import { Property } from '../property/property.entity';
import { Landlord } from '../landlord/landlord.entity';
import { FeeItem } from '../fee/fee-item.entity';
import { SystemConfig } from '../system/system-config.entity';
import { BillModule } from '../bill/bill.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bill, BillItem, Tenant, Room, Property, Landlord, FeeItem, SystemConfig]),
    BillModule,
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
