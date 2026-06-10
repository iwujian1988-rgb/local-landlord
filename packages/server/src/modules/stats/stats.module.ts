import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { Room } from '../room/room.entity';
import { Bill } from '../bill/bill.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Property } from '../property/property.entity';
import { Landlord } from '../landlord/landlord.entity';
import { FeeItem } from '../fee/fee-item.entity';
import { PaymentQr } from '../payment-qr/payment-qr.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Room, Bill, Tenant, Property, Landlord, FeeItem, PaymentQr])],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
