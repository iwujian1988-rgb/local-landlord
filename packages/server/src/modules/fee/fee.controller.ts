import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { FeeService } from './fee.service';
import { CreateFeeItemDto } from './dto/create-fee-item.dto';
import { UpdateFeeItemDto } from './dto/update-fee-item.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class FeeController {
  constructor(private readonly feeService: FeeService) {}

  @Get('rooms/:roomId/fee-items')
  async findByRoom(@Param('roomId', ParseIntPipe) roomId: number) {
    return this.feeService.findByRoom(roomId);
  }

  @Post('rooms/:roomId/fee-items')
  async create(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() dto: CreateFeeItemDto,
  ) {
    return this.feeService.create(roomId, dto);
  }

  @Put('fee-items/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFeeItemDto,
  ) {
    return this.feeService.update(id, dto);
  }

  @Delete('fee-items/:id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.feeService.remove(id);
    return null;
  }

  @Put('rooms/:roomId/fee-items/sort')
  async sort(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() body: { ids: number[] },
  ) {
    await this.feeService.sortByRoom(roomId, body.ids);
    return null;
  }
}
