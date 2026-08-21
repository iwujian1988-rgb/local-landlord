import Taro from '@tarojs/taro';
import { WX_TEMPLATE_RENT, WX_TEMPLATE_OVERDUE } from '../config';

/**
 * Request notification subscription at key moments.
 *
 * MUST be called synchronously from inside a user TAP gesture's call stack —
 * before any `await`, `setTimeout`, or async boundary. WeChat enforces this
 * strictly and any break in the sync chain triggers
 * "requestSubscribeMessage:fail can only be invoked by user TAP gesture".
 *
 * WeChat subscription messages are ONE-TIME use — each call to
 * requestSubscribeMessage gives us ONE send opportunity per template.
 */
export function requestNotification(): void {
  const tmplIds = [WX_TEMPLATE_RENT, WX_TEMPLATE_OVERDUE].filter(Boolean);
  if (tmplIds.length === 0) return;

  Taro.requestSubscribeMessage({
    tmplIds,
    entityIds: tmplIds,
    success: (res) => {
      const rejected = tmplIds.filter(id => (res as Record<string, unknown>)[id] === 'reject');
      if (rejected.length > 0) {
        console.warn('[notification] user rejected templates:', rejected.join(','));
      }
    },
    fail: (err) => {
      // e.g. "can only be invoked by user TAP gesture" or invalid template ID —
      // without this log the failure is completely silent.
      console.warn('[notification] requestSubscribeMessage failed:', err?.errMsg);
    },
  });
}
