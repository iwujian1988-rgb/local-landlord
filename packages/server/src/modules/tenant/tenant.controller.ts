import { Controller, Post, Put, Delete, Get, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post('rooms/:roomId/tenant')
  async create(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() dto: CreateTenantDto,
  ) {
    return this.tenantService.create(roomId, dto);
  }

  @Put('tenants/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantService.update(id, dto);
  }

  @Delete('tenants/:id')
  async moveOut(
    @Param('id', ParseIntPipe) id: number,
    @Query('moveOutDate') moveOutDate: string,
  ) {
    if (!moveOutDate) {
      moveOutDate = new Date().toISOString().slice(0, 10);
    }
    return this.tenantService.moveOut(id, moveOutDate);
  }

  @Get('tenants/:id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tenantService.findOne(id);
  }
}
