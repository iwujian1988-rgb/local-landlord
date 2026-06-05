import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentQr } from './payment-qr.entity';
import { UpdatePaymentQrDto } from './dto/update-payment-qr.dto';

@Injectable()
export class PaymentQrService {
  constructor(
    @InjectRepository(PaymentQr)
    private readonly paymentQrRepository: Repository<PaymentQr>,
  ) {}

  /** 获取收款码列表 */
  async findAll(landlordId: number): Promise<PaymentQr[]> {
    return this.paymentQrRepository.find({
      where: { landlordId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  /** 上传收款码 */
  async upload(
    landlordId: number,
    data: { type: number; imageUrl: string; payeeName: string; note?: string },
  ): Promise<PaymentQr> {
    const qr = this.paymentQrRepository.create({
      landlordId,
      type: data.type,
      imageUrl: data.imageUrl,
      payeeName: data.payeeName,
      note: data.note || '',
      isDefault: 0,
    });
    return this.paymentQrRepository.save(qr);
  }

  /** 更新收款码 */
  async update(id: number, dto: UpdatePaymentQrDto): Promise<PaymentQr> {
    const qr = await this.paymentQrRepository.findOne({ where: { id } });
    if (!qr) throw new NotFoundException('收款码不存在');
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
