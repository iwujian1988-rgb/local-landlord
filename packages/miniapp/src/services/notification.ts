import Taro from '@tarojs/taro';
import { WX_TEMPLATE_RENT, WX_TEMPLATE_OVERDUE } from '../config';

/**
 * Request notification subscription at key moments.
 *
 * WeChat subscription messages are ONE-TIME use — each call to requestSubscribeMessage
 * gives us ONE send opportunity per template. So we need to prompt frequently
 * at natural interaction points to accumulate subscription credits.
 *
 * Strategy: prompt AFTER user completes a satisfying action (save, confirm, etc.)
 * so the request feels natural, not annoying.
 */
export function requestNotification(): void {
  const tmplIds = [WX_TEMPLATE_RENT, WX_TEMPLATE_OVERDUE].filter(Boolean);
  if (tmplIds.length === 0) return;

  Taro.requestSubscribeMessage({
    tmplIds,
    entityIds: tmplIds,
    success: () => {},
    fail: () => {},
  });
}

/**
 * Request notification with a brief explanation.
 * Use this at higher-value moments (first tenant registration, etc.)
 */
export async function requestNotificationWithReason(reason: string): Promise<void> {
  const tmplIds = [WX_TEMPLATE_RENT, WX_TEMPLATE_OVERDUE].filter(Boolean);
  if (tmplIds.length === 0) return;

  // Show a brief toast explaining why we need notification permission
  Taro.showToast({
    title: reason,
    icon: 'none',
    duration: 2000,
  });

  setTimeout(() => {
    Taro.requestSubscribeMessage({
      tmplIds,
      entityIds: tmplIds,
      success: () => {},
      fail: () => {},
    });
  }, 1500);
}
