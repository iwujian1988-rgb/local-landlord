export const FEE_TYPE_LABELS: Record<number, string> = {
  0: '固定',
  1: '手填',
};

export const DEFAULT_FEE_ITEMS = [
  { name: '房租', type: 0, isRent: true },
  { name: '水费', type: 1 },
  { name: '电费', type: 1 },
  { name: '燃气费', type: 1 },
  { name: '物业费', type: 0 },
  { name: '网费', type: 0 },
] as const;
