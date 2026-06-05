export enum BillStatus {
  PENDING = 0,
  PAID = 1,
  OVERDUE = 2,
}

export interface Bill {
  id: number;
  roomId: number;
  tenantId: number;
  period: string;
  totalAmount: number;
  status: BillStatus;
  photos?: string[];
  sentAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillItem {
  id: number;
  billId: number;
  feeName: string;
  amount: number;
}

export interface CreateBillDTO {
  period: string;
  items: Array<{ feeName: string; amount: number }>;
  photos?: string[];
}

export interface ConfirmPaymentDTO {
  paidAt?: string;
}
