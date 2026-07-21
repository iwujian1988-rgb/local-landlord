export interface FeeFormItem {
  name: string;
  type: 'fixed' | 'manual';
  amount: string;
  enabled: boolean;
  isRent: boolean;
  cycleMode: 'rent' | 'monthly';
}

/** Accept current array responses and older wrapped response aliases. */
export function normalizeFeeItems(data: unknown): FeeFormItem[] {
  const source = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.fees)
      ? (data as any).fees
      : Array.isArray((data as any)?.items)
        ? (data as any).items
        : [];
  return source.filter(Boolean).map((fee: any) => ({
    name: String(fee.name || ''),
    type: fee.type === 'manual' || fee.type === 1 ? 'manual' : 'fixed',
    amount: String(fee.amount ?? ''),
    enabled: fee.enabled !== false && fee.enabled !== 0,
    isRent: fee.isRent === true || fee.isRent === 1,
    cycleMode: fee.cycleMode === 'monthly' ? 'monthly' : 'rent',
  }));
}

export function getRoomNameFromResponse(data: unknown): string {
  const room = (data as any)?.room || data;
  return typeof (room as any)?.name === 'string' ? (room as any).name : '';
}

export function calculateFeeCycleTotal(fees: FeeFormItem[], payMonths: number): number {
  const total = fees.reduce((sum, fee) => {
    if (!fee.enabled || fee.type === 'manual') return sum;
    const amount = Number(fee.amount) || 0;
    return sum + Math.round(amount * (fee.cycleMode === 'monthly' ? 1 : Math.max(1, payMonths)) * 100) / 100;
  }, 0);
  return Math.round(total * 100) / 100;
}
