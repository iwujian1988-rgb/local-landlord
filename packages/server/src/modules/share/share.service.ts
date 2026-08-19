import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bill } from '../bill/bill.entity';
import { BillItem } from '../bill/bill-item.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Room } from '../room/room.entity';
import { Property } from '../property/property.entity';
import { Landlord } from '../landlord/landlord.entity';
import { PaymentQr } from '../payment-qr/payment-qr.entity';
import { SingleCharge } from '../rent/single-charge.entity';

const SHARE_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const SHARE_TOKEN_KIND = 'share-bill-v1';
const SHARE_TOKEN_KIND_SINGLE = 'share-single-v1';

export interface ShareBillPayload {
  roomName: string;
  tenantName: string;
  period: string;
  periodEnd?: string | null;
  items: { name: string; amount: number }[];
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  isPaid: boolean;
  qrCodes: { type: string; imageUrl: string; payeeName: string }[];
  payeeName: string;
  landlordName: string;
  paymentNote: string;
}

@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);

  constructor(
    private readonly jwtService: JwtService,
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
    @InjectRepository(PaymentQr)
    private readonly paymentQrRepository: Repository<PaymentQr>,
    @InjectRepository(SingleCharge)
    private readonly singleChargeRepository: Repository<SingleCharge>,
  ) {}

  /**
   * Generate a stateless share token for a bill.
   * Caller must have already verified ownership.
   */
  async generateForBill(billId: number): Promise<{ token: string; expiresAt: string }> {
    const bill = await this.billRepository.findOne({ where: { id: billId } });
    if (!bill) throw new NotFoundException('账单不存在');

    // Use expiresIn option only; jsonwebtoken will compute and inject `exp` into the payload.
    // Passing both `exp` in payload AND `expiresIn` option throws.
    const token = this.jwtService.sign(
      { bid: bill.id, kind: SHARE_TOKEN_KIND },
      { expiresIn: SHARE_TOKEN_TTL_SECONDS },
    );

    const expiresAt = Math.floor(Date.now() / 1000) + SHARE_TOKEN_TTL_SECONDS;
    return { token, expiresAt: new Date(expiresAt * 1000).toISOString() };
  }

  /**
   * Generate a stateless share token for a single_charge (水电维修等单独收款).
   * Caller must have already verified ownership.
   */
  async generateForSingleCharge(singleChargeId: number): Promise<{ token: string; expiresAt: string }> {
    const charge = await this.singleChargeRepository.findOne({ where: { id: singleChargeId } });
    if (!charge) throw new NotFoundException('收款记录不存在');

    const token = this.jwtService.sign(
      { sid: charge.id, kind: SHARE_TOKEN_KIND_SINGLE },
      { expiresIn: SHARE_TOKEN_TTL_SECONDS },
    );

    const expiresAt = Math.floor(Date.now() / 1000) + SHARE_TOKEN_TTL_SECONDS;
    return { token, expiresAt: new Date(expiresAt * 1000).toISOString() };
  }

  /**
   * Resolve a share token to bill data for public H5 rendering.
   * No JWT auth — anyone with the token can view (token acts as capability).
   * Dispatches between SHARE_TOKEN_KIND (bill) and SHARE_TOKEN_KIND_SINGLE (single_charge).
   */
  async resolveBill(token: string): Promise<ShareBillPayload> {
    let payload: { bid?: number; sid?: number; kind: string };
    try {
      payload = this.jwtService.verify(token);
    } catch (err) {
      throw new ForbiddenException('链接已失效或不可用，请向房东索取新链接');
    }

    if (payload.kind === SHARE_TOKEN_KIND_SINGLE && payload.sid) {
      return this.resolveSingleCharge(payload.sid);
    }

    if (payload.kind !== SHARE_TOKEN_KIND || !payload.bid) {
      throw new BadRequestException('无效的账单链接');
    }

    const bill = await this.billRepository.findOne({
      where: { id: payload.bid },
      relations: ['items', 'tenant', 'room'],
    });
    if (!bill) throw new NotFoundException('账单不存在');
    if (bill.status === 4) throw new ForbiddenException('账单已取消，请勿付款');

    const room = bill.room;
    if (!room) throw new NotFoundException('房间信息缺失');

    const property = await this.propertyRepository.findOne({ where: { id: room.propertyId } });
    if (!property) throw new NotFoundException('房源信息缺失');

    const landlord = await this.landlordRepository.findOne({ where: { id: property.landlordId } });
    if (!landlord) throw new NotFoundException('房东信息缺失');
    if (landlord.status === 0) {
      throw new ForbiddenException('该账户已被注销，账单链接失效');
    }

    const qrCodes = await this.paymentQrRepository.find({
      where: { landlordId: landlord.id },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });

    const TYPE_MAP: Record<number, string> = { 0: 'wechat', 1: 'alipay', 2: 'bank' };

    const items = (bill.items || []).map(it => ({
      name: it.feeName,
      amount: this.money(it.amount),
    }));
    const storedTotal = this.money(bill.totalAmount);
    const itemTotal = this.money(items.reduce((sum, item) => sum + item.amount, 0));
    const totalAmount = items.length > 0 ? itemTotal : storedTotal;
    if (items.length > 0 && Math.abs(storedTotal - itemTotal) > 0.009) {
      this.logger.error(`账单 ${bill.id} 金额不一致: total=${storedTotal}, items=${itemTotal}`);
    }
    const rawPaid = bill.status === 1 ? totalAmount : this.money(bill.paidAmount);
    const paidAmount = this.money(Math.min(totalAmount, rawPaid));
    const outstandingAmount = this.money(Math.max(0, totalAmount - paidAmount));

    return {
      roomName: room.name,
      tenantName: bill.tenant?.name || '',
      period: bill.period,
      periodEnd: bill.periodEnd,
      items: items.length > 0 ? items : [{ name: '应收费用', amount: storedTotal }],
      totalAmount,
      paidAmount,
      outstandingAmount,
      isPaid: outstandingAmount <= 0,
      qrCodes: qrCodes
        .filter(q => q.imageUrl)
        .map(q => ({
          type: TYPE_MAP[q.type] || 'wechat',
          imageUrl: q.imageUrl,
          payeeName: landlord.defaultPayeeName || q.payeeName || landlord.name || '',
        })),
      payeeName: landlord.defaultPayeeName || landlord.name || '',
      landlordName: landlord.name || '',
      paymentNote: landlord.paymentNote || '',
    };
  }

  /**
   * Resolve a single_charge to the same ShareBillPayload shape so the H5
   * BillPage can render it without modification. Maps feeType → items[0].name,
   * amount → totalAmount, period → feeType (so the H5 header reads "水费 账单"
   * instead of trying to format a fake YYYY-MM period).
   */
  private async resolveSingleCharge(singleChargeId: number): Promise<ShareBillPayload> {
    const charge = await this.singleChargeRepository.findOne({
      where: { id: singleChargeId },
      relations: ['tenant', 'room'],
    });
    if (!charge) throw new NotFoundException('收款记录不存在');

    const room = charge.room;
    if (!room) throw new NotFoundException('房间信息缺失');

    const property = await this.propertyRepository.findOne({ where: { id: room.propertyId } });
    if (!property) throw new NotFoundException('房源信息缺失');

    const landlord = await this.landlordRepository.findOne({ where: { id: property.landlordId } });
    if (!landlord) throw new NotFoundException('房东信息缺失');
    if (landlord.status === 0) {
      throw new ForbiddenException('该账户已被注销，账单链接失效');
    }

    const qrCodes = await this.paymentQrRepository.find({
      where: { landlordId: landlord.id },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });

    const TYPE_MAP: Record<number, string> = { 0: 'wechat', 1: 'alipay', 2: 'bank' };
    const amount = this.money(charge.amount);
    const isPaid = charge.status === 1;

    return {
      roomName: room.name,
      tenantName: charge.tenant?.name || '',
      // Use feeType as period — H5 formats it as "{period} 账单" → "水费 账单".
      // formatPeriod returns the string as-is when it doesn't match YYYY-MM.
      period: charge.feeType,
      items: [{ name: charge.feeType, amount }],
      totalAmount: amount,
      paidAmount: isPaid ? amount : 0,
      outstandingAmount: isPaid ? 0 : amount,
      isPaid,
      qrCodes: qrCodes
        .filter(q => q.imageUrl)
        .map(q => ({
          type: TYPE_MAP[q.type] || 'wechat',
          imageUrl: q.imageUrl,
          payeeName: landlord.defaultPayeeName || q.payeeName || landlord.name || '',
        })),
      payeeName: landlord.defaultPayeeName || landlord.name || '',
      landlordName: landlord.name || '',
      paymentNote: charge.note || landlord.paymentNote || '',
    };
  }

  private money(value: unknown): number {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    return Math.round(amount * 100) / 100;
  }
}
