export interface FeeFormItem {
  name: string;
  type: 'fixed' | 'manual';
  amount: string;
  enabled: boolean;
  isRent: boolean;
  cycleMode: 'rent' | 'monthly';
  /** Missing on historical data; it means advance collection. */
  collectionTiming?: 'advance' | 'arrears';
  billingMonths?: number;
  initialMonths?: number;
}

/** Accept current array responses and older wrapped response aliases. */
export function normalizeFeeItems(data: unknown, legacyPayMonths = 1): FeeFormItem[] {
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
    collectionTiming: fee.collectionTiming === 'arrears' ? 'arrears' : 'advance',
    billingMonths: normalizeMonths(fee.billingMonths, fee.cycleMode === 'monthly' ? 1 : legacyPayMonths),
    initialMonths: normalizeMonths(fee.initialMonths, fee.billingMonths ?? (fee.cycleMode === 'monthly' ? 1 : legacyPayMonths)),
  }));
}

function normalizeMonths(value: unknown, fallback: number): number {
  const months = Number(value);
  return Number.isInteger(months) && months >= 1 && months <= 12 ? months : Math.max(1, fallback || 1);
}

export function getRoomNameFromResponse(data: unknown): string {
  const room = (data as any)?.room || data;
  return typeof (room as any)?.name === 'string' ? (room as any).name : '';
}

export function calculateFeeCycleTotal(fees: FeeFormItem[], payMonths: number): number {
  const total = fees.reduce((sum, fee) => {
    if (!fee.enabled || fee.type === 'manual') return sum;
    const amount = Number(fee.amount) || 0;
    const months = fee.billingMonths || (fee.cycleMode === 'monthly' ? 1 : Math.max(1, payMonths));
    return sum + Math.round(amount * months * 100) / 100;
  }, 0);
  return Math.round(total * 100) / 100;
}

export function calculateInitialFeeTotal(fees: FeeFormItem[]): number {
  const total = fees.reduce((sum, fee) => {
    if (!fee.enabled || fee.type === 'manual' || fee.collectionTiming === 'arrears') return sum;
    const amount = Number(fee.amount) || 0;
    return sum + Math.round(amount * normalizeMonths(fee.initialMonths, 1) * 100) / 100;
  }, 0);
  return Math.round(total * 100) / 100;
}

export function calculateMoveInGrandTotal(deposit: string | number, fees: FeeFormItem[]): number {
  const total = (Number(deposit) || 0) + calculateInitialFeeTotal(fees);
  return Math.round(total * 100) / 100;
}

/**
 * 房东选择“每几个月收一次”时，入住首收默认采用同一周期。
 * 后续仍可在“入住怎么收”步骤单独改成后收或其他月数。
 */
export function applyBillingMonthsDefault(fee: FeeFormItem, months: number): FeeFormItem {
  const normalizedMonths = normalizeMonths(months, 1);
  return {
    ...fee,
    billingMonths: normalizedMonths,
    initialMonths: normalizedMonths,
  };
}

export function describeInitialFee(fee: FeeFormItem): string {
  if (fee.type === 'manual') return '以后按实际金额填写';
  if (fee.collectionTiming === 'arrears') return '入住后再收，本次不收';

  const amount = Number(fee.amount) || 0;
  const months = normalizeMonths(fee.initialMonths, fee.billingMonths || 1);
  const total = Math.round(amount * months * 100) / 100;
  return `${amount} 元 × ${months} 个月 = ${total} 元`;
}
