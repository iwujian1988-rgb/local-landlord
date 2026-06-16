import Taro from '@tarojs/taro';
import { post } from './request';

export interface ShareLinkResult {
  token: string;
  shareUrl: string;
  expiresAt: string;
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
    const { shareUrl } = res.data;
    await new Promise<void>((resolve, reject) => {
      Taro.setClipboardData({
        data: shareUrl,
        success: () => resolve(),
        fail: () => reject(),
      });
    });
    return res.data;
  } catch (err) {
    console.error('[share] generate failed:', err);
    Taro.showToast({ title: '生成链接失败，请稍后重试', icon: 'none' });
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
      title: '账单链接已准备好',
      content: '已复制到剪贴板，粘贴发给租客；租客在微信打开后可看到账单和二维码，长按即可付款。',
      confirmText: '我也预览一下',
      cancelText: '知道了',
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
      title: '收款链接已准备好',
      content: '已复制到剪贴板，粘贴发给租客；租客在微信打开后可看到金额和二维码，长按即可付款。',
      confirmText: '我也预览一下',
      cancelText: '知道了',
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
