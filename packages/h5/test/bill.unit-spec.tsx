import { renderToStaticMarkup } from 'react-dom/server';
import { BillDetails } from '../src/BillPage';
import { fetchBillByToken, ShareBillPayload } from '../src/api';

const bill: ShareBillPayload = {
  roomName: '101', tenantName: '王先生', period: '2026-08', periodEnd: '2026-10',
  totalAmount: 4000, paidAmount: 3600,
  items: [{ name: '房租', amount: 3600 }],
  qrCodes: [{ type: 'wechat', imageUrl: '/pay.png', payeeName: '房东' }],
  payeeName: '房东', landlordName: '房东', paymentNote: '',
};

it('partial payment shows the remaining stored balance and full billing period', () => {
  const html = renderToStaticMarkup(<BillDetails data={bill} />);
  expect(html).toContain('class="amount-number">400</span>');
  expect(html).toContain('2026年8月—2026年10月');
  expect(html).toContain('/pay.png');
});

it.each([{ paidAmount: 4000 }, { isPaid: true }])('settled bills do not ask tenants to pay again: %p', override => {
  const html = renderToStaticMarkup(<BillDetails data={{ ...bill, ...override }} />);
  expect(html).toContain('账单已结清，无需付款');
  expect(html).not.toContain('/pay.png');
  expect(html).not.toContain('长按二维码识别付款');
});

it('rounds fractional remaining balances to cents', () => {
  const html = renderToStaticMarkup(<BillDetails data={{ ...bill, totalAmount: 0.3, paidAmount: 0.1 }} />);
  expect(html).toContain('class="amount-number">0.2</span>');
});

describe('shared bill loading', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });
  it('uses the same-origin endpoint and returns the bill', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ code: 0, data: bill }) });
    expect(await fetchBillByToken('a/b')).toEqual(bill);
    expect(fetch).toHaveBeenCalledWith('/api/share/bill/a%2Fb', expect.any(Object));
  });
  it('shows the expired link error even when delivered as HTTP 200', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ code: 403, message: '链接已失效' }) });
    await expect(fetchBillByToken('expired')).rejects.toThrow('链接已失效');
  });
});
