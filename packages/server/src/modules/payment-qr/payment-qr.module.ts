import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentQrController } from './payment-qr.controller';
import { PaymentQrService } from './payment-qr.service';
import { PaymentQr } from './payment-qr.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentQr])],
  controllers: [PaymentQrController],
  providers: [PaymentQrService],
  exports: [PaymentQrService],
})
export class PaymentQrModule {}
