import { getPropertyCoverImage } from '../src/utils/property-form';
import { withInitialPayment, withOptionalTenantDates } from '../src/utils/tenant-form';
import {
  isValidDateOnly,
  validateFeeForm,
  validatePropertyForm,
  validateRoomForm,
  validateTenantForm,
} from '../src/utils/form-validation';
import { buildCheckoutPayload } from '../src/utils/checkout-payload';
import { buildPaymentQrPayload } from '../src/utils/payment-qr-form';
import { getRoomNameFromResponse, normalizeFeeItems } from '../src/utils/fee-form';

describe('property form regressions', () => {
  it('TC-PROP-FORM-001: 编辑房源读取后端 coverImage 字段', () => {
    expect(getPropertyCoverImage({ coverImage: 'https://cdn.test/house.png' }))
      .toBe('https://cdn.test/house.png');
  });

  it('TC-PROP-FORM-002: 兼容旧 coverImageURL 字段', () => {
    expect(getPropertyCoverImage({ coverImageURL: '/uploads/legacy.png' }))
      .toBe('/uploads/legacy.png');
  });
});

describe('frontend form validation regressions', () => {
  it('TC-VALIDATE-001: property and room fields match backend limits', () => {
    expect(validatePropertyForm('')).toHaveProperty('name');
    expect(validatePropertyForm('a'.repeat(65))).toHaveProperty('name');
    expect(validateRoomForm({
      name: '101', rent: '1000000', propertyId: 1, isEdit: false,
      availableType: 'anytime', availableDate: '',
    })).toHaveProperty('rent');
    expect(validateRoomForm({
      name: '101', rent: '2500', propertyId: 0, isEdit: false,
      availableType: 'date', availableDate: '',
    })).toEqual(expect.objectContaining({ property: expect.any(String), availableDate: expect.any(String) }));
    expect(validateRoomForm({
      name: '免费房', rent: '0', propertyId: 1, isEdit: false,
      availableType: 'anytime', availableDate: '',
    })).toEqual({});
  });

  it('TC-VALIDATE-002: tenant dates, deposit and received payment fail before POST', () => {
    const errors = validateTenantForm({
      name: '王先生', phone: '13800000001', roomId: 17,
      moveInDate: '2026-02-30', contractEndDate: '2025-01-01',
      deposit: '-1', initialReceived: true, initialAmount: '',
      initialDate: '', moveInReading: '',
    });
    expect(errors).toEqual(expect.objectContaining({
      moveInDate: expect.any(String),
      contractEndDate: expect.any(String),
      deposit: expect.any(String),
      initialAmount: expect.any(String),
      initialDate: expect.any(String),
    }));
  });

  it('TC-VALIDATE-003: fee name and enabled fixed amount cannot be silently coerced', () => {
    expect(validateFeeForm([
      { name: '', type: 'fixed', amount: '', enabled: true },
    ])).toHaveProperty('fee');
    expect(validateFeeForm([
      { name: '网费', type: 'fixed', amount: '', enabled: true },
    ])).toHaveProperty('fee');
    expect(validateFeeForm([
      { name: '水费', type: 'manual', amount: '', enabled: true },
    ])).toEqual({});
    expect(validateFeeForm([
      { name: '免费项', type: 'fixed', amount: '0', enabled: true },
    ])).toEqual({});
  });

  it('TC-VALIDATE-004: date-only validation rejects impossible dates', () => {
    expect(isValidDateOnly('2026-07-21')).toBe(true);
    expect(isValidDateOnly('2026-02-30')).toBe(false);
    expect(isValidDateOnly('')).toBe(false);
  });
});

describe('checkout payload regressions', () => {
  it('TC-CHECKOUT-001: refund modal fields map to backend DTO names', () => {
    expect(buildCheckoutPayload({
      depositStatus: 1,
      refundAmount: 1800,
      deductReason: '维修扣除200元',
      moveOutReading: '电1340 / 水78',
    })).toEqual({
      status: 0,
      action: 'checkout',
      depositStatus: 1,
      depositRefundAmount: 1800,
      depositDeductReason: '维修扣除200元',
      moveOutReading: '电1340 / 水78',
    });
  });

  it('TC-CHECKOUT-002: skip settlement still performs checkout explicitly', () => {
    expect(buildCheckoutPayload()).toEqual({ status: 0, action: 'checkout', depositStatus: 0 });
  });
});

describe('payment QR payload regressions', () => {
  const alipay = {
    type: 'alipay' as const,
    label: '支付宝',
    imageUrl: 'cloud://bucket/alipay.png',
    isDefault: true,
  };

  it('TC-QR-FORM-001: create sends numeric typeNum accepted by create DTO', () => {
    expect(buildPaymentQrPayload(alipay, false)).toEqual({
      label: '支付宝', imageUrl: alipay.imageUrl, isDefault: true, typeNum: 1,
    });
  });

  it('TC-QR-FORM-002: update sends numeric type accepted by update DTO', () => {
    expect(buildPaymentQrPayload(alipay, true)).toEqual({
      label: '支付宝', imageUrl: alipay.imageUrl, isDefault: true, type: 1,
    });
  });
});

describe('fee page response regressions', () => {
  it('TC-FEE-FORM-001: reads current array and legacy wrapped fee responses', () => {
    const fee = { name: '房租', type: 0, amount: 2500, enabled: 1, isRent: 1 };
    expect(normalizeFeeItems([fee])).toEqual([expect.objectContaining({
      name: '房租', type: 'fixed', amount: '2500', enabled: true, isRent: true,
    })]);
    expect(normalizeFeeItems({ fees: [fee] })).toHaveLength(1);
    expect(normalizeFeeItems({ items: [fee] })).toHaveLength(1);
  });

  it('TC-FEE-FORM-002: room detail title reads nested room response', () => {
    expect(getRoomNameFromResponse({ room: { name: '101' } })).toBe('101');
    expect(getRoomNameFromResponse({ name: '102' })).toBe('102');
  });
});

describe('tenant initial-payment payload regressions', () => {
  const base = { name: '王先生', phone: '13800000001', rentDay: 1 };

  it('TC-TENANT-FORM-001: 勾选入住已收后必须把金额/方式/日期发给后端', () => {
    expect(withInitialPayment(base, {
      isEdit: false,
      initialReceived: true,
      initialAmount: '2500',
      initialMethod: 'wechat',
      initialDate: '2026-07-21',
    })).toEqual({
      ...base,
      initialPaymentMethod: 'wechat',
      initialPaymentDate: '2026-07-21',
      initialPaymentAmount: 2500,
    });
  });

  it('TC-TENANT-FORM-002: 未勾选或编辑模式不得重复创建首期收款', () => {
    expect(withInitialPayment(base, {
      isEdit: false,
      initialReceived: false,
      initialAmount: '2500',
      initialMethod: 'wechat',
      initialDate: '2026-07-21',
    })).toEqual(base);
    expect(withInitialPayment(base, {
      isEdit: true,
      initialReceived: true,
      initialAmount: '2500',
      initialMethod: 'wechat',
      initialDate: '2026-07-21',
    })).toEqual(base);
  });
});

describe('tenant optional-date payload regressions', () => {
  it('TC-TENANT-FORM-003: 空日期不得发送空字符串导致后端 400', () => {
    expect(withOptionalTenantDates({ name: '王先生' }, {
      moveInDate: '   ',
      contractEndDate: '',
    })).toEqual({ name: '王先生' });
  });

  it('TC-TENANT-FORM-004: 已选日期保持 ISO 值发送', () => {
    expect(withOptionalTenantDates({ name: '王先生' }, {
      moveInDate: '2026-07-21',
      contractEndDate: '2027-07-21',
    })).toEqual({
      name: '王先生',
      moveInDate: '2026-07-21',
      contractEndDate: '2027-07-21',
    });
  });
});
