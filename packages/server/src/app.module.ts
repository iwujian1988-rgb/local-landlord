import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as mysql from 'mysql2/promise';
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
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { ShareModule } from './modules/share/share.module';
import { HealthController } from './modules/health/health.controller';
import { SchemaCompatService } from './common/schema-compat.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const dbType = configService.get('DB_TYPE', configService.get('NODE_ENV') === 'production' ? 'mysql' : 'sqljs');

        if (dbType === 'mysql') {
          const host = configService.get<string>('DB_HOST', 'localhost');
          const port = configService.get<number>('DB_PORT', 3306);
          const username = configService.get<string>('DB_USERNAME', 'root');
          const password = configService.get<string>('DB_PASSWORD', '');
          const database = configService.get<string>('DB_DATABASE', 'local_landlord');

          // Create database only if missing — never drop. (Previous impl dropped on every boot,
          // which wiped production data on each container restart.)
          const conn = await mysql.createConnection({ host, port, user: username, password });
          await conn.query(
            `CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
          );
          await conn.end();

          const isProd = configService.get('NODE_ENV') === 'production';
          return {
            type: 'mysql' as const,
            host,
            port,
            username,
            password,
            database,
            autoLoadEntities: true,
            // synchronize=true is risky in prod (auto-ALTERs tables). Disable for prod, use migrations.
            synchronize: !isProd,
            logging: !isProd,
          };
        }

        // Default: sqljs for development
        return {
          type: 'sqljs' as const,
          location: configService.get('DB_LOCATION', 'data/local_landlord.sqlite'),
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
    SubscriptionModule,
    ShareModule,
  ],
  controllers: [HealthController],
  providers: [
    SchemaCompatService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
