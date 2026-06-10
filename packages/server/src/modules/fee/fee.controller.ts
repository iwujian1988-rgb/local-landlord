import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { FeeService } from './fee.service';
import { CreateFeeItemDto } from './dto/create-fee-item.dto';
import { UpdateFeeItemDto } from './dto/update-fee-item.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(1)
export class FeeController {
  constructor(private readonly feeService: FeeService) {}

  @Get('rooms/:roomId/fee-items')
  async findByRoom(
    @CurrentUser() user: any,
    @Param('roomId', ParseIntPipe) roomId: number,
  ) {
    await this.feeService.verifyRoomOwnership(roomId, user.id);
    return this.feeService.findByRoom(roomId);
  }

  @Post('rooms/:roomId/fee-items')
  async create(
    @CurrentUser() user: any,
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() body: any,
  ) {
    await this.feeService.verifyRoomOwnership(roomId, user.id);
    // Batch save: { fees: [...] }
    if (body.fees && Array.isArray(body.fees)) {
      return this.feeService.batchSave(roomId, body.fees);
    }
    // Single create — validate required fields
    if (!body.name || !body.name.trim()) {
      throw new BadRequestException('费用项名称不能为空');
    }
    if (body.amount !== undefined && body.amount < 0) {
      throw new BadRequestException('费用金额不能为负数');
    }
    return this.feeService.create(roomId, body);
  }

  @Put('fee-items/:id')
  async update(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFeeItemDto,
  ) {
    await this.feeService.verifyFeeItemOwnership(id, user.id);
    return this.feeService.update(id, dto);
  }

  @Delete('fee-items/:id')
  async remove(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.feeService.verifyFeeItemOwnership(id, user.id);
    await this.feeService.remove(id);
    return null;
  }

  @Put('rooms/:roomId/fee-items/sort')
  async sort(
    @CurrentUser() user: any,
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() body: { ids: number[] },
  ) {
    await this.feeService.verifyRoomOwnership(roomId, user.id);
    await this.feeService.sortByRoom(roomId, body.ids);
    return null;
  }
}
