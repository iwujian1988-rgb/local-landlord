export type PaymentQrType = 'wechat' | 'alipay' | 'bank';

const QR_TYPE_NUM: Record<PaymentQrType, number> = {
  wechat: 0,
  alipay: 1,
  bank: 2,
};

interface PaymentQrFormValue {
  type: PaymentQrType;
  label: string;
  imageUrl: string;
  isDefault: boolean;
}

/** Create and update DTOs historically used different type fields. */
export function buildPaymentQrPayload(value: PaymentQrFormValue, isUpdate: boolean) {
  const common = {
    label: value.label,
    imageUrl: value.imageUrl,
    isDefault: value.isDefault,
  };
  return isUpdate
    ? { ...common, type: QR_TYPE_NUM[value.type] }
    : { ...common, typeNum: QR_TYPE_NUM[value.type] };
}
