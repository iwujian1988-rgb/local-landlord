import { rentEmptyView } from '../src/utils/rent-view';

describe('收租页空状态', () => {
  const empty = { incomplete: false, roomCount: 0, records: 0, pending: 0 };
  it('查询失败时不能提示没有欠款或添加房间', () => {
    expect(rentEmptyView({ ...empty, incomplete: true })).toMatchObject({ title: '暂时看不了退租租客的欠款', action: '再试一次', retry: true });
  });
  it('确认没有房间才能显示首次添加', () => {
    expect(rentEmptyView(empty)?.action).toBe('添加房间');
    expect(rentEmptyView({ ...empty, roomCount: null })?.action).toBe('查看房间');
    expect(rentEmptyView({ ...empty, roomCount: 2 })?.action).toBe('查看房间');
  });
  it('任何已收账单、待收账单、未来收款或退租欠款都不显示空状态', () => {
    expect(rentEmptyView({ ...empty, records: 1 })).toBeNull();
    expect(rentEmptyView({ ...empty, pending: 10 })).toBeNull();
    expect(rentEmptyView({ ...empty, incomplete: true, records: 1 })).toBeNull();
  });
});
