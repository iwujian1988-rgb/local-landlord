import {
  FeeRule,
  feeRuleAmountForMonths,
  feeRuleDueMonths,
  feeRuleInitialAmount,
  normalizeFeeRules,
} from '../src/modules/fee/fee-rules';

function fixed(overrides: Partial<FeeRule> = {}): FeeRule {
  return {
    name: '房租', type: 0, amount: 1000, enabled: 1, isRent: 1,
    cycleMode: 'rent', billingMonths: 3, initialMonths: 3, sortOrder: 0,
    ...overrides,
  };
}

describe('independent tenancy fee schedules', () => {
  it('押一付三的首期房租为三个月，押金不属于收费规则', () => {
    expect(feeRuleInitialAmount(fixed(), 3)).toBe(3000);
  });

  it('网费可入住预收六个月，并在第七个月再次收六个月', () => {
    const internet = fixed({ name: '网费', amount: 50, isRent: 0, billingMonths: 6, initialMonths: 6 });
    expect(feeRuleInitialAmount(internet, 3)).toBe(300);
    expect(feeRuleDueMonths(internet, 3, '2026-01-15', '2026-02')).toBe(0);
    expect(feeRuleDueMonths(internet, 3, '2026-01-15', '2026-06')).toBe(0);
    expect(feeRuleDueMonths(internet, 3, '2026-01-15', '2026-07')).toBe(6);
  });

  it('首次预收六个月、平时三个月一收时不会在第四个月重复收费', () => {
    const rent = fixed({ billingMonths: 3, initialMonths: 6 });
    expect(feeRuleDueMonths(rent, 3, '2026-01-01', '2026-04')).toBe(0);
    expect(feeRuleDueMonths(rent, 3, '2026-01-01', '2026-07')).toBe(3);
  });

  it('不同费用可在同一个月独立到期', () => {
    const rent = fixed({ billingMonths: 3, initialMonths: 3 });
    const internet = fixed({ name: '网费', amount: 50, isRent: 0, billingMonths: 6, initialMonths: 6 });
    expect(feeRuleAmountForMonths(rent, feeRuleDueMonths(rent, 3, '2026-01-01', '2026-07'))).toBe(3000);
    expect(feeRuleAmountForMonths(internet, feeRuleDueMonths(internet, 3, '2026-01-01', '2026-07'))).toBe(300);
  });

  it('拒绝超过十二个月的预收配置', () => {
    expect(() => normalizeFeeRules([
      { name: '房租', type: 'fixed', amount: 1000, enabled: true, isRent: true, billingMonths: 3, initialMonths: 13 },
    ])).toThrow();
  });
});
