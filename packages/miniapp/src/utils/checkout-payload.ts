export interface CheckoutSettlement {
  depositStatus: number;
  refundAmount: number;
  deductReason: string;
  moveOutReading?: string;
}

/** Translate the modal's UI field names to the backend UpdateRoomDto contract. */
export function buildCheckoutPayload(settlement?: CheckoutSettlement) {
  if (!settlement) {
    return { status: 0, action: 'checkout', depositStatus: 0 };
  }
  return {
    status: 0,
    action: 'checkout',
    depositStatus: settlement.depositStatus,
    depositRefundAmount: settlement.refundAmount,
    depositDeductReason: settlement.deductReason,
    ...(settlement.moveOutReading ? { moveOutReading: settlement.moveOutReading } : {}),
  };
}
