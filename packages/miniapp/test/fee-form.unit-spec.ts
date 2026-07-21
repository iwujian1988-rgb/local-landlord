import { calculateInitialFeeTotal, normalizeFeeItems } from '../src/utils/fee-form';

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
});
