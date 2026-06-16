import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentQr } from './payment-qr.entity';
import { UpdatePaymentQrDto } from './dto/update-payment-qr.dto';
import { Landlord } from '../landlord/landlord.entity';

const TYPE_MAP: Record<number, string> = { 0: 'wechat', 1: 'alipay', 2: 'bank' };

@Injectable()
export class PaymentQrService {
  constructor(
    @InjectRepository(PaymentQr)
    private readonly paymentQrRepository: Repository<PaymentQr>,
    @InjectRepository(Landlord)
    private readonly landlordRepository: Repository<Landlord>,
  ) {}

  /** Verify payment QR belongs to landlord */
  async verifyOwnership(id: number, landlordId: number): Promise<void> {
    const qr = await this.paymentQrRepository.findOne({ where: { id } });
    if (!qr) throw new NotFoundException('收款码不存在');
    if (qr.landlordId !== landlordId) {
      throw new ForbiddenException('无权操作该收款码');
    }
  }

  /** 获取收款码列表 (API contract shape) */
  async findAll(landlordId: number) {
    const codes = await this.paymentQrRepository.find({
      where: { landlordId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });

    const landlord = await this.landlordRepository.findOne({ where: { id: landlordId } });

    return {
      codes: codes.map(c => ({
        id: c.id,
        type: TYPE_MAP[c.type] || 'wechat',
        imageUrl: c.imageUrl,
        isDefault: !!c.isDefault,
        payeeName: c.payeeName || '',
        note: c.note || '',
      })),
      // payeeName/payeeNote live on the landlord, not per-QR — return the real
      // values so the qr-code page can pre-fill the form.
      payeeName: landlord?.defaultPayeeName || '',
      payeeNote: landlord?.paymentNote || '',
    };
  }

  /** 上传收款码 */
  async upload(
    landlordId: number,
    data: { type: number; imageUrl: string; payeeName: string; note?: string; isDefault?: number },
  ): Promise<PaymentQr> {
    const qr = this.paymentQrRepository.create({
      landlordId,
      type: data.type,
      imageUrl: data.imageUrl,
      payeeName: data.payeeName,
      note: data.note || '',
      isDefault: data.isDefault || 0,
    });
    return this.paymentQrRepository.save(qr);
  }

  /** 更新收款码 */
  async update(id: number, dto: UpdatePaymentQrDto): Promise<PaymentQr> {
    const qr = await this.paymentQrRepository.findOne({ where: { id } });
    if (!qr) throw new NotFoundException('收款码不存在');
    if (dto.payeeNote !== undefined) {
      dto.note = dto.payeeNote;
      delete (dto as any).payeeNote;
    }
    if (dto.isDefault !== undefined) {
      qr.isDefault = dto.isDefault ? 1 : 0;
      delete (dto as any).isDefault;
    }
    Object.assign(qr, dto);
    return this.paymentQrRepository.save(qr);
  }

  /** 设置默认收款码 */
  async setDefault(id: number, landlordId: number): Promise<PaymentQr> {
    const qr = await this.paymentQrRepository.findOne({ where: { id } });
    if (!qr) throw new NotFoundException('收款码不存在');

    // 先取消其他默认
    await this.paymentQrRepository.update(
      { landlordId, isDefault: 1 },
      { isDefault: 0 },
    );

    // 设置当前为默认
    qr.isDefault = 1;
    return this.paymentQrRepository.save(qr);
  }

  /** 删除收款码 */
  async remove(id: number): Promise<void> {
    const qr = await this.paymentQrRepository.findOne({ where: { id } });
    if (!qr) throw new NotFoundException('收款码不存在');
    await this.paymentQrRepository.remove(qr);
  }
}
