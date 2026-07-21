import {
  getNextTenantWizardIndex,
  getPreviousTenantWizardIndex,
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
});
