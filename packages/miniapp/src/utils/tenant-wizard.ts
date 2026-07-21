export const TENANT_REVIEW_STEP = 10;

export function getTenantWizardStepIds(isEdit: boolean): number[] {
  return isEdit
    ? [0, 1, 2, 3, 4, 5, 9, TENANT_REVIEW_STEP]
    : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, TENANT_REVIEW_STEP];
}

export function getNextTenantWizardIndex(
  currentIndex: number,
  stepIds: number[],
  initialReceived: boolean,
): number {
  const currentStep = stepIds[currentIndex];
  const increment = currentStep === 6 && !initialReceived ? 3 : 1;
  return Math.min(currentIndex + increment, stepIds.length - 1);
}

export function getPreviousTenantWizardIndex(
  currentIndex: number,
  stepIds: number[],
  isEdit: boolean,
  initialReceived: boolean,
): number {
  const currentStep = stepIds[currentIndex];
  const decrement = currentStep === 9 && !isEdit && !initialReceived ? 3 : 1;
  return Math.max(0, currentIndex - decrement);
}
