import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { SystemService } from './system.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateTenantDto } from '../tenant/dto/create-tenant.dto';
import { UpdateTenantDto } from '../tenant/dto/update-tenant.dto';
import { CreatePropertyDto } from '../property/dto/create-property.dto';
import { UpdatePropertyDto } from '../property/dto/update-property.dto';
import { IsOptional, IsString, IsNumber, IsInt, IsArray, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** DTOs for admin endpoints that previously used `any` */

class CreateAdminDto {
  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  role?: number;
}

class UpdateAdminDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  role?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  status?: number;
}

class ResetPasswordDto {
  @IsString()
  password: string;
}

class UpdateRoomBodyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  rent?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  deposit?: number;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsString()
  orientation?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  status?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  propertyId?: number;
}

class CreateRoomBodyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  rent?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  deposit?: number;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsString()
  orientation?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  propertyId?: number;
}

class UpdateRoomStatusDto {
  @IsInt()
  @Type(() => Number)
  status: number;
}

class MoveOutTenantDto {
  @IsOptional()
  @IsDateString()
  moveOutDate?: string;
}

class BatchConfirmDto {
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  ids: number[];

  @IsOptional()
  @IsDateString()
  paidAt?: string;
}

class BatchRemindDto {
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  ids: number[];
}

class CreateLandlordDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  defaultPayeeName?: string;

  @IsOptional()
  @IsString()
  paymentNote?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  maxProperties?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  status?: number;
}

class UpdateLandlordBodyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  defaultPayeeName?: string;

  @IsOptional()
  @IsString()
  paymentNote?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  maxProperties?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  status?: number;
}

class UpdateLandlordStatusDto {
  @IsInt()
  @Type(() => Number)
  status: number;
}

class UpdateNotificationsDto {
  @IsOptional()
  rentRemind?: Record<string, any>;

  @IsOptional()
  overdueRemind?: Record<string, any>;

  @IsOptional()
  welcomeMsg?: Record<string, any>;
}

class UpdateSystemParamsDto {
  @IsOptional()
  @IsString()
  appName?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  maxRoomPerProperty?: number;

  @IsOptional()
  enableAutoRemind?: boolean;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  remindDays?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  dataRetentionDays?: number;
}

class UploadContractDto {
  @IsInt()
  @Type(() => Number)
  roomId: number;

  @IsString()
  name: string;

  @IsString()
  imageUrl: string;

  @IsOptional()
  @IsString()
  note?: string;
}

class PaidAtDto {
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(0)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  // ========== Property management ==========

  @Get('properties')
  async findProperties(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('keyword') keyword?: string,
  ) {
    return this.systemService.findProperties(page || 1, pageSize || 20, keyword);
  }

  @Post('properties')
  async createProperty(@Body() body: CreatePropertyDto) {
    return this.systemService.createProperty(body);
  }

  @Put('properties/:id')
  async updateProperty(@Param('id', ParseIntPipe) id: number, @Body() body: UpdatePropertyDto) {
    return this.systemService.updateProperty(id, body);
  }

  @Delete('properties/:id')
  async deleteProperty(@Param('id', ParseIntPipe) id: number) {
    await this.systemService.deleteProperty(id);
    return null;
  }

  // ========== Room management ==========

  @Get('rooms')
  async findRooms(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('keyword') keyword?: string,
    @Query('status') status?: number,
  ) {
    const statusNum = Number(status);
    return this.systemService.findRooms(page || 1, pageSize || 20, keyword, !isNaN(statusNum) ? statusNum : undefined);
  }

  @Post('rooms')
  async createRoom(@Body() body: CreateRoomBodyDto) {
    return this.systemService.createRoom(body);
  }

  @Put('rooms/:id')
  async updateRoom(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateRoomBodyDto) {
    return this.systemService.updateRoom(id, body);
  }

  @Put('rooms/:id/status')
  async updateRoomStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateRoomStatusDto,
  ) {
    return this.systemService.updateRoomStatus(id, body.status);
  }

  @Delete('rooms/:id')
  async deleteRoom(@Param('id', ParseIntPipe) id: number) {
    await this.systemService.deleteRoom(id);
    return null;
  }

  // ========== Tenant management ==========

  @Get('tenants')
  async findTenants(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('keyword') keyword?: string,
  ) {
    return this.systemService.findTenants(page || 1, pageSize || 20, keyword);
  }

  @Post('tenants')
  async createTenant(@Body() body: CreateTenantDto) {
    return this.systemService.createTenant(body);
  }

  @Put('tenants/:id')
  async updateTenant(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateTenantDto) {
    return this.systemService.updateTenant(id, body);
  }

  @Put('tenants/:id/move-out')
  async moveOutTenant(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: MoveOutTenantDto,
  ) {
    return this.systemService.moveOutTenant(id, body?.moveOutDate);
  }

  @Delete('tenants/:id')
  async deleteTenant(@Param('id', ParseIntPipe) id: number) {
    await this.systemService.deleteTenant(id);
    return null;
  }

  // ========== Admin user management ==========

  @Get('admins')
  async findAdmins(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.systemService.findAdmins(page || 1, pageSize || 20);
  }

  @Post('admins')
  async createAdmin(@Body() body: CreateAdminDto) {
    return this.systemService.createAdmin(body);
  }

  @Put('admins/:id')
  async updateAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAdminDto,
  ) {
    return this.systemService.updateAdmin(id, body);
  }

  @Put('admins/:id/reset-password')
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ResetPasswordDto,
  ) {
    return this.systemService.resetAdminPassword(id, body.password);
  }

  // ========== Dashboard ==========

  @Get('dashboard/summary')
  async getDashboardSummary() {
    return this.systemService.getDashboardSummary();
  }

  // ========== Bill management (admin view) ==========

  @Get('bills')
  async getAdminBills(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: number,
    @Query('propertyId') propertyId?: number,
    @Query('period') period?: string,
  ) {
    return this.systemService.getAdminBills(
      page || 1,
      pageSize || 20,
      status !== undefined ? Number(status) : undefined,
      propertyId ? Number(propertyId) : undefined,
      period,
    );
  }

  @Get('bills/overdue')
  async getOverdueBills() {
    return this.systemService.getAdminBills(1, 100, 2);
  }

  @Put('bills/:id/confirm')
  async confirmAdminBill(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PaidAtDto,
  ) {
    return this.systemService.confirmAdminBill(id, body?.paidAt);
  }

  @Post('bills/batch-confirm')
  async batchConfirmAdminBills(@Body() body: BatchConfirmDto) {
    return this.systemService.batchConfirmAdminBills(body.ids, body.paidAt);
  }

  @Post('bills/batch-remind')
  async batchRemindAdminBills(@Body() body: BatchRemindDto) {
    return this.systemService.batchRemindAdminBills(body.ids);
  }

  // ========== Statistics ==========

  @Get('stats/rent')
  async getAdminRentStats(@Query('period') period?: string) {
    return this.systemService.getAdminRentStats(period);
  }

  @Get('stats/occupancy')
  async getAdminOccupancyStats() {
    return this.systemService.getAdminOccupancyStats();
  }

  @Get('stats/activity')
  async getAdminLandlordActivity() {
    return this.systemService.getAdminLandlordActivity();
  }

  // ========== Landlord management ==========

  @Get('landlords')
  async getLandlords(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('keyword') keyword?: string,
  ) {
    return this.systemService.getLandlords(page || 1, pageSize || 20, keyword);
  }

  @Get('landlords/:id')
  async getLandlordDetail(@Param('id', ParseIntPipe) id: number) {
    return this.systemService.getLandlordDetail(id);
  }

  @Post('landlords')
  async createLandlord(@Body() body: CreateLandlordDto) {
    return this.systemService.createLandlord(body);
  }

  @Put('landlords/:id')
  async updateLandlord(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateLandlordBodyDto) {
    return this.systemService.updateLandlord(id, body);
  }

  @Put('landlords/:id/status')
  async updateLandlordStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateLandlordStatusDto,
  ) {
    return this.systemService.updateLandlordStatus(id, body.status);
  }

  // ========== System settings ==========

  @Get('settings/notifications')
  async getNotifications() {
    return this.systemService.getNotifications();
  }

  @Put('settings/notifications')
  async updateNotifications(@Body() body: UpdateNotificationsDto) {
    return this.systemService.updateNotifications(body);
  }

  @Get('settings/params')
  async getSystemParams() {
    return this.systemService.getSystemParams();
  }

  @Put('settings/params')
  async updateSystemParams(@Body() body: UpdateSystemParamsDto) {
    return this.systemService.updateSystemParams(body);
  }

  // ========== Contract management ==========

  @Get('contracts')
  async findContracts(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('type') type?: number,
    @Query('roomId') roomId?: number,
  ) {
    const contractType = type !== undefined && type !== null ? Number(type) : NaN;
    const contractRoomId = roomId !== undefined && roomId !== null ? Number(roomId) : NaN;
    return this.systemService.findContracts(
      page || 1,
      pageSize || 20,
      !isNaN(contractType) ? contractType : undefined,
      !isNaN(contractRoomId) ? contractRoomId : undefined,
    );
  }

  @Post('contracts/upload')
  async uploadContract(@Body() body: UploadContractDto) {
    return this.systemService.createContract(body);
  }

  @Delete('contracts/:id')
  async deleteContract(@Param('id', ParseIntPipe) id: number) {
    await this.systemService.deleteContract(id);
    return null;
  }
}
