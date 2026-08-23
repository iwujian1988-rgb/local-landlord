// 微信云托管容器的出站流量走内网代理（DNS 把 api.weixin.qq.com 解析到
// 169.254.10.1），HTTPS 会撞平台自签名证书（DEPTH_ZERO_SELF_SIGNED_CERT）。
// 官方方案：容器内用 HTTP 协议调用，平台自动注入 access_token，无需密钥。
// https://developers.weixin.qq.com/miniprogram/dev/wxcloudrun/src/guide/weixin/faq.html
// 通过 WX_API_BASE 显式指定，或在未指定时按 DNS 结果自动探测。

let cached: { base: string; injected: boolean } | null = null;

/**
 * Resolve the WeChat API base: env override wins; otherwise if DNS maps
 * api.weixin.qq.com to a link-local address (169.254.x.x — the CloudBase
 * internal proxy), switch to plain HTTP where the platform injects
 * access_token and MITM'd TLS would otherwise fail.
 */
export async function resolveWxApiBase(): Promise<{ base: string; injected: boolean }> {
  if (cached) return cached;
  let base = process.env.WX_API_BASE || 'https://api.weixin.qq.com';
  let injected = base.startsWith('http://');
  if (!process.env.WX_API_BASE) {
    try {
      const dns = await import('dns');
      const records = await dns.promises.lookup('api.weixin.qq.com', { all: true });
      if (records.some(r => r.address.startsWith('169.254.'))) {
        base = 'http://api.weixin.qq.com';
        injected = true;
      }
    } catch {
      // DNS unavailable — keep https and let the fetch error surface.
    }
  }
  cached = { base, injected };
  return cached;
}
