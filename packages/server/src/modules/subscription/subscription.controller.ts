import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { BillService } from '../bill/bill.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('subscription')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(0)
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly billService: BillService,
  ) {}

  @Post('trigger-auto-bills')
  async triggerAutoBills() {
    return this.subscriptionService.triggerAutoBills();
  }

  @Post('trigger-rent')
  async triggerRentReminder() {
    return this.subscriptionService.triggerRentReminder();
  }

  @Post('trigger-move-out')
  async triggerMoveOutReminder() {
    return this.subscriptionService.triggerMoveOutReminder();
  }

  @Post('trigger-overdue')
  async triggerOverdueReminder(@Query('dryRun') dryRun?: string) {
    return this.subscriptionService.triggerOverdueReminder(dryRun === '1');
  }

  @Post('trigger-mark-overdue')
  async triggerMarkOverdue() {
    return this.billService.triggerMarkOverdue();
  }

  @Post('trigger-contract-expiry')
  async triggerContractExpiry() {
    return this.subscriptionService.triggerContractExpiry();
  }

  @Post('trigger-vacancy')
  async triggerVacancyReminder() {
    return this.subscriptionService.triggerVacancyReminder();
  }

  @Post('trigger-monthly-summary')
  async triggerMonthlySummary() {
    return this.subscriptionService.triggerMonthlySummary();
  }

  @Get('net-diag')
  async netDiag() {
    return this.subscriptionService.netDiag();
  }
}
