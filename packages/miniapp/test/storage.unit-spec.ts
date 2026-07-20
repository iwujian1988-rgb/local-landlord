/**
 * Tests for miniapp/src/utils/storage.ts.
 *
 * getAppData/setAppData are thin synchronous wrappers around Taro storage;
 * we exercise the empty-bucket default + round-trip.
 */
import Taro from '@tarojs/taro';
import { getAppData, setAppData } from '../src/utils/storage';

describe('storage helpers', () => {
  beforeEach(() => Taro.clearStorageSync());

  it('TC-STOR-001: 空缓存 → 返回默认结构 {properties:[],rooms:[],tenants:[]}', () => {
    const out = getAppData();
    expect(out).toEqual({ properties: [], rooms: [], tenants: [] });
  });

  it('TC-STOR-002: 写入再读 → round-trip', () => {
    setAppData({
      properties: [{ id: 1, name: 'p' }],
      rooms: [{ id: 2 }],
      tenants: [{ id: 3 }],
      bills: [{ id: 4 }],
    });
    const out = getAppData();
    expect(out.properties).toHaveLength(1);
    expect(out.rooms).toHaveLength(1);
    expect(out.tenants).toHaveLength(1);
    expect(out.bills).toEqual([{ id: 4 }]);
  });

  it('TC-STOR-003: 覆盖写入 → 旧数据被替换', () => {
    setAppData({ properties: [{ id: 1 }], rooms: [], tenants: [] });
    setAppData({ properties: [], rooms: [], tenants: [] });
    expect(getAppData().properties).toEqual([]);
  });
});
