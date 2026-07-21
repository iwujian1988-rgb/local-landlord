interface InitialPaymentOptions {
  isEdit: boolean;
  initialReceived: boolean;
  initialAmount: string;
  initialMethod: string;
  initialDate: string;
}

interface OptionalTenantDates {
  moveInDate: string;
  contractEndDate: string;
}

/** Omit blank optional dates instead of sending invalid empty strings. */
export function withOptionalTenantDates<T extends Record<string, any>>(
  base: T,
  dates: OptionalTenantDates,
): T & Record<string, any> {
  const result: Record<string, any> = { ...base };
  const moveInDate = dates.moveInDate.trim();
  const contractEndDate = dates.contractEndDate.trim();
  if (moveInDate) result.moveInDate = moveInDate;
  if (contractEndDate) result.contractEndDate = contractEndDate;
  return result as T & Record<string, any>;
}

/**
 * Add move-in payment fields only when the landlord explicitly marked the
 * first rent as received. Kept pure so the UI-to-API contract is testable.
 */
export function withInitialPayment<T extends Record<string, any>>(
  base: T,
  options: InitialPaymentOptions,
): T & Record<string, any> {
  const amount = Number(options.initialAmount);
  if (options.isEdit || !options.initialReceived || !(amount > 0)) return base;
  return {
    ...base,
    initialPaymentMethod: options.initialMethod,
    initialPaymentDate: options.initialDate,
    initialPaymentAmount: amount,
  };
}
