interface InitialPaymentOptions {
  isEdit: boolean;
  initialReceived: boolean;
  initialAmount: string;
  initialMethod: string;
  initialDate: string;
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
