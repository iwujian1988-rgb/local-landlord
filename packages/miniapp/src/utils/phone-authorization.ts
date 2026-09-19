export function readPhoneAuthorization(detail: { code?: string; errMsg?: string; errno?: number } = {}) {
  if (detail.code) return { code: detail.code, cancelled: false, message: '', diagnostic: '' };
  const raw = detail.errMsg || '';
  const cancelled = /user deny|user cancel|cancelled|canceled/i.test(raw);
  return { code: '', cancelled,
    message: cancelled ? '你已取消授权，手机号没有绑定。' : '微信没有完成手机号授权，暂时无法绑定。你的登录和房间数据不受影响。',
    diagnostic: raw || (detail.errno != null ? `错误码 ${detail.errno}` : '微信未返回授权结果'),
  };
}
