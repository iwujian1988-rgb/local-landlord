import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { PaymentQrService } from './payment-qr.service';
import { UpdatePaymentQrDto } from './dto/update-payment-qr.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

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
    @Body() body: { type: number; imageUrl: string; payeeName: string; note?: string },
  ) {
    return this.paymentQrService.upload(user.id, body);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaymentQrDto,
  ) {
    return this.paymentQrService.update(id, dto);
  }

  @Put(':id/set-default')
  async setDefault(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.paymentQrService.setDefault(id, user.id);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.paymentQrService.remove(id);
    return null;
  }
}
