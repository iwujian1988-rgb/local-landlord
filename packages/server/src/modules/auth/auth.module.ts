import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Landlord } from '../landlord/landlord.entity';
import { Admin } from '../system/admin.entity';

@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get('JWT_SECRET');
        if (!secret && configService.get('NODE_ENV') === 'production') {
          throw new Error('JWT_SECRET environment variable must be set in production');
        }
        return {
          secret: secret || 'dev-secret',
          signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN', '7d') },
        };
      },
    }),
    TypeOrmModule.forFeature([Landlord, Admin]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule, TypeOrmModule],
})
export class AuthModule {}
