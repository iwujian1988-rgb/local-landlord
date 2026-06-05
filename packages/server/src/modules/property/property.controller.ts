import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseIntPipe, ForbiddenException } from '@nestjs/common';
import { PropertyService } from './property.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('properties')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Get()
  @Roles(1)
  async findAll(@CurrentUser() user: any) {
    return this.propertyService.findAll(user.id);
  }

  @Post()
  @Roles(1)
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreatePropertyDto,
  ) {
    return this.propertyService.create(user.id, dto);
  }

  @Get(':id')
  @Roles(0, 1)
  async findOne(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const property = await this.propertyService.findOne(id, user.id, user.isAdmin);
    return property;
  }

  @Put(':id')
  @Roles(0, 1)
  async update(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.propertyService.update(id, dto, user.id, user.isAdmin);
  }

  @Delete(':id')
  @Roles(0, 1)
  async remove(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.propertyService.remove(id, user.id, user.isAdmin);
    return null;
  }
}
