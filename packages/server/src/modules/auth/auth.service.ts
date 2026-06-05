import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Landlord } from '../landlord/landlord.entity';
import { Admin } from '../system/admin.entity';
import { WechatLoginDto } from './dto/wechat-login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Landlord)
    private readonly landlordRepository: Repository<Landlord>,
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
  ) {}

  /**
   * WeChat login: call code2Session to get openid, find or create landlord, issue JWT
   */
  async wechatLogin(dto: WechatLoginDto) {
    const { code, nickname, avatar } = dto;

    // 1. Call WeChat code2Session with 5s timeout
    const appid = process.env.WX_APPID;
    const secret = process.env.WX_SECRET;
    if (!appid || !secret) {
      throw new BadRequestException('微信登录服务未配置');
    }
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;

    let wxData: { openid?: string; session_key?: string; errcode?: number; errmsg?: string };
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      // Destructure openid only, explicitly discard session_key
      const raw = await resp.json() as { openid?: string; session_key?: string; errcode?: number; errmsg?: string };
      const { openid } = raw;
      wxData = { openid };
    } catch (error) {
      this.logger.error('WeChat code2Session request failed', error);
      throw new UnauthorizedException('微信登录服务暂时不可用，请稍后重试');
    }

    if (!wxData.openid) {
      throw new UnauthorizedException(wxData.errmsg || '微信登录失败');
    }

    // 2. Find or create landlord by openid
    let landlord = await this.landlordRepository.findOne({ where: { openId: wxData.openid } });
    if (!landlord) {
      landlord = this.landlordRepository.create({
        openId: wxData.openid,
        name: nickname || `房东${wxData.openid.substring(0, 8)}`,
        phone: '',
        avatar: avatar || '',
      });
      landlord = await this.landlordRepository.save(landlord);
    } else if (nickname || avatar) {
      if (nickname) landlord.name = nickname;
      if (avatar) landlord.avatar = avatar;
      landlord = await this.landlordRepository.save(landlord);
    }

    // 3. Check account status
    if (landlord.status === 0) {
      throw new ForbiddenException('账户已被禁用，请联系管理员');
    }

    // 4. Issue JWT
    const payload = { sub: landlord.id, role: 1 };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: landlord.id,
        openId: landlord.openId,
        name: landlord.name,
        phone: landlord.phone,
        avatar: landlord.avatar,
        defaultPayeeName: landlord.defaultPayeeName,
        paymentNote: landlord.paymentNote,
      },
    };
  }

  /** Admin login */
  async adminLogin(dto: AdminLoginDto) {
    const { username, password } = dto;

    // Auto-create default admin on first run
    let admin = await this.adminRepository.findOne({ where: { username } });
    if (!admin && username === 'admin') {
      const hashedPwd = await bcrypt.hash('admin123', 10);
      admin = this.adminRepository.create({
        username: 'admin',
        password: hashedPwd,
        name: '超级管理员',
        role: 0,
        status: 1,
      });
      admin = await this.adminRepository.save(admin);
    }

    if (!admin) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (admin.status !== 1) {
      throw new UnauthorizedException('账号已被禁用');
    }

    const passwordValid = await bcrypt.compare(password, admin.password);
    if (!passwordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // Update last login time
    admin.lastLoginAt = new Date();
    await this.adminRepository.save(admin);

    const payload = { sub: admin.id, role: admin.role };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        role: admin.role,
      },
    };
  }

  /** Get current user info */
  async getMe(user: any) {
    if (user.isAdmin) {
      const admin = await this.adminRepository.findOne({ where: { id: user.id } });
      if (!admin) throw new UnauthorizedException('User not found');
      return {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        role: admin.role,
        lastLoginAt: admin.lastLoginAt,
        isAdmin: true,
      };
    }

    const landlord = await this.landlordRepository.findOne({ where: { id: user.id } });
    if (!landlord) throw new UnauthorizedException('User not found');
    return {
      id: landlord.id,
      name: landlord.name,
      phone: landlord.phone,
      avatar: landlord.avatar,
      defaultPayeeName: landlord.defaultPayeeName,
      paymentNote: landlord.paymentNote,
      isAdmin: false,
    };
  }

  /** Update profile - supports both landlord and admin */
  async updateProfile(userId: number, dto: UpdateProfileDto, isAdmin: boolean) {
    if (isAdmin) {
      const admin = await this.adminRepository.findOne({ where: { id: userId } });
      if (!admin) throw new BadRequestException('用户不存在');

      if (dto.name !== undefined) admin.name = dto.name;
      // Admin can only update name via this endpoint
      return this.adminRepository.save(admin);
    }

    const landlord = await this.landlordRepository.findOne({ where: { id: userId } });
    if (!landlord) throw new BadRequestException('用户不存在');

    if (dto.name !== undefined) landlord.name = dto.name;
    if (dto.phone !== undefined) landlord.phone = dto.phone;
    if (dto.avatar !== undefined) landlord.avatar = dto.avatar;
    if (dto.defaultPayeeName !== undefined) landlord.defaultPayeeName = dto.defaultPayeeName;
    if (dto.paymentNote !== undefined) landlord.paymentNote = dto.paymentNote;

    return this.landlordRepository.save(landlord);
  }
}
