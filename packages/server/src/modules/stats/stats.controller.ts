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
  ) {
    return this.statsService.getRentStats(user.id, period || 'month');
  }

  @Get('home')
  async getHomeStats(@CurrentUser() user: any) {
    return this.statsService.getHomeStats(user.id);
  }
}
