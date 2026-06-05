import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { PropertyModule } from './modules/property/property.module';
import { RoomModule } from './modules/room/room.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { FeeModule } from './modules/fee/fee.module';
import { BillModule } from './modules/bill/bill.module';
import { RentModule } from './modules/rent/rent.module';
import { PaymentQrModule } from './modules/payment-qr/payment-qr.module';
import { DocumentModule } from './modules/document/document.module';
import { LandlordModule } from './modules/landlord/landlord.module';
import { StatsModule } from './modules/stats/stats.module';
import { SystemModule } from './modules/system/system.module';
import { UploadModule } from './modules/upload/upload.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql' as const,
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get('DB_USERNAME', 'root'),
        password: configService.get('DB_PASSWORD', ''),
        database: configService.get('DB_DATABASE', 'local_landlord'),
        autoLoadEntities: true,
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
      }),
    }),
    AuthModule,
    PropertyModule,
    RoomModule,
    TenantModule,
    FeeModule,
    BillModule,
    RentModule,
    PaymentQrModule,
    DocumentModule,
    LandlordModule,
    StatsModule,
    SystemModule,
    UploadModule,
  ],
})
export class AppModule {}
