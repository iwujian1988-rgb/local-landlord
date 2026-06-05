import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Landlord } from '../../modules/landlord/landlord.entity';
import { Admin } from '../../modules/system/admin.entity';

/** 从 Authorization header 提取 Bearer token，验证并注入 user 到 request */
@Injectable()
export class JwtAuthGuard {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Landlord)
    private readonly landlordRepository: Repository<Landlord>,
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const payload = this.jwtService.verify(token);
      const { sub, role } = payload;

      // role=0 表示管理员，否则为房东
      if (role === 0) {
        const admin = await this.adminRepository.findOne({ where: { id: sub } });
        if (!admin || admin.status !== 1) {
          throw new UnauthorizedException('Admin not found or disabled');
        }
        request.user = {
          id: admin.id,
          username: admin.username,
          name: admin.name,
          role: admin.role,
          isAdmin: true,
        };
      } else {
        const landlord = await this.landlordRepository.findOne({ where: { id: sub } });
        if (!landlord) {
          throw new UnauthorizedException('User not found');
        }
        if (landlord.status !== 1) {
          throw new UnauthorizedException('账户已被禁用，请联系管理员');
        }
        request.user = {
          id: landlord.id,
          openId: landlord.openId,
          name: landlord.name,
          phone: landlord.phone,
          avatar: landlord.avatar,
          role: 1,
          isAdmin: false,
        };
      }

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid token');
    }
  }
}
