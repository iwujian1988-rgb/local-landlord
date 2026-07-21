import { getPropertyCoverImage } from '../src/utils/property-form';
import { withInitialPayment, withOptionalTenantDates } from '../src/utils/tenant-form';

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
