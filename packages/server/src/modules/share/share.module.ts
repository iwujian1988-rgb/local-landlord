import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';
import { BillModule } from '../bill/bill.module';
import { RentModule } from '../rent/rent.module';
import { Bill } from '../bill/bill.entity';
import { BillItem } from '../bill/bill-item.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Room } from '../room/room.entity';
import { Property } from '../property/property.entity';
import { Landlord } from '../landlord/landlord.entity';
import { PaymentQr } from '../payment-qr/payment-qr.entity';
import { SingleCharge } from '../rent/single-charge.entity';

@Module({
  imports: [
    BillModule,
    RentModule,
    TypeOrmModule.forFeature([Bill, BillItem, Tenant, Room, Property, Landlord, PaymentQr, SingleCharge]),
  ],
  controllers: [ShareController],
  providers: [ShareService],
  exports: [ShareService],
})
export class ShareModule {}
