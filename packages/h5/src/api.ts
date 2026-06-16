export interface ShareBillPayload {
  roomName: string;
  tenantName: string;
  period: string;
  items: { name: string; amount: number }[];
  totalAmount: number;
  paidAmount: number;
  qrCodes: { type: string; imageUrl: string; payeeName: string }[];
  payeeName: string;
  landlordName: string;
  paymentNote: string;
}

/**
 * Resolve the share token by calling the public share endpoint.
 * API base is same origin in production; falls back to localhost in dev.
 */
export async function fetchBillByToken(token: string): Promise<ShareBillPayload> {
  const apiBase = import.meta.env.DEV ? 'http://localhost:3000' : '';
  const res = await fetch(`${apiBase}/api/share/bill/${encodeURIComponent(token)}`, {
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
  return json.data || json;
}
