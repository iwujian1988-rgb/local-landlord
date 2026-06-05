import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
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
    @Body() dto: CreateFeeItemDto,
  ) {
    await this.feeService.verifyRoomOwnership(roomId, user.id);
    return this.feeService.create(roomId, dto);
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
