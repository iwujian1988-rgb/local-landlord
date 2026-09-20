export function rentEmptyView(input: {
  incomplete: boolean; roomCount: number | null; records: number; pending: number;
}) {
  if (input.records > 0 || input.pending > 0) return null;
  if (input.incomplete) return { title: '账单没有加载完整', action: '重新加载', retry: true };
  if (input.roomCount === 0) return { title: '还没有房间', action: '添加房间', retry: false };
  return { title: '本月没有待收租金', action: '查看房间', retry: false };
}
