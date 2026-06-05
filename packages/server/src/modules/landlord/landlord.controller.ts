import { Controller, Get, Put, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { LandlordService } from './landlord.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('landlord')
@UseGuards(JwtAuthGuard)
export class LandlordController {
  constructor(private readonly landlordService: LandlordService) {}

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.landlordService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; phone?: string; avatar?: string; defaultPayeeName?: string; paymentNote?: string },
  ) {
    return this.landlordService.update(id, body);
  }
}
