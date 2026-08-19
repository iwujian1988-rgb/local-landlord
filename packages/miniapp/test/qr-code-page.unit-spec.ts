import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('payment QR page regressions', () => {
  const source = readFileSync(
    resolve(__dirname, '../src/pages/qr-code/index.tsx'),
    'utf8',
  );

  it('TC-QR-PAGE-001: returning from the media picker must not reload persisted data', () => {
    expect(source).toContain("import Taro, { useLoad } from '@tarojs/taro'");
    expect(source).not.toContain('useDidShow');
  });

  it('TC-QR-PAGE-002: each uploaded code is persisted immediately through stable CRUD endpoints', () => {
    expect(source).not.toContain('/payment-qr/save-all');
    expect(source).toContain('const saveRes = currentCode?.id');
    expect(source).toContain("await post('/payment-qr', payload)");
    expect(source).toContain("title: '已上传并保存'");
  });
});
