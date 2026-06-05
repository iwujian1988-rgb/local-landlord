import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RentController } from './rent.controller';
import { RentService } from './rent.service';
import { SingleCharge } from './single-charge.entity';
import { RentRecord } from './rent-record.entity';
import { Room } from '../room/room.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Bill } from '../bill/bill.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SingleCharge, RentRecord, Room, Tenant, Bill])],
  controllers: [RentController],
  providers: [RentService],
  exports: [RentService],
})
export class RentModule {}
