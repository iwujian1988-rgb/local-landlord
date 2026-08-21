import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import dayjs from 'dayjs';
import { Bill } from '../bill/bill.entity';
import { BillItem } from '../bill/bill-item.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Room } from '../room/room.entity';
import { Property } from '../property/property.entity';
import { Landlord } from '../landlord/landlord.entity';
import { FeeItem } from '../fee/fee-item.entity';
import { feeRuleAmountForMonths, feeRuleDueMonths, resolveFeeRules } from '../fee/fee-rules';
import { SystemConfig } from '../system/system-config.entity';

// Must stay in sync with packages/miniapp/src/config.ts (WX_TEMPLATE_RENT/OVERDUE —
// both use this one template). Env vars override the default; a WRONG env value
// would be silently rejected by WeChat on every send, so warn loudly.
const DEFAULT_SUBSCRIBE_TEMPLATE_ID = 'siY2jHZxVvfJmZgnrLEzkfYmc8FWt8DFlsdfAIvPGcM';

function resolveTemplateId(envName: 'WX_SUBSCRIBE_TEMPLATE_RENT' | 'WX_SUBSCRIBE_TEMPLATE_OVERDUE'): string {
  const value = process.env[envName];
  if (value && value !== DEFAULT_SUBSCRIBE_TEMPLATE_ID) {
    console.warn(
      `[subscription] ${envName}="${value}" differs from the miniapp template ` +
      `"${DEFAULT_SUBSCRIBE_TEMPLATE_ID}" — WeChat will REJECT these sends until it matches.`,
    );
  }
  return value || DEFAULT_SUBSCRIBE_TEMPLATE_ID;
}

function rentTemplateId(): string {
  return resolveTemplateId('WX_SUBSCRIBE_TEMPLATE_RENT');
}

function overdueTemplateId(): string {
  return resolveTemplateId('WX_SUBSCRIBE_TEMPLATE_OVERDUE');
}

/** WeChat amount-type fields accept numbers only (no 元 suffix, no other text). */
function amountValue(v: number | string | null | undefined): string {
  return String(Math.round(Number(v || 0) * 100) / 100);
}

// Cron expressions are written in Beijing time; pin the zone so a UTC container
// cannot shift them by 8 hours.
const CRON_TZ = { timeZone: 'Asia/Shanghai' };

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private cachedAccessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
    @InjectRepository(BillItem)
    private readonly billItemRepository: Repository<BillItem>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(Landlord)
    private readonly landlordRepository: Repository<Landlord>,
    @InjectRepository(FeeItem)
    private readonly feeItemRepository: Repository<FeeItem>,
    @InjectRepository(SystemConfig)
    private readonly configRepository: Repository<SystemConfig>,
  ) {}

  /** Returns true if auto reminders are enabled (admin can disable globally via system params). */
  private async isAutoRemindEnabled(): Promise<boolean> {
    const config = await this.configRepository.findOne({ where: { key: 'system_params' } });
    const value = config?.value as any;
    // Default to true when missing so fresh installs behave as before.
    return value?.enableAutoRemind !== false;
  }

  /** Get WeChat access_token with caching */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedAccessToken && now < this.tokenExpiresAt - 300000) {
      return this.cachedAccessToken;
    }

    const appid = process.env.WX_APPID;
    const secret = process.env.WX_SECRET;
    if (!appid || !secret) {
      throw new Error('WX_APPID or WX_SECRET not configured');
    }

    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await resp.json() as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string };

    if (!data.access_token) {
      this.logger.error(`Failed to get access_token: ${data.errcode} ${data.errmsg}`);
      throw new Error(`WeChat access_token error: ${data.errmsg}`);
    }

    this.cachedAccessToken = data.access_token;
    this.tokenExpiresAt = now + (data.expires_in || 7200) * 1000;
    return this.cachedAccessToken;
  }

  /** Send subscribe message to a user */
  private async sendSubscribeMessage(
    toUser: string,
    templateId: string,
    data: Record<string, { value: string }>,
    page?: string,
  ): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`;

      const body: Record<string, any> = {
        touser: toUser,
        template_id: templateId,
        data,
      };
      if (page) body.page = page;

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      const result = await resp.json() as { errcode?: number; errmsg?: string };

      if (result.errcode && result.errcode !== 0) {
        this.logger.warn(`Subscribe message failed: ${result.errcode} ${result.errmsg}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error('sendSubscribeMessage error', err);
      return false;
    }
  }

  /** Helper: find landlord for a room */
  private async findLandlordByRoom(roomId: number): Promise<Landlord | null> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) return null;
    const property = await this.propertyRepository.findOne({ where: { id: room.propertyId } });
    if (!property) return null;
    return this.landlordRepository.findOne({ where: { id: property.landlordId } });
  }

  /** Truncate string to fit WeChat thing field (max 20 chars) */
  private truncate(value: string, max = 20): string {
    return value.length > max ? value.slice(0, max - 1) + '…' : value;
  }

  /** Get property name for a room */
  private async getPropertyForRoom(roomId: number): Promise<string | null> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) return null;
    const property = await this.propertyRepository.findOne({ where: { id: room.propertyId } });
    return property?.name || null;
  }

  /**
   * 自动生成月度账单 + 出账通知 — 每天 8:00
   */
  @Cron('0 8 * * *', CRON_TZ)
  async autoGenerateBills(): Promise<{ generated: number; sent: number; failed: number; skipped: number }> {
    const now = dayjs();
    const today = now.date();
    const isLastDay = now.endOf('month').date() === today;
    const monthStr = now.format('YYYY-MM');

    const tenants = await this.tenantRepository.find({ where: { status: 1 } });

    let generated = 0;
    const landlordBillMap = new Map<number, { count: number; total: number }>();

    for (const tenant of tenants) {
      const rentDay = tenant.rentDay ?? 1;
      const payMonths = tenant.payMonths ?? 1;
      const isRentDay = rentDay === today || (rentDay === 0 && isLastDay);
      if (!isRentDay) continue;

      const existing = await this.billRepository.findOne({
        where: { roomId: tenant.roomId, tenantId: tenant.id, period: monthStr },
      });
      if (existing) continue;

      const room = await this.roomRepository.findOne({ where: { id: tenant.roomId } });
      if (!room) continue;

      const legacyFeeItems = await this.feeItemRepository.find({
        where: { roomId: room.id },
        order: { sortOrder: 'ASC' },
      });
      const feeItems = resolveFeeRules(tenant.feeRules, legacyFeeItems, Number(room.rent) || 0);

      const items: { feeName: string; amount: number }[] = [];
      let totalAmount = 0;
      let periodEnd = monthStr;

      if (feeItems.length > 0) {
        for (const fee of feeItems) {
          if (!fee.enabled) continue;
          const dueMonths = feeRuleDueMonths(fee, payMonths, tenant.moveInDate, monthStr);
          if (dueMonths === 0) continue;
          const amt = feeRuleAmountForMonths(fee, dueMonths);
          items.push({ feeName: fee.name, amount: amt });
          totalAmount += amt;
          if (fee.isRent) periodEnd = dayjs(monthStr + '-01').add(dueMonths - 1, 'month').format('YYYY-MM');
        }
      }

      // No fee is due in this month (for example rent quarterly and internet
      // half-yearly). Do not create an empty bill.
      if (items.length === 0) continue;

      const bill = this.billRepository.create({
        roomId: room.id,
        tenantId: tenant.id,
        period: monthStr,
        periodEnd,
        totalAmount,
        status: 0,
        photos: [],
        sentAt: new Date(),
      });
      const savedBill = await this.billRepository.save(bill);

      const billItems = items.map(item =>
        this.billItemRepository.create({
          billId: savedBill.id,
          feeName: item.feeName,
          amount: item.amount,
        }),
      );
      await this.billItemRepository.save(billItems);
      generated++;

      const landlord = await this.findLandlordByRoom(room.id);
      if (landlord) {
        const entry = landlordBillMap.get(landlord.id);
        if (entry) {
          entry.count++;
          entry.total += totalAmount;
        } else {
          landlordBillMap.set(landlord.id, { count: 1, total: totalAmount });
        }
      }
    }

    if (generated > 0) {
      this.logger.log(`Auto-generated ${generated} bills for ${monthStr}`);
    }

    const notify = await this.sendAutoBillNotifications(landlordBillMap);
    return { generated, ...notify };
  }

  /** 出账通知：账单生成后推送给房东 */
  private async sendAutoBillNotifications(
    landlordBillMap: Map<number, { count: number; total: number }>,
  ): Promise<{ sent: number; failed: number; skipped: number }> {
    if (landlordBillMap.size === 0) return { sent: 0, failed: 0, skipped: 0 };
    const templateId = rentTemplateId();

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const [landlordId, info] of landlordBillMap) {
      const landlord = await this.landlordRepository.findOne({ where: { id: landlordId } });
      if (!landlord) continue;
      if (!landlord.openId) { skipped++; continue; }

      const ok = await this.sendSubscribeMessage(
        landlord.openId,
        templateId,
        {
          thing1: { value: this.truncate('月度账单已生成') },
          thing2: { value: this.truncate(`共${info.count}间房待收租`) },
          amount3: { value: amountValue(info.total) },
        },
        'pages/rent-list/index',
      );
      if (ok) sent++; else failed++;
    }
    return { sent, failed, skipped };
  }

  /**
   * 收租提醒 — 每天 9:05
   */
  @Cron('5 9 * * *', CRON_TZ)
  async sendRentReminders(): Promise<{ sent: number; failed: number; skipped: number }> {
    if (!(await this.isAutoRemindEnabled())) {
      this.logger.log('enableAutoRemind=false, skip rent reminders');
      return { sent: 0, failed: 0, skipped: 0 };
    }
    const templateId = rentTemplateId();

    const now = dayjs();
    const today = now.date();
    const isLastDay = now.endOf('month').date() === today;
    const monthStr = now.format('YYYY-MM');

    const tenants = await this.tenantRepository.find({ where: { status: 1 } });

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const tenant of tenants) {
      const rentDay = tenant.rentDay ?? 1;
      const shouldNotify = rentDay === today || (rentDay === 0 && isLastDay);
      if (!shouldNotify) continue;

      const bill = await this.billRepository.findOne({
        where: { roomId: tenant.roomId, tenantId: tenant.id, period: monthStr },
      });
      if (!bill || bill.status !== 0) continue;

      const room = await this.roomRepository.findOne({ where: { id: tenant.roomId } });
      if (!room) continue;

      const landlord = await this.findLandlordByRoom(room.id);
      if (!landlord) continue;
      if (!landlord.openId) { skipped++; continue; }

      const propName = await this.getPropertyForRoom(room.id);
      const label = this.truncate(propName ? `${propName} ${room.name} ${tenant.name}` : `${tenant.name} - ${room.name}`);

      const ok = await this.sendSubscribeMessage(
        landlord.openId,
        templateId,
        {
          thing1: { value: label },
          thing2: { value: this.truncate(`${monthStr}月房租待收`) },
          amount3: { value: amountValue(bill.totalAmount) },
        },
        `pages/bill/index?roomId=${room.id}&billId=${bill.id}`,
      );
      if (ok) sent++; else failed++;
    }

    this.logger.log(`Rent reminders: sent=${sent}, failed=${failed}, skipped(no openId)=${skipped}`);
    return { sent, failed, skipped };
  }

  /**
   * 退租提醒 — 每天 9:30
   *
   * 场景：租客退租当天（moveOutDate 或 contractEndDate = 今天）
   * 提醒房东检查房屋、安排招租
   */
  @Cron('30 9 * * *', CRON_TZ)
  async sendMoveOutReminders(): Promise<{ sent: number; failed: number; skipped: number }> {
    if (!(await this.isAutoRemindEnabled())) {
      this.logger.log('enableAutoRemind=false, skip move-out reminders');
      return { sent: 0, failed: 0, skipped: 0 };
    }
    const templateId = rentTemplateId();

    const todayStr = dayjs().format('YYYY-MM-DD');

    // 已退租（status=0 且 moveOutDate=今天）
    const movedOut = await this.tenantRepository
      .createQueryBuilder('tenant')
      .where('tenant.move_out_date = :today', { today: todayStr })
      .andWhere('tenant.status = :status', { status: 0 })
      .getMany();

    // 合同到期但仍在住（status=1 且 contractEndDate=今天）
    const expiringActive = await this.tenantRepository
      .createQueryBuilder('tenant')
      .where('tenant.contract_end_date = :today', { today: todayStr })
      .andWhere('tenant.status = :status', { status: 1 })
      .getMany();

    const allTenants = [
      ...movedOut.map(t => ({ ...t, msg: '租客今日退租，请检查' })),
      ...expiringActive.map(t => ({ ...t, msg: '合同今日到期，确认退租' })),
    ];

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const tenant of allTenants) {
      const room = await this.roomRepository.findOne({ where: { id: tenant.roomId } });
      if (!room) continue;

      const landlord = await this.findLandlordByRoom(room.id);
      if (!landlord) continue;
      if (!landlord.openId) { skipped++; continue; }

      const propName = await this.getPropertyForRoom(room.id);
      const label = this.truncate(
        propName ? `${propName} ${room.name} ${tenant.name}` : `${tenant.name} - ${room.name}`,
      );

      const ok = await this.sendSubscribeMessage(
        landlord.openId,
        templateId,
        {
          thing1: { value: label },
          thing2: { value: this.truncate(tenant.msg) },
          amount3: { value: amountValue(tenant.deposit || 0) },
        },
        `pages/room-detail/index?roomId=${room.id}`,
      );
      if (ok) sent++; else failed++;
    }

    this.logger.log(`Move-out reminders: sent=${sent}, failed=${failed}, skipped(no openId)=${skipped}`);
    return { sent, failed, skipped };
  }

  /**
   * 逾期提醒 — 每天 10:05
   */
  @Cron('5 10 * * *', CRON_TZ)
  async sendOverdueReminders(): Promise<{ sent: number; failed: number; skipped: number }> {
    if (!(await this.isAutoRemindEnabled())) {
      this.logger.log('enableAutoRemind=false, skip overdue reminders');
      return { sent: 0, failed: 0, skipped: 0 };
    }
    const templateId = overdueTemplateId();

    const now = dayjs();
    const today = now.date();
    const currentMonth = now.month();
    const currentYear = now.year();

    const overdueBills = await this.billRepository
      .createQueryBuilder('bill')
      .leftJoinAndSelect('bill.tenant', 'tenant')
      .leftJoinAndSelect('bill.room', 'room')
      .where('bill.status IN (:...statuses)', { statuses: [0, 2] })
      .getMany();

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const bill of overdueBills) {
      if (!bill.tenant || !bill.room) continue;

      const rentDay = bill.tenant.rentDay ?? 1;
      // A prepaid bill is due in its collection month; coverage must not delay reminders.
      const effectivePeriod = bill.period;
      let dueDay: number;
      if (rentDay === 0) {
        dueDay = dayjs(effectivePeriod + '-01').endOf('month').date();
      } else {
        dueDay = rentDay;
      }

      const periodDate = dayjs(effectivePeriod + '-01');
      const billMonth = periodDate.month();
      const billYear = periodDate.year();

      let overdueDays = 0;
      if (billYear < currentYear || (billYear === currentYear && billMonth < currentMonth)) {
        const lastDayOfBillMonth = periodDate.endOf('month').date();
        overdueDays = now.diff(periodDate.date(lastDayOfBillMonth), 'day') + 1;
      } else if (billYear === currentYear && billMonth === currentMonth) {
        overdueDays = today - dueDay;
      }

      if (overdueDays <= 0) continue;

      // Notify on days 1, 3, 7, 14, 30 (the original cadence), then every 30
      // days thereafter (60, 90, 120, …) so a long-overdue bill isn't silently
      // forgotten once it crosses the 30-day mark.
      const earlyNotifyDays = [1, 3, 7, 14, 30];
      const shouldNotify =
        earlyNotifyDays.includes(overdueDays) ||
        (overdueDays > 30 && overdueDays % 30 === 0);
      if (!shouldNotify) continue;

      const landlord = await this.findLandlordByRoom(bill.room.id);
      if (!landlord) continue;
      if (!landlord.openId) { skipped++; continue; }

      const propName = await this.getPropertyForRoom(bill.room.id);
      const label = this.truncate(propName ? `${propName} ${bill.room.name} ${bill.tenant.name}` : `${bill.tenant.name} - ${bill.room.name}`);

      const contextMsg = overdueDays === 1
        ? `${bill.period}房租，如已收请标记`
        : `${bill.period}房租逾期${overdueDays}天`;

      const ok = await this.sendSubscribeMessage(
        landlord.openId,
        templateId,
        {
          thing1: { value: label },
          thing2: { value: this.truncate(contextMsg) },
          amount3: { value: amountValue(bill.totalAmount) },
        },
        `pages/bill/index?roomId=${bill.room.id}&billId=${bill.id}`,
      );
      if (ok) sent++; else failed++;
    }

    this.logger.log(`Overdue reminders: sent=${sent}, failed=${failed}, skipped(no openId)=${skipped}`);
    return { sent, failed, skipped };
  }

  /**
   * 合同到期提醒 — 每天 11:00
   */
  @Cron('0 11 * * *', CRON_TZ)
  async sendContractExpiryReminders(): Promise<{ sent: number; failed: number; skipped: number }> {
    if (!(await this.isAutoRemindEnabled())) {
      this.logger.log('enableAutoRemind=false, skip contract expiry reminders');
      return { sent: 0, failed: 0, skipped: 0 };
    }
    const templateId = rentTemplateId();

    const now = dayjs();
    const tenants = await this.tenantRepository.find({ where: { status: 1 } });

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const tenant of tenants) {
      if (!tenant.contractEndDate) continue;

      const endDate = dayjs(tenant.contractEndDate);
      const daysLeft = endDate.diff(now, 'day');

      const notifyAt = [30, 7, 0, -7];
      if (!notifyAt.includes(daysLeft)) continue;

      const room = await this.roomRepository.findOne({ where: { id: tenant.roomId } });
      if (!room) continue;

      const landlord = await this.findLandlordByRoom(room.id);
      if (!landlord) continue;
      if (!landlord.openId) { skipped++; continue; }

      const propName = await this.getPropertyForRoom(room.id);
      const label = this.truncate(propName ? `${propName} ${room.name} ${tenant.name}` : `${tenant.name} - ${room.name}`);

      let msg: string;
      if (daysLeft === 30) {
        msg = `合同30天后到期，联系确认续租`;
      } else if (daysLeft === 7) {
        msg = `合同即将到期，续签或退租`;
      } else if (daysLeft === 0) {
        msg = `合同今天到期，请确认处理`;
      } else {
        msg = `合同已过期${Math.abs(daysLeft)}天，尽快处理`;
      }

      // amount-type fields only accept numbers — the day count goes here, the
      // unit is already spelled out in thing2.
      const ok = await this.sendSubscribeMessage(
        landlord.openId,
        templateId,
        {
          thing1: { value: label },
          thing2: { value: this.truncate(msg) },
          amount3: { value: `${daysLeft >= 0 ? daysLeft : 0}` },
        },
        `pages/room-detail/index?roomId=${room.id}`,
      );
      if (ok) sent++; else failed++;
    }

    this.logger.log(`Contract expiry reminders: sent=${sent}, failed=${failed}, skipped(no openId)=${skipped}`);
    return { sent, failed, skipped };
  }

  /**
   * 空置提醒 — 每天 11:30
   *
   * 场景：房间空置 7/14/30 天，提醒房东尽快招租
   * 通过最近退租租客的 moveOutDate 计算空置天数
   */
  @Cron('30 11 * * *', CRON_TZ)
  async sendVacancyReminders(): Promise<{ sent: number; failed: number; skipped: number }> {
    if (!(await this.isAutoRemindEnabled())) {
      this.logger.log('enableAutoRemind=false, skip vacancy reminders');
      return { sent: 0, failed: 0, skipped: 0 };
    }
    const templateId = rentTemplateId();

    const now = dayjs();
    const rooms = await this.roomRepository.find();

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const room of rooms) {
      // 有在租租客则跳过
      const activeTenant = await this.tenantRepository.findOne({
        where: { roomId: room.id, status: 1 },
      });
      if (activeTenant) continue;

      // 找最近退租的租客来计算空置天数
      const lastTenant = await this.tenantRepository.findOne({
        where: { roomId: room.id, status: 0 },
        order: { moveOutDate: 'DESC' },
      });

      let vacantSince: dayjs.Dayjs;
      if (lastTenant?.moveOutDate) {
        vacantSince = dayjs(lastTenant.moveOutDate);
      } else if (lastTenant?.contractEndDate) {
        vacantSince = dayjs(lastTenant.contractEndDate);
      } else if (lastTenant) {
        vacantSince = dayjs(lastTenant.updatedAt);
      } else {
        continue; // 从未有过租客，跳过
      }

      const vacantDays = now.diff(vacantSince, 'day');
      if (vacantDays <= 0) continue;

      const notifyDays = [7, 14, 30];
      if (!notifyDays.includes(vacantDays)) continue;

      const landlord = await this.findLandlordByRoom(room.id);
      if (!landlord) continue;
      if (!landlord.openId) { skipped++; continue; }

      const propName = await this.getPropertyForRoom(room.id);
      const label = this.truncate(propName ? `${propName} ${room.name}` : room.name);
      const rent = Number(room.rent) || 0;

      const ok = await this.sendSubscribeMessage(
        landlord.openId,
        templateId,
        {
          thing1: { value: label },
          thing2: { value: this.truncate(`已空置${vacantDays}天，尽快招租`) },
          amount3: { value: amountValue(rent) },
        },
        `pages/room-detail/index?roomId=${room.id}`,
      );
      if (ok) sent++; else failed++;
    }

    this.logger.log(`Vacancy reminders: sent=${sent}, failed=${failed}, skipped(no openId)=${skipped}`);
    return { sent, failed, skipped };
  }

  /**
   * 月度收租汇总 — 每天 20:00（仅月末最后一天执行）
   *
   * 场景：月底给房东发当月收租汇总
   */
  @Cron('0 20 * * *', CRON_TZ)
  async sendMonthlySummary(): Promise<{ sent: number; failed: number; skipped: number }> {
    if (!(await this.isAutoRemindEnabled())) {
      this.logger.log('enableAutoRemind=false, skip monthly summary');
      return { sent: 0, failed: 0, skipped: 0 };
    }
    const now = dayjs();
    const isLastDay = now.endOf('month').date() === now.date();
    if (!isLastDay) return { sent: 0, failed: 0, skipped: 0 };

    const templateId = rentTemplateId();

    const monthStr = now.format('YYYY-MM');
    const landlords = await this.landlordRepository.find();

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const landlord of landlords) {
      if (!landlord.openId) { skipped++; continue; }

      const properties = await this.propertyRepository.find({
        where: { landlordId: landlord.id },
      });
      if (properties.length === 0) continue;

      const propertyIds = properties.map(p => p.id);
      const rooms = await this.roomRepository.find({
        where: { propertyId: In(propertyIds) },
      });
      if (rooms.length === 0) continue;

      const roomIds = rooms.map(r => r.id);

      const bills = await this.billRepository
        .createQueryBuilder('bill')
        .where('bill.roomId IN (:...roomIds)', { roomIds })
        .andWhere('bill.period = :period', { period: monthStr })
        .andWhere('bill.status != :cancelled', { cancelled: 4 })
        .getMany();

      if (bills.length === 0) continue;

      const totalExpected = bills.reduce((sum, b) => sum + Number(b.totalAmount), 0);
      // status: 0=未收, 1=已收, 2=逾期, 3=部分付款
      // For collected amount: full bills contribute totalAmount, partial bills contribute paidAmount only
      const totalCollected = bills.reduce((sum, b) => {
        if (b.status === 1) return sum + Number(b.totalAmount);
        if (b.status === 3) return sum + (Number(b.paidAmount) || 0);
        return sum;
      }, 0);
      const paidBills = bills.filter(b => b.status === 1 || b.status === 3);
      const unpaidCount = bills.filter(b => b.status === 0 || b.status === 2).length;

      const ok = await this.sendSubscribeMessage(
        landlord.openId,
        templateId,
        {
          thing1: { value: this.truncate(`${monthStr}月收租汇总`) },
          thing2: { value: this.truncate(`已收${paidBills.length}间 未收${unpaidCount}间`) },
          amount3: { value: amountValue(totalCollected) },
        },
        'pages/rent-stats/index',
      );
      if (ok) sent++; else failed++;
    }

    this.logger.log(`Monthly summary: sent=${sent}, failed=${failed}, skipped(no openId)=${skipped}`);
    return { sent, failed, skipped };
  }

  /** API: manually trigger auto bill generation */
  async triggerAutoBills(): Promise<{ generated: number; sent: number; failed: number; skipped: number }> {
    return this.autoGenerateBills();
  }

  /** API: manually trigger rent reminder */
  async triggerRentReminder(): Promise<{ sent: number; failed: number; skipped: number }> {
    return this.sendRentReminders();
  }

  /** API: manually trigger overdue reminder */
  async triggerOverdueReminder(): Promise<{ sent: number; failed: number; skipped: number }> {
    return this.sendOverdueReminders();
  }

  /** API: manually trigger contract expiry reminder */
  async triggerContractExpiry(): Promise<{ sent: number; failed: number; skipped: number }> {
    return this.sendContractExpiryReminders();
  }

  /** API: manually trigger move-out reminder */
  async triggerMoveOutReminder(): Promise<{ sent: number; failed: number; skipped: number }> {
    return this.sendMoveOutReminders();
  }

  /** API: manually trigger vacancy reminder */
  async triggerVacancyReminder(): Promise<{ sent: number; failed: number; skipped: number }> {
    return this.sendVacancyReminders();
  }

  /** API: manually trigger monthly summary */
  async triggerMonthlySummary(): Promise<{ sent: number; failed: number; skipped: number }> {
    return this.sendMonthlySummary();
  }
}
