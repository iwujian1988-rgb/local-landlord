import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get('properties/:propertyId/rooms')
  async findByProperty(
    @Param('propertyId', ParseIntPipe) propertyId: number,
    @Query('status') status?: number,
  ) {
    return this.roomService.findByProperty(propertyId, status);
  }

  @Post('properties/:propertyId/rooms')
  async create(
    @Param('propertyId', ParseIntPipe) propertyId: number,
    @Body() dto: CreateRoomDto,
  ) {
    return this.roomService.create(propertyId, dto);
  }

  @Get('rooms/:id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.roomService.findOne(id);
  }

  @Put('rooms/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.roomService.update(id, dto);
  }

  @Delete('rooms/:id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.roomService.remove(id);
    return null;
  }
}
