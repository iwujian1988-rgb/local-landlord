import Taro from '@tarojs/taro';
import { post } from './request';
import { H5_BASE_URL } from '../config';

export interface ShareLinkResult {
  token: string;
  shareUrl: string;
  expiresAt: string;
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
  if (!billId && !singleChargeId) {
    Taro.showToast({ title: '缺少账单 ID', icon: 'none' });
    return null;
  }
  try {
    const res = await post<ShareLinkResult>('/share/generate', { billId, singleChargeId });
    if (res.code !== 0 || !res.data?.token) {
      Taro.showToast({ title: res.message || '生成链接失败', icon: 'none' });
      return null;
    }
    const shareUrl = ensureAbsoluteShareUrl(res.data.shareUrl, res.data.token);
    await new Promise<void>((resolve, reject) => {
      Taro.setClipboardData({
        data: shareUrl,
        success: () => resolve(),
        fail: () => reject(),
      });
    });
    return { ...res.data, shareUrl };
  } catch (err: any) {
    console.error('[share] generate failed:', err);
    Taro.showToast({ title: err?.message || '生成链接失败，请稍后重试', icon: 'none' });
    return null;
  }
}

/**
 * Open the share-webview container (for in-WeChat preview by the landlord).
 */
export function openShareWebview(token: string) {
  Taro.navigateTo({ url: `/pages/share-webview/index?token=${encodeURIComponent(token)}` });
}

/**
 * Unified entry point for sharing a bill with a tenant.
 *
 * 1. Calls POST /share/generate to obtain an H5 token + shareUrl
 * 2. Copies shareUrl to clipboard as a fallback
 * 3. Shows a modal guiding the landlord to forward the link in WeChat
 *
 * Returns the ShareLinkResult on success, or null if generation failed.
 */
export async function forwardBillShare(billId: number): Promise<ShareLinkResult | null> {
  const result = await generateAndCopyShareLink(billId);
  if (!result) return null;

  return new Promise<ShareLinkResult | null>((resolve) => {
    Taro.showModal({
      title: '付款链接已复制',
      content: '下一步：打开租客的微信聊天，长按输入框粘贴并发送。租客不用登录，打开链接就能看账单和收款码。',
      confirmText: '预览',
      cancelText: '去微信发送',
      success: (res) => {
        if (res.confirm) {
          openShareWebview(result.token);
        }
        resolve(result);
      },
      fail: () => resolve(result),
    });
  });
}

/**
 * Same as forwardBillShare but for a single_charge (水电维修等).
 * Modal copy differs slightly so landlord knows it's a one-off charge.
 */
export async function forwardSingleChargeShare(singleChargeId: number): Promise<ShareLinkResult | null> {
  const result = await generateAndCopyShareLink(undefined, singleChargeId);
  if (!result) return null;

  return new Promise<ShareLinkResult | null>((resolve) => {
    Taro.showModal({
      title: '付款链接已复制',
      content: '下一步：打开租客的微信聊天，长按输入框粘贴并发送。租客不用登录，打开链接就能看到金额和收款码。',
      confirmText: '预览',
      cancelText: '去微信发送',
      success: (res) => {
        if (res.confirm) {
          openShareWebview(result.token);
        }
        resolve(result);
      },
      fail: () => resolve(result),
    });
  });
}
