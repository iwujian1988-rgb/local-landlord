export function rentEmptyView(input: {
  incomplete: boolean; roomCount: number | null; records: number; pending: number;
}) {
  if (input.records > 0 || input.pending > 0) return null;
  if (input.incomplete) return { title: '暂时看不了退租租客的欠款', description: '本月账单仍可正常查看。', action: '再试一次', retry: true };
  if (input.roomCount === 0) return { title: '先添加你的第一间房', description: '添加房间和租客后，在这里查看账单、记录收款。', action: '添加房间', retry: false };
  return { title: '本月还没有账单', description: '可以到房间里查看租客和收租日期。', action: '查看房间', retry: false };
}
