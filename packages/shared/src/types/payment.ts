export enum PaymentQRType {
  WECHAT = 0,
  ALIPAY = 1,
  BANK = 2,
}

export interface PaymentQR {
  id: number;
  landlordId: number;
  type: PaymentQRType;
  imageUrl?: string;
  isDefault: boolean;
  payeeName: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePaymentQRDTO {
  imageUrl?: string;
  isDefault?: boolean;
  payeeName?: string;
  note?: string;
}
