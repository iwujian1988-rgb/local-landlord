import { Controller, Get, Header } from '@nestjs/common';
import { SystemService } from './system.service';

@Controller('public-config')
export class PublicUsageGuideController {
  constructor(private readonly systemService: SystemService) {}

  @Get('usage-guide')
  @Header('Cache-Control', 'no-store')
  getUsageGuideConfig() {
    return this.systemService.getPublicUsageGuideConfig();
  }
}
