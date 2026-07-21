import {
  getNextTenantWizardIndex,
  getPreviousTenantWizardIndex,
  getNextRentCollectionText,
  getRentInitialMonthOptions,
  getTenantWizardStepIds,
} from '../src/utils/tenant-wizard';

describe('tenant wizard navigation', () => {
  it('shows all receipt questions when the move-in payment was received', () => {
    const steps = getTenantWizardStepIds(false);
    const receiptIndex = steps.indexOf(6);
    expect(steps[getNextTenantWizardIndex(receiptIndex, steps, true)]).toBe(7);
    expect(steps[getNextTenantWizardIndex(receiptIndex + 1, steps, true)]).toBe(8);
  });

  it('skips amount and method questions when payment was not received', () => {
    const steps = getTenantWizardStepIds(false);
    const receiptIndex = steps.indexOf(6);
    const notesIndex = getNextTenantWizardIndex(receiptIndex, steps, false);
    expect(steps[notesIndex]).toBe(9);
    expect(steps[getPreviousTenantWizardIndex(notesIndex, steps, false, false)]).toBe(6);
  });

  it('does not include move-in receipt questions while editing a tenant', () => {
    expect(getTenantWizardStepIds(true)).toEqual([0, 1, 2, 3, 4, 5, 9, 10]);
  });

  it('explains that one initial month under quarterly billing is collected again next month', () => {
    expect(getNextRentCollectionText(1, 3, 1000)).toBe('下个月收租日再收3个月，共3000元');
  });

  it('shows the exact next collection date when move-in date is known', () => {
    expect(getNextRentCollectionText(3, 3, 1000, '2026-07-20', 15))
      .toBe('2026年10月15日再收3个月，共3000元');
    expect(getNextRentCollectionText(1, 3, 1000, '2026-01-20', 0))
      .toBe('2026年2月28日再收3个月，共3000元');
  });

  it('never offers fewer initial rent months than the selected contract cycle', () => {
    expect(getRentInitialMonthOptions(1)).toEqual([1, 3, 6, 12]);
    expect(getRentInitialMonthOptions(3)).toEqual([3, 6, 9, 12]);
    expect(getRentInitialMonthOptions(6)).toEqual([6, 12]);
  });
});
