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
  ) {}

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
    const resp = await fetch(url);
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
  @Cron('0 8 * * *')
  async autoGenerateBills(): Promise<void> {
    const now = dayjs();
    const today = now.date();
    const isLastDay = now.endOf('month').date() === today;
    const monthStr = now.format('YYYY-MM');
    const currentMonth = now.month();
    const currentYear = now.year();

    const tenants = await this.tenantRepository.find({ where: { status: 1 } });

    let generated = 0;
    const landlordBillMap = new Map<number, { count: number; total: number }>();

    for (const tenant of tenants) {
      const rentDay = tenant.rentDay ?? 1;
      const payMonths = tenant.payMonths ?? 1;
      const isRentDay = rentDay === today || (rentDay === 0 && isLastDay);
      if (!isRentDay) continue;

      // Cycle check for multi-month tenants (押X付Y where Y > 1):
      // only generate on months where (monthsSinceMoveIn % payMonths === 0)
      if (payMonths > 1 && tenant.moveInDate) {
        const moveIn = dayjs(tenant.moveInDate);
        const monthsSinceMoveIn = (currentYear - moveIn.year()) * 12 + (currentMonth - moveIn.month());
        if (monthsSinceMoveIn < 0) continue;
        if (monthsSinceMoveIn % payMonths !== 0) continue;
      }

      const existing = await this.billRepository.findOne({
        where: { roomId: tenant.roomId, period: monthStr },
      });
      if (existing) continue;

      const room = await this.roomRepository.findOne({ where: { id: tenant.roomId } });
      if (!room) continue;

      const feeItems = await this.feeItemRepository.find({
        where: { roomId: room.id },
        order: { sortOrder: 'ASC' },
      });

      const items: { feeName: string; amount: number }[] = [];
      let totalAmount = 0;

      if (feeItems.length > 0) {
        for (const fee of feeItems) {
          if (!fee.enabled) continue;
          const baseAmt = Number(fee.amount) || 0;
          // Fixed items (房租, fixed网费 etc.) get multiplied by payMonths to
          // collect for the whole cycle upfront. Manual items (水电, 维修)
          // start at 0 — landlord fills in actual values before sending.
          const amt = fee.type === 0 ? baseAmt * payMonths : 0;
          items.push({ feeName: fee.name, amount: amt });
          totalAmount += amt;
        }
      }

      if (items.length === 0) {
        const rent = Number(room.rent) || 0;
        items.push({ feeName: '房租', amount: rent * payMonths });
        totalAmount = rent * payMonths;
      }

      const periodEnd = dayjs(monthStr + '-01').add(payMonths - 1, 'month').format('YYYY-MM');

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

    await this.sendAutoBillNotifications(landlordBillMap);
  }

  /** 出账通知：账单生成后推送给房东 */
  private async sendAutoBillNotifications(
    landlordBillMap: Map<number, { count: number; total: number }>,
  ): Promise<void> {
    const templateId = process.env.WX_SUBSCRIBE_TEMPLATE_RENT;
    if (!templateId || landlordBillMap.size === 0) return;

    for (const [landlordId, info] of landlordBillMap) {
      const landlord = await this.landlordRepository.findOne({ where: { id: landlordId } });
      if (!landlord || !landlord.openId) continue;

      await this.sendSubscribeMessage(
        landlord.openId,
        templateId,
        {
          thing1: { value: this.truncate('月度账单已生成') },
          thing2: { value: this.truncate(`共${info.count}间房待收租`) },
          amount3: { value: `${info.total}元` },
        },
        'pages/rent-list/index',
      );
    }
  }

  /**
   * 收租提醒 — 每天 9:05
   */
  @Cron('5 9 * * *')
  async sendRentReminders(): Promise<void> {
    const templateId = process.env.WX_SUBSCRIBE_TEMPLATE_RENT;
    if (!templateId) {
      this.logger.warn('WX_SUBSCRIBE_TEMPLATE_RENT not configured, skip');
      return;
    }

    const now = dayjs();
    const today = now.date();
    const isLastDay = now.endOf('month').date() === today;
    const monthStr = now.format('YYYY-MM');
    const currentMonth = now.month();
    const currentYear = now.year();

    const tenants = await this.tenantRepository.find({ where: { status: 1 } });

    for (const tenant of tenants) {
      const rentDay = tenant.rentDay ?? 1;
      const payMonths = tenant.payMonths ?? 1;
      const shouldNotify = rentDay === today || (rentDay === 0 && isLastDay);
      if (!shouldNotify) continue;

      // Skip non-cycle months for multi-month tenants
      if (payMonths > 1 && tenant.moveInDate) {
        const moveIn = dayjs(tenant.moveInDate);
        const monthsSinceMoveIn = (currentYear - moveIn.year()) * 12 + (currentMonth - moveIn.month());
        if (monthsSinceMoveIn < 0) continue;
        if (monthsSinceMoveIn % payMonths !== 0) continue;
      }

      const bill = await this.billRepository.findOne({
        where: { roomId: tenant.roomId, period: monthStr },
      });
      if (!bill || bill.status !== 0) continue;

      const room = await this.roomRepository.findOne({ where: { id: tenant.roomId } });
      if (!room) continue;

      const landlord = await this.findLandlordByRoom(room.id);
      if (!landlord || !landlord.openId) continue;

      const propName = await this.getPropertyForRoom(room.id);
      const label = this.truncate(propName ? `${propName} ${room.name} ${tenant.name}` : `${tenant.name} - ${room.name}`);

      await this.sendSubscribeMessage(
        landlord.openId,
        templateId,
        {
          thing1: { value: label },
          thing2: { value: this.truncate(`${monthStr}月房租待收`) },
          amount3: { value: `${bill.totalAmount}元` },
        },
        `pages/bill/index?roomId=${room.id}&billId=${bill.id}`,
      );
    }

    this.logger.log('Rent reminders sent');
  }

  /**
   * 退租提醒 — 每天 9:30
   *
   * 场景：租客退租当天（moveOutDate 或 contractEndDate = 今天）
   * 提醒房东检查房屋、安排招租
   */
  @Cron('30 9 * * *')
  async sendMoveOutReminders(): Promise<void> {
    const templateId = process.env.WX_SUBSCRIBE_TEMPLATE_RENT;
    if (!templateId) {
      this.logger.warn('WX_SUBSCRIBE_TEMPLATE_RENT not configured, skip move-out');
      return;
    }

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

    for (const tenant of allTenants) {
      const room = await this.roomRepository.findOne({ where: { id: tenant.roomId } });
      if (!room) continue;

      const landlord = await this.findLandlordByRoom(room.id);
      if (!landlord || !landlord.openId) continue;

      const propName = await this.getPropertyForRoom(room.id);
      const label = this.truncate(
        propName ? `${propName} ${room.name} ${tenant.name}` : `${tenant.name} - ${room.name}`,
      );

      await this.sendSubscribeMessage(
        landlord.openId,
        templateId,
        {
          thing1: { value: label },
          thing2: { value: this.truncate(tenant.msg) },
          amount3: { value: `${tenant.deposit || 0}元` },
        },
        `pages/room-detail/index?roomId=${room.id}`,
      );
    }

    this.logger.log('Move-out reminders sent');
  }

  /**
   * 逾期提醒 — 每天 10:05
   */
  @Cron('5 10 * * *')
  async sendOverdueReminders(): Promise<void> {
    const templateId = process.env.WX_SUBSCRIBE_TEMPLATE_OVERDUE;
    if (!templateId) {
      this.logger.warn('WX_SUBSCRIBE_TEMPLATE_OVERDUE not configured, skip');
      return;
    }

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

    for (const bill of overdueBills) {
      if (!bill.tenant || !bill.room) continue;

      const rentDay = bill.tenant.rentDay ?? 1;
      // Use periodEnd (if set) for overdue detection — multi-month bills cover
      // through this month. Old bills fall back to period (single-month).
      const effectivePeriod = bill.periodEnd || bill.period;
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

      const notifyDays = [1, 3, 7, 14, 30];
      if (!notifyDays.includes(overdueDays)) continue;

      const landlord = await this.findLandlordByRoom(bill.room.id);
      if (!landlord || !landlord.openId) continue;

      const propName = await this.getPropertyForRoom(bill.room.id);
      const label = this.truncate(propName ? `${propName} ${bill.room.name} ${bill.tenant.name}` : `${bill.tenant.name} - ${bill.room.name}`);

      const contextMsg = overdueDays === 1
        ? `${bill.period}房租，如已收请标记`
        : `${bill.period}房租逾期${overdueDays}天`;

      await this.sendSubscribeMessage(
        landlord.openId,
        templateId,
        {
          thing1: { value: label },
          thing2: { value: this.truncate(contextMsg) },
          amount3: { value: `${bill.totalAmount}元` },
        },
        `pages/bill/index?roomId=${bill.room.id}&billId=${bill.id}`,
      );
    }

    this.logger.log('Overdue reminders sent');
  }

  /**
   * 合同到期提醒 — 每天 11:00
   */
  @Cron('0 11 * * *')
  async sendContractExpiryReminders(): Promise<void> {
    const templateId = process.env.WX_SUBSCRIBE_TEMPLATE_RENT;
    if (!templateId) {
      this.logger.warn('WX_SUBSCRIBE_TEMPLATE_RENT not configured, skip contract expiry');
      return;
    }

    const now = dayjs();
    const tenants = await this.tenantRepository.find({ where: { status: 1 } });

    for (const tenant of tenants) {
      if (!tenant.contractEndDate) continue;

      const endDate = dayjs(tenant.contractEndDate);
      const daysLeft = endDate.diff(now, 'day');

      const notifyAt = [30, 7, 0, -7];
      if (!notifyAt.includes(daysLeft)) continue;

      const room = await this.roomRepository.findOne({ where: { id: tenant.roomId } });
      if (!room) continue;

      const landlord = await this.findLandlordByRoom(room.id);
      if (!landlord || !landlord.openId) continue;

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

      await this.sendSubscribeMessage(
        landlord.openId,
        templateId,
        {
          thing1: { value: label },
          thing2: { value: this.truncate(msg) },
          amount3: { value: `${daysLeft >= 0 ? daysLeft : 0}天` },
        },
        `pages/room-detail/index?roomId=${room.id}`,
      );
    }

    this.logger.log('Contract expiry reminders sent');
  }

  /**
   * 空置提醒 — 每天 11:30
   *
   * 场景：房间空置 7/14/30 天，提醒房东尽快招租
   * 通过最近退租租客的 moveOutDate 计算空置天数
   */
  @Cron('30 11 * * *')
  async sendVacancyReminders(): Promise<void> {
    const templateId = process.env.WX_SUBSCRIBE_TEMPLATE_RENT;
    if (!templateId) {
      this.logger.warn('WX_SUBSCRIBE_TEMPLATE_RENT not configured, skip vacancy');
      return;
    }

    const now = dayjs();
    const rooms = await this.roomRepository.find();

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
      if (!landlord || !landlord.openId) continue;

      const propName = await this.getPropertyForRoom(room.id);
      const label = this.truncate(propName ? `${propName} ${room.name}` : room.name);
      const rent = Number(room.rent) || 0;

      await this.sendSubscribeMessage(
        landlord.openId,
        templateId,
        {
          thing1: { value: label },
          thing2: { value: this.truncate(`已空置${vacantDays}天，尽快招租`) },
          amount3: { value: `${rent}元` },
        },
        `pages/room-detail/index?roomId=${room.id}`,
      );
    }

    this.logger.log('Vacancy reminders sent');
  }

  /**
   * 月度收租汇总 — 每天 20:00（仅月末最后一天执行）
   *
   * 场景：月底给房东发当月收租汇总
   */
  @Cron('0 20 * * *')
  async sendMonthlySummary(): Promise<void> {
    const now = dayjs();
    const isLastDay = now.endOf('month').date() === now.date();
    if (!isLastDay) return;

    const templateId = process.env.WX_SUBSCRIBE_TEMPLATE_RENT;
    if (!templateId) {
      this.logger.warn('WX_SUBSCRIBE_TEMPLATE_RENT not configured, skip monthly summary');
      return;
    }

    const monthStr = now.format('YYYY-MM');
    const landlords = await this.landlordRepository.find();

    for (const landlord of landlords) {
      if (!landlord.openId) continue;

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
        .getMany();

      if (bills.length === 0) continue;

      const totalExpected = bills.reduce((sum, b) => sum + Number(b.totalAmount), 0);
      // status: 0=未收, 1=已收, 2=逾期, 3=部分付款
      // For collected amount: full bills contribute totalAmount, partial bills contribute paidAmount only
      const totalCollected = bills.reduce((sum, b) => {
        if (b.status === 1 || b.status === 2) return sum + Number(b.totalAmount);
        if (b.status === 3) return sum + (Number(b.paidAmount) || 0);
        return sum;
      }, 0);
      const paidBills = bills.filter(b => b.status === 1 || b.status === 3);
      const unpaidCount = bills.filter(b => b.status === 0 || b.status === 2).length;

      await this.sendSubscribeMessage(
        landlord.openId,
        templateId,
        {
          thing1: { value: this.truncate(`${monthStr}月收租汇总`) },
          thing2: { value: this.truncate(`已收${paidBills.length}间 未收${unpaidCount}间`) },
          amount3: { value: `${totalCollected}元` },
        },
        'pages/rent-stats/index',
      );
    }

    this.logger.log('Monthly summary sent');
  }

  /** API: manually trigger auto bill generation */
  async triggerAutoBills(): Promise<{ generated: number }> {
    await this.autoGenerateBills();
    return { generated: -1 };
  }

  /** API: manually trigger rent reminder */
  async triggerRentReminder(): Promise<{ sent: boolean }> {
    await this.sendRentReminders();
    return { sent: true };
  }

  /** API: manually trigger overdue reminder */
  async triggerOverdueReminder(): Promise<{ sent: boolean }> {
    await this.sendOverdueReminders();
    return { sent: true };
  }

  /** API: manually trigger contract expiry reminder */
  async triggerContractExpiry(): Promise<{ sent: boolean }> {
    await this.sendContractExpiryReminders();
    return { sent: true };
  }

  /** API: manually trigger move-out reminder */
  async triggerMoveOutReminder(): Promise<{ sent: boolean }> {
    await this.sendMoveOutReminders();
    return { sent: true };
  }

  /** API: manually trigger vacancy reminder */
  async triggerVacancyReminder(): Promise<{ sent: boolean }> {
    await this.sendVacancyReminders();
    return { sent: true };
  }

  /** API: manually trigger monthly summary */
  async triggerMonthlySummary(): Promise<{ sent: boolean }> {
    await this.sendMonthlySummary();
    return { sent: true };
  }
}
