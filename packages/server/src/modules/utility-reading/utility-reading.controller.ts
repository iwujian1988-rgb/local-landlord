import { Body, Controller, Get, Param, ParseIntPipe, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UtilityReadingService } from './utility-reading.service';
import { SaveUtilityReadingsDto } from './dto/save-utility-readings.dto';

@Controller('rooms/:roomId/utility-readings')
@UseGuards(JwtAuthGuard)
export class UtilityReadingController {
  constructor(private readonly utilityReadingService: UtilityReadingService) {}

  @Get()
  async getMonthly(
    @CurrentUser() user: any,
    @Param('roomId', ParseIntPipe) roomId: number,
    @Query('period') period: string,
  ) {
    await this.utilityReadingService.verifyRoomOwnership(roomId, user.id);
    return this.utilityReadingService.getMonthly(roomId, period);
  }

  @Put()
  async saveMonthly(
    @CurrentUser() user: any,
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() dto: SaveUtilityReadingsDto,
  ) {
    await this.utilityReadingService.verifyRoomOwnership(roomId, user.id);
    return this.utilityReadingService.saveMonthly(roomId, dto);
  }
}
