import { Controller, Post, Put, Delete, Get, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(1)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post('rooms/:roomId/tenant')
  async create(
    @CurrentUser() user: any,
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() dto: CreateTenantDto,
  ) {
    await this.tenantService.verifyRoomOwnership(roomId, user.id);
    return this.tenantService.create(roomId, dto);
  }

  @Put('tenants/:id')
  async update(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTenantDto,
  ) {
    await this.tenantService.verifyTenantOwnership(id, user.id);
    return this.tenantService.update(id, dto);
  }

  @Delete('tenants/:id')
  async moveOut(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Query('moveOutDate') moveOutDate: string,
  ) {
    await this.tenantService.verifyTenantOwnership(id, user.id);
    if (!moveOutDate) {
      moveOutDate = new Date().toISOString().slice(0, 10);
    }
    return this.tenantService.moveOut(id, moveOutDate);
  }

  @Get('tenants/:id')
  async findOne(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.tenantService.verifyTenantOwnership(id, user.id);
    return this.tenantService.findOne(id);
  }
}
