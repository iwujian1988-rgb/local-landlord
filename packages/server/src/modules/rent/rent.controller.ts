import { Controller, Get, Post, Put, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { RentService } from './rent.service';
import { CreateSingleChargeDto } from './dto/create-single-charge.dto';
import { RemindTenantDto } from './dto/remind-tenant.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard)
export class RentController {
  constructor(private readonly rentService: RentService) {}

  @Get('rent/pending')
  async getPendingRent(@CurrentUser() user: any) {
    return this.rentService.getPendingRent(user.id);
  }

  @Post('rooms/:roomId/single-charge')
  async createSingleCharge(
    @Param('roomId', ParseIntPipe) roomId: number,
    @CurrentUser() user: any,
    @Body() dto: CreateSingleChargeDto,
  ) {
    return this.rentService.createSingleCharge(roomId, user.id, dto);
  }

  @Put('single-charges/:id/confirm')
  async confirmSingleCharge(@Param('id', ParseIntPipe) id: number) {
    return this.rentService.confirmSingleCharge(id);
  }

  @Get('rooms/:roomId/records')
  async getRecords(@Param('roomId', ParseIntPipe) roomId: number) {
    return this.rentService.getRecords(roomId);
  }

  @Post('rooms/:roomId/remind')
  async remindTenant(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() dto: RemindTenantDto,
  ) {
    return this.rentService.remindTenant(roomId, dto);
  }
}
