import { Injectable, Logger } from '@nestjs/common';
import { resolveWxApiBase } from './wx-api';

interface AccessTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
  error_code?: string;
  error_message?: string;
}

interface PhoneNumberResponse {
  errcode?: number;
  errmsg?: string;
  error_code?: string;
  error_message?: string;
  phone_info?: {
    phoneNumber?: string;
    purePhoneNumber?: string;
    countryCode?: string;
  };
}

@Injectable()
export class WechatApiService {
  private readonly logger = new Logger(WechatApiService.name);
  private cachedAccessToken: string | null = null;
  private tokenExpiresAt = 0;
  private tokenRequest: Promise<string> | null = null;

  async resolveApi(): Promise<{ base: string; injected: boolean }> {
    return resolveWxApiBase();
  }

  async getAccessToken(): Promise<string> {
    const { injected } = await this.resolveApi();
    if (injected) return '';

    const now = Date.now();
    if (this.cachedAccessToken && now < this.tokenExpiresAt - 300_000) {
      return this.cachedAccessToken;
    }
    if (this.tokenRequest) return this.tokenRequest;

    this.tokenRequest = this.fetchAccessToken();
    try {
      return await this.tokenRequest;
    } finally {
      this.tokenRequest = null;
    }
  }

  async getPhoneNumber(phoneCode: string): Promise<string> {
    const { base, injected } = await this.resolveApi();
    const token = await this.getAccessToken();
    const url = injected
      ? `${base}/wxa/business/getuserphonenumber`
      : `${base}/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(token)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: phoneCode }),
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json() as PhoneNumberResponse;
    const phone = result.phone_info?.purePhoneNumber || result.phone_info?.phoneNumber || '';

    if (!response.ok || result.error_code || (result.errcode !== undefined && result.errcode !== 0) || !phone) {
      const reason = result.error_code
        ? `${result.error_code} ${result.error_message || ''}`
        : `${result.errcode ?? ''} ${result.errmsg || 'missing phone_info'}`;
      this.logger.warn(`WeChat phone authorization failed: http=${response.status} ${reason}`.trim());
      throw new Error(`WeChat phone authorization failed: ${reason}`.trim());
    }

    if (phone.length > 20) {
      throw new Error('WeChat returned an invalid phone number');
    }
    return phone;
  }

  private async fetchAccessToken(): Promise<string> {
    const appid = process.env.WX_APPID;
    const secret = process.env.WX_SECRET;
    if (!appid || !secret) {
      throw new Error('WX_APPID or WX_SECRET not configured');
    }

    const { base } = await this.resolveApi();
    const url = `${base}/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const result = await response.json() as AccessTokenResponse;
    if (!response.ok || !result.access_token) {
      const reason = result.error_code
        ? `${result.error_code} ${result.error_message || ''}`
        : `${result.errcode ?? ''} ${result.errmsg || 'missing access_token'}`;
      this.logger.error(`Failed to get WeChat access_token: http=${response.status} ${reason}`.trim());
      throw new Error(`WeChat access_token error: ${reason}`.trim());
    }

    this.cachedAccessToken = result.access_token;
    this.tokenExpiresAt = Date.now() + (result.expires_in || 7200) * 1000;
    return this.cachedAccessToken;
  }
}
