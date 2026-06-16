import { Controller, Post, Get, Body, Param, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ShareService } from './share.service';
import { GenerateShareDto } from './share.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BillService } from '../bill/bill.service';
import { RentService } from '../rent/rent.service';

@Controller('share')
export class ShareController {
  constructor(
    private readonly shareService: ShareService,
    private readonly billService: BillService,
    private readonly rentService: RentService,
  ) {}

  /** Authed: landlord generates a share link for a bill or single_charge */
  @Post('generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async generate(@CurrentUser() user: any, @Body() dto: GenerateShareDto) {
    if (dto.billId) {
      // Verify the bill belongs to this landlord (throws on mismatch)
      await this.billService.verifyBillOwnership(dto.billId, user.id);
      const { token, expiresAt } = await this.shareService.generateForBill(dto.billId);
      const baseUrl = process.env.BASE_URL || '';
      const shareUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/h5/?token=${token}` : `/h5/?token=${token}`;
      return { token, shareUrl, expiresAt };
    }

    if (dto.singleChargeId) {
      // Verify the single_charge's room belongs to this landlord
      await this.rentService.verifySingleChargeOwnership(dto.singleChargeId, user.id);
      const { token, expiresAt } = await this.shareService.generateForSingleCharge(dto.singleChargeId);
      const baseUrl = process.env.BASE_URL || '';
      const shareUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/h5/?token=${token}` : `/h5/?token=${token}`;
      return { token, shareUrl, expiresAt };
    }

    throw new BadRequestException('缺少 billId 或 singleChargeId');
  }

  /** Public: H5 page resolves the token to bill data */
  @Get('bill/:token')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async resolveBill(@Param('token') token: string) {
    if (!token) throw new BadRequestException('缺少 token');
    return this.shareService.resolveBill(token);
  }
}
