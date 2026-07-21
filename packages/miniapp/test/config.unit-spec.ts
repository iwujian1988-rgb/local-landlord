/**
 * Pure-logic tests for miniapp/src/config.ts.
 *
 * The file has no Taro deps — it's just URL string manipulation driven by
 * build-time globals. We import it directly and exercise the regex paths.
 */
import {
  API_BASE_URL,
  ASSET_BASE_URL,
  H5_BASE_URL,
  normalizeUploadUrlForStorage,
  resolveAsset,
} from '../src/config';

describe('config — build-time constants', () => {
  it('TC-CFG-001: API_BASE_URL 来自 setup.ts 注入', () => {
    expect(API_BASE_URL).toBe('https://example.test/api');
  });

  it('TC-CFG-002: ASSET_BASE_URL 是 API_BASE_URL 去掉 /api 后缀', () => {
    expect(ASSET_BASE_URL).toBe('https://example.test');
  });

  it('TC-CFG-003: H5_BASE_URL 默认跟 API 域名保持一致', () => {
    // NODE_ENV=test 不是 development，应使用去掉 /api 后的同一服务域名，
    // 避免配置一个证书或部署状态不同的第二个 H5 域名。
    expect(H5_BASE_URL).toBe('https://example.test/h5');
  });
});

describe('normalizeUploadUrlForStorage', () => {
  it('TC-CFG-NORM-001: localhost 绝对 URL → 只保留 /uploads 路径', () => {
    expect(normalizeUploadUrlForStorage('http://127.0.0.1:3000/uploads/abc.png')).toBe('/uploads/abc.png');
    expect(normalizeUploadUrlForStorage('http://127.0.0.1:3100/uploads/abc.png')).toBe('/uploads/abc.png');
    expect(normalizeUploadUrlForStorage('http://localhost:3000/uploads/abc.png')).toBe('/uploads/abc.png');
  });

  it('TC-CFG-NORM-002: 内网 IP（192.168.x / 10.x / 172.16-31.x）也归一化', () => {
    expect(normalizeUploadUrlForStorage('http://192.168.1.100:3000/uploads/x.png')).toBe('/uploads/x.png');
    expect(normalizeUploadUrlForStorage('http://10.0.0.5:3000/uploads/x.png')).toBe('/uploads/x.png');
    expect(normalizeUploadUrlForStorage('http://172.16.0.1:3000/uploads/x.png')).toBe('/uploads/x.png');
    expect(normalizeUploadUrlForStorage('http://172.31.255.255:3000/uploads/x.png')).toBe('/uploads/x.png');
  });

  it('TC-CFG-NORM-003: 172.32.x 不算私网（保留原 URL）', () => {
    // 172.32 is publicly assigned space — must NOT be rewritten
    expect(normalizeUploadUrlForStorage('http://172.32.0.1:3000/uploads/x.png')).toBe(
      'http://172.32.0.1:3000/uploads/x.png',
    );
  });

  it('TC-CFG-NORM-004: 公网域名绝对 URL 不动', () => {
    const u = 'https://example.com/uploads/x.png';
    expect(normalizeUploadUrlForStorage(u)).toBe(u);
  });

  it('TC-CFG-NORM-005: cos.myqcloud.com → tcb.qcloud.la（云托管 COS 域名换写）', () => {
    expect(
      normalizeUploadUrlForStorage('https://bucket-12345.cos.ap-guangzhou.myqcloud.com/uploads/abc.png'),
    ).toBe('https://bucket-12345.tcb.qcloud.la/uploads/abc.png');
  });

  it('TC-CFG-NORM-006: 已是相对路径 /uploads/... 不动', () => {
    expect(normalizeUploadUrlForStorage('/uploads/abc.png')).toBe('/uploads/abc.png');
  });

  it('TC-CFG-NORM-007: undefined / null / 空串 → 空串', () => {
    expect(normalizeUploadUrlForStorage(undefined)).toBe('');
    expect(normalizeUploadUrlForStorage(null)).toBe('');
    expect(normalizeUploadUrlForStorage('')).toBe('');
  });

  it('TC-CFG-NORM-008: 带 query string 时保留', () => {
    expect(normalizeUploadUrlForStorage('http://127.0.0.1:3000/uploads/a.png?token=xyz')).toBe(
      '/uploads/a.png?token=xyz',
    );
  });
});

describe('resolveAsset', () => {
  it('TC-CFG-RESOLVE-001: 相对路径前缀 ASSET_BASE_URL', () => {
    expect(resolveAsset('/uploads/abc.png')).toBe('https://example.test/uploads/abc.png');
  });

  it('TC-CFG-RESOLVE-002: 已经是 https URL 不动', () => {
    const u = 'https://cdn.example.com/x.png';
    expect(resolveAsset(u)).toBe(u);
  });

  it('TC-CFG-RESOLVE-003: localhost 绝对 URL 先归一化再加前缀', () => {
    // First normalize strips host → '/uploads/x.png' → then prepended
    expect(resolveAsset('http://127.0.0.1:3000/uploads/x.png')).toBe('https://example.test/uploads/x.png');
  });

  it('TC-CFG-RESOLVE-004: cos URL 改写后走 resolveAsset 仍是 https 不动', () => {
    expect(resolveAsset('https://bucket.cos.ap-guangzhou.myqcloud.com/uploads/x.png')).toBe(
      'https://bucket.tcb.qcloud.la/uploads/x.png',
    );
  });

  it('TC-CFG-RESOLVE-005: undefined → 空串', () => {
    expect(resolveAsset(undefined)).toBe('');
    expect(resolveAsset(null)).toBe('');
  });
});
