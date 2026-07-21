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

export function getNextRentCollectionText(
  initialMonths: number,
  billingMonths: number,
  monthlyRent: number,
  moveInDate?: string,
  rentDay = 1,
): string {
  const monthsUntilNext = Math.max(1, initialMonths || 1);
  const normalizedBillingMonths = Math.max(1, billingMonths || 1);
  const nextAmount = Math.round(Math.max(0, monthlyRent) * normalizedBillingMonths * 100) / 100;
  let when = monthsUntilNext === 1 ? '下个月收租日' : `${monthsUntilNext}个月后的收租日`;

  if (/^\d{4}-\d{2}-\d{2}$/.test(moveInDate || '')) {
    const [year, month] = (moveInDate as string).split('-').map(Number);
    const target = new Date(year, month - 1 + monthsUntilNext, 1);
    const targetDay = rentDay === 0
      ? new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
      : Math.min(Math.max(1, rentDay), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate());
    when = `${target.getFullYear()}年${target.getMonth() + 1}月${targetDay}日`;
  }

  return `${when}再收${normalizedBillingMonths}个月，共${nextAmount}元`;
}

/** Standard first rent equals the contract cycle; only expose larger advance-payment options. */
export function getRentInitialMonthOptions(billingMonths: number): number[] {
  const cycle = Math.max(1, Math.min(12, Math.trunc(billingMonths || 1)));
  if (cycle === 1) return [1, 3, 6, 12];
  const options: number[] = [];
  for (let months = cycle; months <= 12; months += cycle) options.push(months);
  return options;
}
