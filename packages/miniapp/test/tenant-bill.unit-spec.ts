import {
  buildTenantBillCopyText,
  formatBillPeriod,
  isLandlordTenantBillPreview,
  normalizeTenantBill,
  TenantBillPayload,
} from '../src/utils/tenant-bill';

const payload = (overrides: Partial<TenantBillPayload> = {}): TenantBillPayload => ({
  roomName: '101', tenantName: '王大力', period: '2026-08',
  items: [{ name: '房租', amount: 3000 }, { name: '物业费', amount: 600 }],
  totalAmount: 9999, paidAmount: 0, qrCodes: [], payeeName: '', landlordName: '', paymentNote: '',
  ...overrides,
});

describe('normalizeTenantBill', () => {
  it('TC-TENANT-BILL-001: 明细为真源，防止页面合计与明细不一致', () => {
    const result = normalizeTenantBill(payload());
    expect(result.totalAmount).toBe(3600);
    expect(result.outstandingAmount).toBe(3600);
  });

  it('TC-TENANT-BILL-002: 部分付款只要求支付剩余金额', () => {
    const result = normalizeTenantBill(payload({ totalAmount: 3600, paidAmount: 1000 }));
    expect(result.paidAmount).toBe(1000);
    expect(result.outstandingAmount).toBe(2600);
    expect(result.isPaid).toBe(false);
  });

  it('TC-TENANT-BILL-003: 已付状态不会再显示待付金额', () => {
    const result = normalizeTenantBill(payload({ paidAmount: 0, isPaid: true }));
    expect(result.paidAmount).toBe(3600);
    expect(result.outstandingAmount).toBe(0);
    expect(result.isPaid).toBe(true);
  });

  it('TC-TENANT-BILL-004: 金额统一保留到分，避免浮点误差', () => {
    const result = normalizeTenantBill(payload({
      items: [{ name: '水费', amount: 0.1 }, { name: '电费', amount: 0.2 }],
    }));
    expect(result.totalAmount).toBe(0.3);
  });
});

describe('formatBillPeriod', () => {
  it('TC-TENANT-BILL-005: 多月账单显示完整起止周期', () => {
    expect(formatBillPeriod('2026-08', '2026-10')).toBe('2026年8月—2026年10月');
  });
});

describe('tenant bill page roles', () => {
  it('TC-TENANT-BILL-006: 只有房东入口显示发送操作', () => {
    expect(isLandlordTenantBillPreview('landlord')).toBe(true);
    expect(isLandlordTenantBillPreview(undefined)).toBe(false);
    expect(isLandlordTenantBillPreview('tenant')).toBe(false);
  });

  it('TC-TENANT-BILL-007: 复制文字包含周期、明细和真实合计', () => {
    const text = buildTenantBillCopyText(normalizeTenantBill(payload()));
    expect(text).toContain('101 · 2026年8月账单');
    expect(text).toContain('房租：3,000元');
    expect(text).toContain('本次应付：3,600元');
  });
});
