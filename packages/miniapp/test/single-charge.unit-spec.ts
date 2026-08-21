import {
  buildSingleChargeCreatePath,
  getCreatedSingleChargeId,
} from '../src/utils/single-charge';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const singleChargePageSource = readFileSync(
  resolve(__dirname, '../src/pages/single-charge/index.tsx'),
  'utf8',
);

describe('single charge API contract', () => {
  it('TC-SINGLE-CHARGE-001: 创建地址与后端路由一致，不得多出 rent 前缀', () => {
    expect(buildSingleChargeCreatePath(17)).toBe('/rooms/17/single-charge');
  });

  it('TC-SINGLE-CHARGE-002: 只有后端返回有效记录 ID 才能进入分享预览', () => {
    expect(getCreatedSingleChargeId({ id: 42 })).toBe(42);
    expect(getCreatedSingleChargeId({ id: undefined })).toBe(0);
    expect(getCreatedSingleChargeId({ id: 0 })).toBe(0);
  });

  it('TC-SINGLE-CHARGE-003: 保存后直接进入租客账单预览，不经过重复确认页', () => {
    expect(singleChargePageSource).toContain('forwardSingleChargeShare(singleChargeId)');
    expect(singleChargePageSource).not.toContain('/pages/payment/index');
  });

  it('TC-SINGLE-CHARGE-004: 分享失败再次点击时只重试分享，不重复创建收费', () => {
    expect(singleChargePageSource).toContain('if (createdChargeId > 0)');
    expect(singleChargePageSource).toContain('forwardSingleChargeShare(createdChargeId)');
  });
});
