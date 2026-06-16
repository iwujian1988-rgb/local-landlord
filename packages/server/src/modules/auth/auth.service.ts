import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThan, Repository } from 'typeorm';
import { Landlord } from '../landlord/landlord.entity';
import { Admin } from '../system/admin.entity';
import { Property } from '../property/property.entity';
import { Room } from '../room/room.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Bill } from '../bill/bill.entity';
import { BillItem } from '../bill/bill-item.entity';
import { SingleCharge } from '../rent/single-charge.entity';
import { RentRecord } from '../rent/rent-record.entity';
import { PaymentQr } from '../payment-qr/payment-qr.entity';
import { Document } from '../document/document.entity';
import { WechatLoginDto } from './dto/wechat-login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as bcrypt from 'bcryptjs';

const ACCOUNT_RETENTION_DAYS = 30;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    @InjectRepository(Landlord)
    private readonly landlordRepository: Repository<Landlord>,
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
  ) {}

  /**
   * Dev login: bypass WeChat, create/find a test landlord by dev code
   */
  async devLogin(devCode: string) {
    const openId = `dev_${devCode}`;

    let landlord = await this.landlordRepository.findOne({ where: { openId } });
    if (!landlord) {
      landlord = this.landlordRepository.create({
        openId,
        name: '房东',
        phone: '13800000000',
        avatar: '',
      });
      landlord = await this.landlordRepository.save(landlord);
    }

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
      },
    };
  }

  /**
   * WeChat login: call code2Session to get openid, find or create landlord, issue JWT
   */
  async wechatLogin(dto: WechatLoginDto) {
    const { code, nickname, avatar } = dto;

    // 1. Call WeChat code2Session with 10s timeout
    const appid = process.env.WX_APPID;
    const secret = process.env.WX_SECRET;
    if (!appid || !secret) {
      throw new BadRequestException('微信登录服务未配置');
    }

    let wxData: { openid?: string; session_key?: string; errcode?: number; errmsg?: string };
    try {
      const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
      const raw = await this.httpGetJson(wxUrl);
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
        name: '房东',
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

  /**
   * Cloud hosting login: authenticate via X-WX-OPENID from CallContainer
   */
  async cloudLogin(openId: string) {
    let landlord = await this.landlordRepository.findOne({ where: { openId } });
    if (!landlord) {
      landlord = this.landlordRepository.create({
        openId,
        name: '房东',
        phone: '',
        avatar: '',
      });
      landlord = await this.landlordRepository.save(landlord);
    }

    if (landlord.status === 0) {
      throw new ForbiddenException('账户已被禁用，请联系管理员');
    }

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
      const isProd = process.env.NODE_ENV === 'production';
      const defaultPwd = process.env.ADMIN_DEFAULT_PASSWORD
        || (isProd
          ? ''
          : this.generateRandomPassword());
      if (isProd && !defaultPwd) {
        // Refuse to boot an admin account with an empty/generated password in production.
        // Operator must set ADMIN_DEFAULT_PASSWORD in env (and rotate it after first login).
        throw new BadRequestException(
          '生产环境必须在环境变量 ADMIN_DEFAULT_PASSWORD 中显式设置初始管理员密码',
        );
      }
      const hashedPwd = await bcrypt.hash(defaultPwd, 10);
      admin = this.adminRepository.create({
        username: 'admin',
        password: hashedPwd,
        name: '超级管理员',
        role: 0,
        status: 1,
      });
      admin = await this.adminRepository.save(admin);
      // Don't log the password itself — it's a credential. Operator should already know it from env.
      this.logger.warn('首次启动：已创建管理员账户 admin，请尽快登录并修改密码。');
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

  /**
   * Soft-delete landlord account: set status=0.
   * Data retained for 30-day grace period; subsequent logins blocked by JwtAuthGuard + cloudLogin/wechatLogin status check.
   * Hard purge handled by purgeDeletedAccounts cron below.
   */
  async deleteAccount(userId: number): Promise<{ disabledAt: string; retentionDays: number }> {
    const landlord = await this.landlordRepository.findOne({ where: { id: userId } });
    if (!landlord) throw new BadRequestException('用户不存在');

    landlord.status = 0;
    await this.landlordRepository.save(landlord);

    this.logger.log(`Landlord ${userId} (${landlord.openId}) account disabled (soft-delete)`);

    return {
      disabledAt: new Date().toISOString(),
      retentionDays: ACCOUNT_RETENTION_DAYS,
    };
  }

  /**
   * Daily hard-purge of accounts soft-deleted more than ACCOUNT_RETENTION_DAYS ago.
   * Runs at 02:17 local time — off the top of the hour to avoid colliding with the
   * subscription reminder crons that fire at :00/:05/:30 across 08:00–20:00.
   */
  @Cron('17 2 * * *')
  async purgeDeletedAccounts(): Promise<void> {
    const cutoff = new Date(Date.now() - ACCOUNT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const stale = await this.landlordRepository.find({
      where: { status: 0, updatedAt: LessThan(cutoff) },
      select: ['id', 'openId'],
    });
    if (stale.length === 0) return;

    this.logger.log(`Found ${stale.length} account(s) past ${ACCOUNT_RETENTION_DAYS}-day retention, purging…`);
    for (const landlord of stale) {
      try {
        await this.hardDeleteLandlord(landlord.id);
        this.logger.log(`Hard-deleted landlord ${landlord.id} (${landlord.openId})`);
      } catch (err) {
        this.logger.error(`Failed to purge landlord ${landlord.id}`, (err as Error)?.stack || err);
      }
    }
  }

  /**
   * Hard-delete a landlord and every row that belongs to them.
   * No FK has ON DELETE CASCADE, so we walk the graph manually inside a transaction.
   * Order matters: leaf tables first.
   */
  private async hardDeleteLandlord(landlordId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const propertyIds = (await manager.getRepository(Property)
        .find({ where: { landlordId }, select: ['id'] }))
        .map((p) => p.id);

      if (propertyIds.length > 0) {
        const roomIds = (await manager.getRepository(Room)
          .find({ where: { propertyId: In(propertyIds) }, select: ['id'] }))
          .map((r) => r.id);

        if (roomIds.length > 0) {
          const billIds = (await manager.getRepository(Bill)
            .find({ where: { roomId: In(roomIds) }, select: ['id'] }))
            .map((b) => b.id);

          if (billIds.length > 0) {
            await manager.getRepository(BillItem).delete({ billId: In(billIds) });
          }
          await manager.getRepository(Bill).delete({ roomId: In(roomIds) });
          await manager.getRepository(SingleCharge).delete({ roomId: In(roomIds) });
          await manager.getRepository(RentRecord).delete({ roomId: In(roomIds) });
          await manager.getRepository(Tenant).delete({ roomId: In(roomIds) });
          await manager.getRepository(Document).delete({ roomId: In(roomIds) });
          await manager.getRepository(Room).delete({ id: In(roomIds) });
        }
        await manager.getRepository(Property).delete({ id: In(propertyIds) });
      }

      await manager.getRepository(PaymentQr).delete({ landlordId });
      await manager.getRepository(Landlord).delete({ id: landlordId });
    });
  }

  private generateRandomPassword(length = 16): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < length; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd;
  }

  private httpGetJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const mod = url.startsWith('https') ? require('https') : require('http');
      const timer = setTimeout(() => {
        req.destroy(new Error('request timeout'));
      }, 10000);
      const req = mod.get(url, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          clearTimeout(timer);
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
      });
      req.on('error', (err: Error) => { clearTimeout(timer); reject(err); });
    });
  }
}
