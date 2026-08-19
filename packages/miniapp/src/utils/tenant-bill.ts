export interface TenantBillItem {
  name: string;
  amount: number;
}

export interface TenantBillPayload {
  roomName: string;
  tenantName: string;
  period: string;
  periodEnd?: string | null;
  items: TenantBillItem[];
  totalAmount: number;
  paidAmount: number;
  outstandingAmount?: number;
  isPaid?: boolean;
  qrCodes: { type: string; imageUrl: string; payeeName: string }[];
  payeeName: string;
  landlordName: string;
  paymentNote: string;
}

function money(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100) / 100;
}

/** The visible total always comes from visible line items, preventing detail/total drift. */
export function normalizeTenantBill(payload: TenantBillPayload) {
  const items = Array.isArray(payload.items)
    ? payload.items
      .filter(item => item && typeof item.name === 'string')
      .map(item => ({ name: item.name.trim() || '费用', amount: money(item.amount) }))
    : [];
  const itemTotal = money(items.reduce((sum, item) => sum + item.amount, 0));
  const totalAmount = items.length > 0 ? itemTotal : money(payload.totalAmount);
  const rawPaid = payload.isPaid ? totalAmount : money(payload.paidAmount);
  const paidAmount = money(Math.min(totalAmount, rawPaid));
  const outstandingAmount = money(Math.max(0, totalAmount - paidAmount));
  return {
    ...payload,
    items: items.length > 0 ? items : [{ name: '应收费用', amount: totalAmount }],
    totalAmount,
    paidAmount,
    outstandingAmount,
    isPaid: outstandingAmount <= 0,
    qrCodes: Array.isArray(payload.qrCodes) ? payload.qrCodes.filter(code => code?.imageUrl) : [],
  };
}

export function formatBillPeriod(period: string, periodEnd?: string | null): string {
  const format = (value: string) => {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    return match ? `${match[1]}年${Number(match[2])}月` : value;
  };
  if (periodEnd && periodEnd !== period) return `${format(period)}—${format(periodEnd)}`;
  return format(period);
}
