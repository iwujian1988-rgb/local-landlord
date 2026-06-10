import { Controller, Post, Get, Put, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { BillService } from './bill.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(1)
export class BillController {
  constructor(private readonly billService: BillService) {}

  @Post('rooms/:roomId/bills')
  async create(
    @CurrentUser() user: any,
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() dto: CreateBillDto,
  ) {
    // Frontend may send items[].name instead of items[].feeName
    if (dto.items) {
      for (const item of dto.items as any[]) {
        if (!item.feeName && item.name) {
          item.feeName = item.name;
        }
      }
    }
    await this.billService.verifyRoomOwnership(roomId, user.id);
    return this.billService.create(roomId, dto);
  }

  @Get('rooms/:roomId/bills')
  async findByRoom(
    @CurrentUser() user: any,
    @Param('roomId', ParseIntPipe) roomId: number,
  ) {
    await this.billService.verifyRoomOwnership(roomId, user.id);
    return this.billService.findByRoom(roomId);
  }

  @Get('bills/:id')
  async findOne(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.billService.verifyBillOwnership(id, user.id);
    return this.billService.findOne(id);
  }

  @Put('bills/:id/confirm')
  async confirmPayment(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmPaymentDto,
  ) {
    await this.billService.verifyBillOwnership(id, user.id);
    return this.billService.confirmPayment(id, dto);
  }

  @Put('bills/:id/send')
  async sendBill(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.billService.verifyBillOwnership(id, user.id);
    return this.billService.sendBill(id);
  }
}
