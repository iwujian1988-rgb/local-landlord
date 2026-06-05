import { Controller, Post, Get, Put, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { BillService } from './bill.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class BillController {
  constructor(private readonly billService: BillService) {}

  @Post('rooms/:roomId/bills')
  async create(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() dto: CreateBillDto,
  ) {
    return this.billService.create(roomId, dto);
  }

  @Get('rooms/:roomId/bills')
  async findByRoom(@Param('roomId', ParseIntPipe) roomId: number) {
    return this.billService.findByRoom(roomId);
  }

  @Get('bills/:id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.billService.findOne(id);
  }

  @Put('bills/:id/confirm')
  async confirmPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmPaymentDto,
  ) {
    return this.billService.confirmPayment(id, dto);
  }

  @Put('bills/:id/send')
  async sendBill(@Param('id', ParseIntPipe) id: number) {
    return this.billService.sendBill(id);
  }
}
