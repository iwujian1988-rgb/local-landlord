import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbType = configService.get('DB_TYPE', configService.get('NODE_ENV') === 'production' ? 'mysql' : 'sqljs');

        if (dbType === 'mysql') {
          return {
            type: 'mysql' as const,
            host: configService.get<string>('DB_HOST', 'localhost'),
            port: configService.get<number>('DB_PORT', 3306),
            username: configService.get<string>('DB_USERNAME', 'root'),
            password: configService.get<string>('DB_PASSWORD', ''),
            database: configService.get<string>('DB_DATABASE', 'local_landlord'),
            autoLoadEntities: true,
            synchronize: configService.get('NODE_ENV') === 'development',
            logging: configService.get('NODE_ENV') === 'development',
          };
        }

        // Default: sqljs for development
        return {
          type: 'sqljs' as const,
          location: 'data/local_landlord.sqlite',
          autoSave: true,
          autoLoadEntities: true,
          synchronize: configService.get('NODE_ENV') === 'development',
          logging: configService.get('NODE_ENV') === 'development',
        };
      },
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
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
