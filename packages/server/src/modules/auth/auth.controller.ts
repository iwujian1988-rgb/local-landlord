import { Controller, Post, Get, Put, Body, Headers, UseGuards, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { WechatLoginDto } from './dto/wechat-login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wechat/login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async wechatLogin(@Body() dto: WechatLoginDto) {
    // Dev bypass: skip WeChat code verification
    if (dto.code?.startsWith('dev_')) {
      return this.authService.devLogin(dto.code);
    }
    return this.authService.wechatLogin(dto);
  }

  @Post('cloud-login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async cloudLogin(@Headers('x-wx-openid') openId: string) {
    if (!openId) {
      throw new BadRequestException('缺少微信身份信息，请通过小程序访问');
    }
    return this.authService.cloudLogin(openId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, dto, user.isAdmin);
  }

  @Post('admin/login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto);
  }

  @Get('admin/me')
  @UseGuards(JwtAuthGuard)
  async adminMe(@CurrentUser() user: any) {
    return this.authService.getMe(user);
  }
}
