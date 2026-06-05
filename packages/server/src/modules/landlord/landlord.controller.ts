import { Controller, Get, Put, Body, Param, UseGuards, ParseIntPipe, ForbiddenException } from '@nestjs/common';
import { LandlordService } from './landlord.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('landlord')
@UseGuards(JwtAuthGuard)
export class LandlordController {
  constructor(private readonly landlordService: LandlordService) {}

  @Get(':id')
  async findOne(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    if (!user.isAdmin && user.id !== id) {
      throw new ForbiddenException('无权访问该房东信息');
    }
    return this.landlordService.findOne(id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; phone?: string; avatar?: string; defaultPayeeName?: string; paymentNote?: string },
  ) {
    if (!user.isAdmin && user.id !== id) {
      throw new ForbiddenException('无权修改该房东信息');
    }
    return this.landlordService.update(id, body);
  }
}
