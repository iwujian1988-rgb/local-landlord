import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { SystemService } from './system.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(0)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  // ========== 房源管理 ==========

  @Get('properties')
  async findProperties(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('keyword') keyword?: string,
  ) {
    return this.systemService.findProperties(page || 1, pageSize || 20, keyword);
  }

  @Post('properties')
  async createProperty(@Body() body: any) {
    return this.systemService.createProperty(body);
  }

  @Put('properties/:id')
  async updateProperty(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.systemService.updateProperty(id, body);
  }

  @Delete('properties/:id')
  async deleteProperty(@Param('id', ParseIntPipe) id: number) {
    await this.systemService.deleteProperty(id);
    return null;
  }

  // ========== 房间管理 ==========

  @Get('rooms')
  async findRooms(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('keyword') keyword?: string,
    @Query('status') status?: number,
  ) {
    return this.systemService.findRooms(page || 1, pageSize || 20, keyword, status !== undefined ? Number(status) : undefined);
  }

  @Post('rooms')
  async createRoom(@Body() body: any) {
    return this.systemService.createRoom(body);
  }

  @Put('rooms/:id')
  async updateRoom(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.systemService.updateRoom(id, body);
  }

  @Put('rooms/:id/status')
  async updateRoomStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: number },
  ) {
    return this.systemService.updateRoomStatus(id, body.status);
  }

  @Delete('rooms/:id')
  async deleteRoom(@Param('id', ParseIntPipe) id: number) {
    await this.systemService.deleteRoom(id);
    return null;
  }

  // ========== 租客管理 ==========

  @Get('tenants')
  async findTenants(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('keyword') keyword?: string,
  ) {
    return this.systemService.findTenants(page || 1, pageSize || 20, keyword);
  }

  @Post('tenants')
  async createTenant(@Body() body: any) {
    return this.systemService.createTenant(body);
  }

  @Put('tenants/:id')
  async updateTenant(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.systemService.updateTenant(id, body);
  }

  @Put('tenants/:id/move-out')
  async moveOutTenant(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { moveOutDate?: string },
  ) {
    return this.systemService.moveOutTenant(id, body?.moveOutDate);
  }

  @Delete('tenants/:id')
  async deleteTenant(@Param('id', ParseIntPipe) id: number) {
    await this.systemService.deleteTenant(id);
    return null;
  }

  // ========== 管理员用户管理 ==========

  @Get('admins')
  async findAdmins(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.systemService.findAdmins(page || 1, pageSize || 20);
  }

  @Post('admins')
  async createAdmin(@Body() body: { username: string; password: string; name: string; role?: number }) {
    return this.systemService.createAdmin(body);
  }

  @Put('admins/:id')
  async updateAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; role?: number; status?: number },
  ) {
    return this.systemService.updateAdmin(id, body);
  }

  @Put('admins/:id/reset-password')
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { password: string },
  ) {
    return this.systemService.resetAdminPassword(id, body.password);
  }

  // ========== 仪表盘 ==========

  @Get('dashboard/summary')
  async getDashboardSummary() {
    return this.systemService.getDashboardSummary();
  }

  // ========== 账单管理（管理员视角） ==========

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
    @Body() body: { paidAt?: string },
  ) {
    return this.systemService.confirmAdminBill(id, body?.paidAt);
  }

  @Post('bills/batch-confirm')
  async batchConfirmAdminBills(@Body() body: { ids: number[] }) {
    return this.systemService.batchConfirmAdminBills(body.ids);
  }

  @Post('bills/batch-remind')
  async batchRemindAdminBills(@Body() body: { ids: number[] }) {
    return this.systemService.batchRemindAdminBills(body.ids);
  }

  // ========== 数据统计 ==========

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

  // ========== 房东管理 ==========

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
  // body 支持字段：name, phone, defaultPayeeName, paymentNote, avatar, maxProperties
  async createLandlord(@Body() body: { name: string; phone: string; defaultPayeeName?: string; paymentNote?: string; avatar?: string; maxProperties?: number }) {
    return this.systemService.createLandlord(body);
  }

  @Put('landlords/:id')
  async updateLandlord(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.systemService.updateLandlord(id, body);
  }

  @Put('landlords/:id/status')
  async updateLandlordStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: number },
  ) {
    return this.systemService.updateLandlordStatus(id, body.status);
  }

  // ========== 系统设置 ==========

  @Get('settings/notifications')
  async getNotifications() {
    return this.systemService.getNotifications();
  }

  @Put('settings/notifications')
  async updateNotifications(@Body() body: any) {
    return this.systemService.updateNotifications(body);
  }

  @Get('settings/params')
  async getSystemParams() {
    return this.systemService.getSystemParams();
  }

  @Put('settings/params')
  async updateSystemParams(@Body() body: any) {
    return this.systemService.updateSystemParams(body);
  }

  // ========== 合同管理 ==========

  @Get('contracts')
  async findContracts(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('type') type?: number,
    @Query('roomId') roomId?: number,
  ) {
    return this.systemService.findContracts(
      page || 1,
      pageSize || 20,
      type !== undefined ? Number(type) : undefined,
      roomId ? Number(roomId) : undefined,
    );
  }

  @Post('contracts/upload')
  async uploadContract(@Body() body: { roomId: number; name: string; imageUrl: string; note?: string }) {
    return this.systemService.createContract(body);
  }

  @Delete('contracts/:id')
  async deleteContract(@Param('id', ParseIntPipe) id: number) {
    await this.systemService.deleteContract(id);
    return null;
  }
}
