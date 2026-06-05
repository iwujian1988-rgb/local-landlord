import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LandlordController } from './landlord.controller';
import { LandlordService } from './landlord.service';
import { Landlord } from './landlord.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Landlord])],
  controllers: [LandlordController],
  providers: [LandlordService],
  exports: [LandlordService],
})
export class LandlordModule {}
