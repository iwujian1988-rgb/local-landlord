/**
 * Tests for miniapp/src/services/share.ts.
 *
 * The module wraps post() + Taro.setClipboardData + Taro.showModal into
 * user-facing flows. We mock the Taro side and let `post` hit the Taro.request
 * mock, then assert: missing-id guard, server error, clipboard failure path,
 * and the success → modal → preview link.
 */
import Taro from '@tarojs/taro';
import { ensureAbsoluteShareUrl, generateAndCopyShareLink, openShareWebview, openTenantBill, forwardBillShare } from '../src/services/share';

const mockRequest = () => (Taro.request as jest.Mock);

describe('generateAndCopyShareLink', () => {
  beforeEach(() => jest.clearAllMocks());

  it('TC-SHARE-001: 没 billId/singleChargeId → 弹 toast + 返回 null', async () => {
    const out = await generateAndCopyShareLink();
    expect(out).toBe(null);
    expect(Taro.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '缺少账单 ID' }));
    expect(mockRequest()).not.toHaveBeenCalled();
  });

  it('TC-SHARE-002: server 返回 code≠0 → toast + 返回 null', async () => {
    mockRequest().mockResolvedValueOnce({ statusCode: 200, data: { code: 1001, message: '账单不存在' } });
    const out = await generateAndCopyShareLink(99);
    expect(out).toBe(null);
    expect(Taro.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '账单不存在' }));
  });

  it('TC-SHARE-003: server 返回 token，clipboard 成功 → 返回 result', async () => {
    mockRequest().mockResolvedValueOnce({
      statusCode: 200,
      data: {
        code: 0,
        data: { token: 'tk', shareUrl: 'https://h5/x?token=tk', expiresAt: '2099-01-01' },
      },
    });
    (Taro.setClipboardData as jest.Mock).mockImplementation((opts: any) => opts.success());

    const out = await generateAndCopyShareLink(7);
    expect(out).toEqual({
      token: 'tk',
      shareUrl: 'https://h5/x?token=tk',
      expiresAt: '2099-01-01',
    });
    expect(Taro.setClipboardData).toHaveBeenCalledWith(expect.objectContaining({ data: 'https://h5/x?token=tk' }));
  });

  it('TC-SHARE-004: clipboard 失败 → catch → toast + 返回 null', async () => {
    mockRequest().mockResolvedValueOnce({
      statusCode: 200,
      data: { code: 0, data: { token: 'tk', shareUrl: 'https://h5/x', expiresAt: '2099' } },
    });
    (Taro.setClipboardData as jest.Mock).mockImplementation((opts: any) => opts.fail());

    const out = await generateAndCopyShareLink(7);
    expect(out).toBe(null);
    expect(Taro.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '生成链接失败，请稍后重试' }));
  });

  it('TC-SHARE-005: post 抛网络异常 → catch → toast + 返回 null', async () => {
    mockRequest().mockRejectedValueOnce(new Error('network down'));
    const out = await generateAndCopyShareLink(7);
    expect(out).toBe(null);
    expect(Taro.showToast).toHaveBeenCalled();
  });

  it('TC-SHARE-006: singleChargeId 路径 — payload 字段对', async () => {
    mockRequest().mockResolvedValueOnce({
      statusCode: 200,
      data: { code: 0, data: { token: 'tk', shareUrl: 'u', expiresAt: '2099' } },
    });
    (Taro.setClipboardData as jest.Mock).mockImplementation((opts: any) => opts.success());

    await generateAndCopyShareLink(undefined, 42);
    const reqBody = mockRequest().mock.calls[0][0].data;
    expect(reqBody).toEqual({ billId: undefined, singleChargeId: 42 });
  });

  it('TC-SHARE-007: 服务端意外返回相对链接时，复制可打开的完整 H5 地址', async () => {
    mockRequest().mockResolvedValueOnce({
      statusCode: 200,
      data: { code: 0, data: { token: 'tk', shareUrl: '/h5/?token=tk', expiresAt: '2099' } },
    });
    (Taro.setClipboardData as jest.Mock).mockImplementation((opts: any) => opts.success());

    const out = await generateAndCopyShareLink(7);
    expect(out?.shareUrl).toMatch(/^https?:\/\//);
    expect(Taro.setClipboardData).toHaveBeenCalledWith(expect.objectContaining({ data: expect.stringMatching(/^https?:\/\//) }));
  });
});

describe('ensureAbsoluteShareUrl', () => {
  it('TC-SHARE-URL-001: 保留服务端返回的完整 HTTPS 地址', () => {
    expect(ensureAbsoluteShareUrl('https://example.com/h5/?token=tk', 'tk'))
      .toBe('https://example.com/h5/?token=tk');
  });

  it('TC-SHARE-URL-002: 相对地址改为当前 H5 域名的完整地址', () => {
    const result = ensureAbsoluteShareUrl('/h5/?token=tk', 'tk');
    expect(result).toMatch(/^https?:\/\//);
    expect(result).toContain('/h5/?token=tk');
  });

  it('TC-SHARE-URL-003: 生产环境不把 localhost 链接复制给租客', () => {
    const result = ensureAbsoluteShareUrl('http://127.0.0.1:3100/h5/?token=tk', 'tk');
    expect(result).toMatch(/^https?:\/\//);
    expect(result).not.toContain('127.0.0.1');
  });
});

describe('openShareWebview', () => {
  beforeEach(() => jest.clearAllMocks());

  it('TC-SHARE-WV-001: 跳到 share-webview，token 被 encodeURIComponent', () => {
    openShareWebview('a b/中文');
    expect(Taro.navigateTo).toHaveBeenCalledWith({
      url: `/pages/share-webview/index?token=${encodeURIComponent('a b/中文')}`,
    });
  });

  it('TC-SHARE-WV-002: 普通英数 token 不被特殊字符破坏', () => {
    openShareWebview('abc123-_.');
    expect(Taro.navigateTo).toHaveBeenCalledWith({
      url: `/pages/share-webview/index?token=abc123-_.`,
    });
  });

  it('TC-SHARE-WV-003: 服务端自定义域名随预览参数传入，不依赖前端写死域名', () => {
    const shareUrl = 'https://rent.example.com/h5/?token=tk';
    openShareWebview('tk', shareUrl);
    expect(Taro.navigateTo).toHaveBeenCalledWith({
      url: `/pages/share-webview/index?token=tk&url=${encodeURIComponent(shareUrl)}`,
    });
  });
});

describe('forwardBillShare', () => {
  beforeEach(() => jest.clearAllMocks());

  it('TC-SHARE-FWD-001: 生成失败 → 返回 null，不弹 modal', async () => {
    mockRequest().mockResolvedValueOnce({ statusCode: 200, data: { code: 1001, message: 'fail' } });
    const out = await forwardBillShare(99);
    expect(out).toBe(null);
    expect(Taro.showModal).not.toHaveBeenCalled();
  });

  it('TC-SHARE-FWD-002: 成功 → 打开原生租客账单，不复制 H5 链接', async () => {
    mockRequest().mockResolvedValueOnce({
      statusCode: 200,
      data: { code: 0, data: { token: 'tk', shareUrl: 'u', expiresAt: '2099' } },
    });
    const out = await forwardBillShare(1);
    expect(out?.token).toBe('tk');
    expect(Taro.navigateTo).toHaveBeenCalledWith({
      url: '/pages/tenant-bill/index?token=tk',
    });
    expect(Taro.setClipboardData).not.toHaveBeenCalled();
    expect(Taro.showModal).not.toHaveBeenCalled();
  });

  it('TC-SHARE-FWD-003: 原生账单 token 中的特殊字符会编码', () => {
    openTenantBill('a b/中文');
    expect(Taro.navigateTo).toHaveBeenCalledWith({
      url: `/pages/tenant-bill/index?token=${encodeURIComponent('a b/中文')}`,
    });
  });
});
