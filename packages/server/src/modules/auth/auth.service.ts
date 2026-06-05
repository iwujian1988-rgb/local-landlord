import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Landlord } from '../landlord/landlord.entity';
import { Admin } from '../system/admin.entity';
import { WechatLoginDto } from './dto/wechat-login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Landlord)
    private readonly landlordRepository: Repository<Landlord>,
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
  ) {}

  /**
   * 微信登录：调用微信 code2Session 接口换取 openid，查找或创建 landlord，签发 JWT
   */
  async wechatLogin(dto: WechatLoginDto) {
    const { code, nickname, avatar } = dto;

    // 1. 调微信 code2Session 获取 openid
    const appid = process.env.WX_APPID || 'wx5c21ac52560dcb27';
    const secret = process.env.WX_SECRET || '';
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;

    const resp = await fetch(url);
    const wxData = await resp.json() as { openid?: string; session_key?: string; errcode?: number; errmsg?: string };

    if (wxData.errcode || !wxData.openid) {
      throw new UnauthorizedException(wxData.errmsg || '微信登录失败');
    }

    // 2. 用 openid 查找或创建 landlord
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

    // 3. 检查账户状态
    if (landlord.status === 0) {
      throw new ForbiddenException('账户已被禁用，请联系管理员');
    }

    // 4. 签发 JWT
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

  /** 管理员登录：用户名 admin 密码 admin123 */
  async adminLogin(dto: AdminLoginDto) {
    const { username, password } = dto;

    // 首次运行自动创建默认管理员
    let admin = await this.adminRepository.findOne({ where: { username } });
    if (!admin && username === 'admin') {
      const hashedPwd = crypto.createHash('sha256').update('admin123').digest('hex');
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

    const hashedInput = crypto.createHash('sha256').update(password).digest('hex');
    if (hashedInput !== admin.password) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 更新最后登录时间
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

  /** 获取当前用户信息 */
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
      openId: landlord.openId,
      name: landlord.name,
      phone: landlord.phone,
      avatar: landlord.avatar,
      defaultPayeeName: landlord.defaultPayeeName,
      paymentNote: landlord.paymentNote,
      isAdmin: false,
    };
  }

  /** 更新房东信息 */
  async updateProfile(userId: number, dto: UpdateProfileDto) {
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
