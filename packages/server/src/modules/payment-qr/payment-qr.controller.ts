import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { PaymentQrService } from './payment-qr.service';
import { CreatePaymentQrDto } from './dto/create-payment-qr.dto';
import { UpdatePaymentQrDto } from './dto/update-payment-qr.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const TYPE_STR_MAP: Record<string, number> = { wechat: 0, alipay: 1, bank: 2 };

@Controller('payment-qr')
@UseGuards(JwtAuthGuard)
export class PaymentQrController {
  constructor(private readonly paymentQrService: PaymentQrService) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.paymentQrService.findAll(user.id);
  }

  @Post()
  async upload(
    @CurrentUser() user: any,
    @Body() dto: CreatePaymentQrDto,
  ) {
    const typeNum = dto.typeNum ?? (dto.type ? TYPE_STR_MAP[dto.type] : undefined) ?? 0;
    const note = dto.payeeNote || dto.note || '';
    return this.paymentQrService.upload(user.id, {
      type: typeNum,
      imageUrl: dto.imageUrl || '',
      payeeName: dto.payeeName || '',
      note,
      isDefault: dto.isDefault ? 1 : 0,
    });
  }

  @Put(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaymentQrDto,
  ) {
    await this.paymentQrService.verifyOwnership(id, user.id);
    return this.paymentQrService.update(id, dto);
  }

  @Put(':id/set-default')
  async setDefault(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    await this.paymentQrService.verifyOwnership(id, user.id);
    return this.paymentQrService.setDefault(id, user.id);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.paymentQrService.verifyOwnership(id, user.id);
    await this.paymentQrService.remove(id);
    return null;
  }
}
