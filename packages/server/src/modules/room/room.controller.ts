import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(1)
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get('rooms')
  async findAllForLandlord(@CurrentUser() user: any) {
    return this.roomService.findAllForLandlord(user.id);
  }

  @Get('properties/:propertyId/rooms')
  async findByProperty(
    @CurrentUser() user: any,
    @Param('propertyId', ParseIntPipe) propertyId: number,
    @Query('status') status?: number,
  ) {
    await this.roomService.verifyPropertyOwnership(propertyId, user.id);
    return this.roomService.findByProperty(propertyId, status !== undefined && !isNaN(status as any) ? status : undefined);
  }

  @Post('properties/:propertyId/rooms')
  async create(
    @CurrentUser() user: any,
    @Param('propertyId', ParseIntPipe) propertyId: number,
    @Body() dto: CreateRoomDto,
  ) {
    await this.roomService.verifyPropertyOwnership(propertyId, user.id);
    return this.roomService.create(propertyId, dto);
  }

  @Get('rooms/:id')
  async findOne(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.roomService.verifyRoomOwnership(id, user.id);
    return this.roomService.findOne(id);
  }

  @Put('rooms/:id')
  async update(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoomDto,
  ) {
    await this.roomService.verifyRoomOwnership(id, user.id);
    return this.roomService.update(id, dto);
  }

  @Delete('rooms/:id')
  async remove(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.roomService.verifyRoomOwnership(id, user.id);
    await this.roomService.remove(id);
    return null;
  }
}
