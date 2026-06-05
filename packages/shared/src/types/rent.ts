export enum RentRecordType {
  BILL_SENT = 0,
  BILL_PAID = 1,
  SINGLE_CHARGE = 2,
  SINGLE_PAID = 3,
  REMINDER = 4,
  OVERDUE = 5,
}

export interface RentRecord {
  id: number;
  roomId: number;
  billId?: number;
  type: RentRecordType;
  title: string;
  description?: string;
  amount?: number;
  createdAt: string;
}

export interface SingleCharge {
  id: number;
  roomId: number;
  tenantId: number;
  feeType: string;
  amount: number;
  note?: string;
  status: 0 | 1;
  paidAt?: string;
  createdAt: string;
}

export interface CreateSingleChargeDTO {
  feeType: string;
  amount: number;
  note?: string;
}

export interface RemindTenantDTO {
  tenantId: string;
  method: 'wechat' | 'copy';
}
