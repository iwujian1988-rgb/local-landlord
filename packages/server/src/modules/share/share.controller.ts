import { Controller, Post, Get, Body, Param, UseGuards, BadRequestException, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ShareService } from './share.service';
import { GenerateShareDto, MarkShareSentDto, ReceiptPromptDto } from './share.dto';
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

  private buildShareUrl(req: Request, token: string): string {
    const configuredBaseUrl = process.env.PUBLIC_BASE_URL || process.env.BASE_URL;
    if (configuredBaseUrl) {
      const baseUrl = configuredBaseUrl.trim().replace(/\/+$/, '');
      try {
        const parsed = new URL(baseUrl);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          throw new Error('unsupported protocol');
        }
        return `${baseUrl}/h5/?token=${encodeURIComponent(token)}`;
      } catch {
        throw new BadRequestException('PUBLIC_BASE_URL 配置无效');
      }
    }

    // Local development and legacy deployments may not have PUBLIC_BASE_URL.
    // Build an absolute URL from the reverse-proxy headers instead of returning
    // a host-relative path that cannot be pasted into a tenant's WeChat chat.
    const forwardedProto = req.headers['x-forwarded-proto'];
    const forwardedHost = req.headers['x-forwarded-host'];
    const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)?.split(',')[0]?.trim()
      || req.protocol
      || 'https';
    const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)?.split(',')[0]?.trim()
      || req.get('host');

    if (!host) {
      throw new BadRequestException('无法生成租客付款链接，请配置 PUBLIC_BASE_URL');
    }
    return `${protocol}://${host}/h5/?token=${encodeURIComponent(token)}`;
  }

  /** Authed: landlord generates a share link for a bill or single_charge */
  @Post('generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async generate(@CurrentUser() user: any, @Body() dto: GenerateShareDto, @Req() req: Request) {
    if (dto.billId) {
      // Verify the bill belongs to this landlord (throws on mismatch)
      await this.billService.verifyBillOwnership(dto.billId, user.id);
      const { token, expiresAt } = await this.shareService.generateForBill(dto.billId);
      const shareUrl = this.buildShareUrl(req, token);
      const miniPath = `pages/tenant-bill/index?token=${encodeURIComponent(token)}`;
      return { token, shareUrl, miniPath, expiresAt };
    }

    if (dto.singleChargeId) {
      // Verify the single_charge's room belongs to this landlord
      await this.rentService.verifySingleChargeOwnership(dto.singleChargeId, user.id);
      const { token, expiresAt } = await this.shareService.generateForSingleCharge(dto.singleChargeId);
      const shareUrl = this.buildShareUrl(req, token);
      const miniPath = `pages/tenant-bill/index?token=${encodeURIComponent(token)}`;
      return { token, shareUrl, miniPath, expiresAt };
    }

    throw new BadRequestException('缺少 billId 或 singleChargeId');
  }

  /** Called when the landlord actually opens WeChat's share panel. */
  @Post('mark-sent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1)
  async markSent(@CurrentUser() user: any, @Body() dto: MarkShareSentDto) {
    const target = this.shareService.getShareTarget(dto.token);
    if (target.kind === 'bill') {
      await this.billService.verifyBillOwnership(target.id, user.id);
    } else {
      await this.rentService.verifySingleChargeOwnership(target.id, user.id);
    }
    await this.shareService.markSent(target);
    return target;
  }

  /** “还没收到”只关闭本次提醒；下次重新发送会再次出现。 */
  @Post('receipt-prompt/dismiss')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1)
  async dismissReceiptPrompt(@CurrentUser() user: any, @Body() dto: ReceiptPromptDto) {
    if (dto.kind === 'bill') {
      await this.billService.verifyBillOwnership(dto.id, user.id);
    } else {
      await this.rentService.verifySingleChargeOwnership(dto.id, user.id);
    }
    await this.shareService.dismissReceiptPrompt(dto);
    return { dismissed: true };
  }

  /** Public: H5 page resolves the token to bill data */
  @Get('bill/:token')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async resolveBill(@Param('token') token: string) {
    if (!token) throw new BadRequestException('缺少 token');
    return this.shareService.resolveBill(token);
  }
}
