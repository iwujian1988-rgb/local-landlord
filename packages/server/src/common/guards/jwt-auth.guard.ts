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

/**
 * Hybrid auth guard:
 * 1. If X-WX-OPENID header present (CallContainer), authenticate via openid
 * 2. Otherwise fall back to JWT Bearer token (admin panel / existing sessions)
 */
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

    // Priority 1: CallContainer injects X-WX-OPENID
    const wxOpenId = request.headers['x-wx-openid'];
    if (wxOpenId) {
      return this.authenticateByOpenId(request, wxOpenId);
    }

    // Priority 2: JWT Bearer token
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization');
    }

    const token = authHeader.slice(7);
    try {
      const payload = this.jwtService.verify(token);
      const { sub, role } = payload;

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
        if (landlord.status === 0) {
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

  private async authenticateByOpenId(request: any, wxOpenId: string): Promise<boolean> {
    let landlord = await this.landlordRepository.findOne({ where: { openId: wxOpenId } });
    if (!landlord) {
      landlord = this.landlordRepository.create({
        openId: wxOpenId,
        name: '房东',
        phone: '',
        avatar: '',
      });
      landlord = await this.landlordRepository.save(landlord);
    }

    if (landlord.status === 0) {
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
    return true;
  }
}
