export interface ShareBillPayload {
  roomName: string;
  tenantName: string;
  period: string;
  periodEnd?: string | null;
  items: { name: string; amount: number }[];
  totalAmount: number;
  paidAmount: number;
  isPaid?: boolean;
  qrCodes: { type: string; imageUrl: string; payeeName: string }[];
  payeeName: string;
  landlordName: string;
  paymentNote: string;
}

/**
 * Resolve the share token by calling the public share endpoint.
 * Use the same origin; Vite proxies /api during development.
 */
export async function fetchBillByToken(token: string): Promise<ShareBillPayload> {
  const res = await fetch(`/api/share/bill/${encodeURIComponent(token)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    let msg = '加载失败';
    try {
      const body = await res.json();
      msg = body?.message || msg;
    } catch {
      // ignore parse error
    }
    throw new Error(msg);
  }
  const json = await res.json();
  if (json?.code !== 0 || !json.data) {
    throw new Error(json?.message || '加载失败');
  }
  return json.data;
}
