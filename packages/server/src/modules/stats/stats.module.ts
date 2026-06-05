import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { Room } from '../room/room.entity';
import { Bill } from '../bill/bill.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Property } from '../property/property.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Room, Bill, Tenant, Property])],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
