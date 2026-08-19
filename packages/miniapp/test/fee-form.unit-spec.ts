import { applyBillingMonthsDefault, calculateInitialFeeTotal, calculateMoveInGrandTotal, describeInitialFee, normalizeFeeItems } from '../src/utils/fee-form';

describe('move-in fee form calculations', () => {
  it('independently totals rent and six-month internet prepayment', () => {
    const fees = normalizeFeeItems([
      { name: '房租', type: 'fixed', amount: 1000, enabled: true, isRent: true, billingMonths: 3, initialMonths: 3 },
      { name: '网费', type: 'fixed', amount: 50, enabled: true, isRent: false, billingMonths: 6, initialMonths: 6 },
    ]);
    expect(calculateInitialFeeTotal(fees)).toBe(3300);
  });

  it('legacy quarterly rules retain the tenant rent cycle', () => {
    const [rent] = normalizeFeeItems([
      { name: '房租', type: 'fixed', amount: 1000, enabled: true, isRent: true, cycleMode: 'rent' },
    ], 3);
    expect(rent.billingMonths).toBe(3);
    expect(rent.initialMonths).toBe(3);
  });

  it('does not add a deferred fee to the move-in total', () => {
    const fees = normalizeFeeItems([
      { name: '房租', type: 'fixed', amount: 1000, enabled: true, isRent: true, billingMonths: 3, initialMonths: 3 },
      { name: '物业费', type: 'fixed', amount: 100, enabled: true, isRent: false, collectionTiming: 'arrears', billingMonths: 3, initialMonths: 3 },
    ]);
    expect(calculateInitialFeeTotal(fees)).toBe(3000);
  });

  it('defaults the move-in months to the selected billing cycle', () => {
    const [propertyFee] = normalizeFeeItems([
      { name: '物业费', type: 'fixed', amount: 200, enabled: true, isRent: false, billingMonths: 1, initialMonths: 1 },
    ]);
    const updated = applyBillingMonthsDefault(propertyFee, 3);

    expect(updated.billingMonths).toBe(3);
    expect(updated.initialMonths).toBe(3);
    expect(calculateInitialFeeTotal([updated])).toBe(600);
    expect(describeInitialFee(updated)).toBe('200 元 × 3 个月 = 600 元');
  });

  it('keeps an explicit first-collection override after the billing default', () => {
    const [propertyFee] = normalizeFeeItems([
      { name: '物业费', type: 'fixed', amount: 200, enabled: true, isRent: false },
    ]);
    const updated = { ...applyBillingMonthsDefault(propertyFee, 3), initialMonths: 1 };

    expect(calculateInitialFeeTotal([updated])).toBe(200);
    expect(describeInitialFee(updated)).toBe('200 元 × 1 个月 = 200 元');
  });

  it('calculates the reviewed test scenario as 8100 excluding deposit', () => {
    const fees = normalizeFeeItems([
      { name: '房租', type: 'fixed', amount: 2500, enabled: true, isRent: true, billingMonths: 3, initialMonths: 3 },
      { name: '物业费', type: 'fixed', amount: 200, enabled: true, isRent: false, billingMonths: 3, initialMonths: 3 },
      { name: '水电费', type: 'manual', amount: 0, enabled: true, isRent: false },
      { name: '网费', type: 'fixed', amount: 50, enabled: true, isRent: false, collectionTiming: 'arrears', billingMonths: 6, initialMonths: 6 },
    ]);

    expect(calculateInitialFeeTotal(fees)).toBe(8100);
    expect(calculateMoveInGrandTotal(2500, fees)).toBe(10600);
  });
});
