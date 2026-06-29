import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('rent')
  async getRentStats(
    @CurrentUser() user: any,
    @Query('period') period?: string,
    @Query('propertyId') propertyId?: string,
  ) {
    return this.statsService.getRentStatsV2(user.id, period || 'month', propertyId ? Number(propertyId) : undefined);
  }

  @Get('home')
  async getHomeStats(@CurrentUser() user: any) {
    return this.statsService.getHomeStats(user.id);
  }
}
