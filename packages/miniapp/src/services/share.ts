import Taro from '@tarojs/taro';
import { post } from './request';
import { H5_BASE_URL } from '../config';

export interface ShareLinkResult {
  token: string;
  shareUrl: string;
  miniPath?: string;
  expiresAt: string;
}

async function generateShareResult(
  billId?: number,
  singleChargeId?: number,
): Promise<ShareLinkResult | null> {
  if (!billId && !singleChargeId) {
    Taro.showToast({ title: '缺少账单 ID', icon: 'none' });
    return null;
  }
  try {
    const res = await post<ShareLinkResult>('/share/generate', { billId, singleChargeId });
    if (res.code !== 0 || !res.data?.token) {
      Taro.showToast({ title: res.message || '生成账单失败', icon: 'none' });
      return null;
    }
    return {
      ...res.data,
      shareUrl: ensureAbsoluteShareUrl(res.data.shareUrl, res.data.token),
    };
  } catch (err: any) {
    console.error('[share] generate failed:', err);
    Taro.showToast({ title: err?.message || '生成账单失败，请稍后重试', icon: 'none' });
    return null;
  }
}

function isPrivateLocalUrl(value: string): boolean {
  try {
    const { hostname } = new URL(value);
    return hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname.startsWith('192.168.')
      || hostname.startsWith('10.')
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
  } catch {
    return true;
  }
}

export function ensureAbsoluteShareUrl(shareUrl: string | undefined, token: string): string {
  const candidate = shareUrl?.trim() || '';
  const h5IsLocal = isPrivateLocalUrl(H5_BASE_URL);
  if (/^https?:\/\//i.test(candidate) && (h5IsLocal || !isPrivateLocalUrl(candidate))) return candidate;
  return `${H5_BASE_URL.replace(/\/$/, '')}/?token=${encodeURIComponent(token)}`;
}

/**
 * Generate a shareable H5 link. Pass either billId or singleChargeId.
 * On success, copies the link to clipboard.
 * Returns null if generation failed.
 */
export async function generateAndCopyShareLink(
  billId?: number,
  singleChargeId?: number,
): Promise<ShareLinkResult | null> {
  const result = await generateShareResult(billId, singleChargeId);
  if (!result) return null;
  try {
    await new Promise<void>((resolve, reject) => {
      Taro.setClipboardData({
        data: result.shareUrl,
        success: () => resolve(),
        fail: () => reject(),
      });
    });
    return result;
  } catch (err: any) {
    console.error('[share] generate failed:', err);
    Taro.showToast({ title: err?.message || '生成链接失败，请稍后重试', icon: 'none' });
    return null;
  }
}

/**
 * Open the share-webview container (for in-WeChat preview by the landlord).
 */
export function openShareWebview(token: string, shareUrl?: string) {
  const params = [`token=${encodeURIComponent(token)}`];
  if (shareUrl && /^https:\/\//i.test(shareUrl) && !isPrivateLocalUrl(shareUrl)) {
    params.push(`url=${encodeURIComponent(shareUrl)}`);
  }
  Taro.navigateTo({ url: `/pages/share-webview/index?${params.join('&')}` });
}

export function openTenantBill(token: string) {
  Taro.navigateTo({
    url: `/pages/tenant-bill/index?token=${encodeURIComponent(token)}&source=landlord`,
  });
}

/**
 * Unified entry point for sharing a bill with a tenant.
 *
 * Generates a capability token and opens the native tenant bill page.
 * The native page exposes a standard mini-program share button.
 *
 * Returns the ShareLinkResult on success, or null if generation failed.
 */
export async function forwardBillShare(billId: number): Promise<ShareLinkResult | null> {
  const result = await generateShareResult(billId);
  if (!result) return null;
  openTenantBill(result.token);
  return result;
}

/**
 * Same as forwardBillShare but for a single_charge (水电维修等).
 * Modal copy differs slightly so landlord knows it's a one-off charge.
 */
export async function forwardSingleChargeShare(singleChargeId: number): Promise<ShareLinkResult | null> {
  const result = await generateShareResult(undefined, singleChargeId);
  if (!result) return null;
  openTenantBill(result.token);
  return result;
}
