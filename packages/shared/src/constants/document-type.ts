export const DOCUMENT_TYPE_LABELS: Record<number, string> = {
  0: '合同',
  1: '押金收据',
  2: '租金收据',
  3: '水电单',
  4: '维修单',
  5: '其他',
};

export const DOCUMENT_TYPE_FILTER_OPTIONS = [
  { label: '全部', value: '' },
  { label: '合同', value: 0 },
  { label: '收据', value: 1 },
  { label: '水电单', value: 3 },
  { label: '维修', value: 4 },
  { label: '押金', value: 1 },
] as const;
