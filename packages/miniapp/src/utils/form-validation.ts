export type FormErrors = Record<string, string>;

export function firstFormError(errors: FormErrors): string {
  return Object.values(errors)[0] || '';
}

export function validatePropertyForm(name: string): FormErrors {
  const value = name.trim();
  if (!value) return { name: '请输入房源名称' };
  if (value.length > 64) return { name: '房源名称不能超过64个字' };
  return {};
}

interface RoomFormValues {
  name: string;
  rent: string;
  propertyId: number;
  isEdit: boolean;
  availableType: 'anytime' | 'date';
  availableDate: string;
}

export function validateRoomForm(values: RoomFormValues): FormErrors {
  const errors: FormErrors = {};
  const name = values.name.trim();
  const rent = Number(values.rent);
  if (!name) errors.name = '请输入房间名称';
  else if (name.length > 32) errors.name = '房间名称不能超过32个字';

  if (!values.rent.trim() || !Number.isFinite(rent) || rent < 0) {
    errors.rent = '请输入大于或等于0的有效租金';
  } else if (rent > 999999) {
    errors.rent = '月租金不能超过999999元';
  }
  if (!values.isEdit && (!Number.isInteger(values.propertyId) || values.propertyId <= 0)) {
    errors.property = '没有找到对应房源，请返回重新进入';
  }
  if (values.availableType === 'date' && !isValidDateOnly(values.availableDate)) {
    errors.availableDate = '请选择有效的可入住日期';
  }
  return errors;
}

interface TenantFormValues {
  name: string;
  phone: string;
  roomId: number;
  moveInDate: string;
  contractEndDate: string;
  deposit: string;
  initialReceived: boolean;
  initialAmount: string;
  initialDate: string;
  moveInReading: string;
}

export function validateTenantForm(values: TenantFormValues): FormErrors {
  const errors: FormErrors = {};
  const name = values.name.trim();
  const phone = values.phone.trim();
  if (!name) errors.name = '请输入租客姓名';
  else if (name.length > 32) errors.name = '租客姓名不能超过32个字';
  if (!phone) errors.phone = '请输入租客电话';
  else if (phone.length > 20) errors.phone = '租客电话不能超过20个字符';
  if (!Number.isInteger(values.roomId) || values.roomId <= 0) {
    errors.room = '没有找到对应房间，请返回重新进入';
  }
  if (values.moveInDate && !isValidDateOnly(values.moveInDate)) {
    errors.moveInDate = '请选择有效的入住日期';
  }
  if (values.contractEndDate && !isValidDateOnly(values.contractEndDate)) {
    errors.contractEndDate = '请选择有效的合同到期日期';
  } else if (values.moveInDate && values.contractEndDate && values.contractEndDate < values.moveInDate) {
    errors.contractEndDate = '合同到期日期不能早于入住日期';
  }
  if (values.deposit.trim()) {
    const deposit = Number(values.deposit);
    if (!Number.isFinite(deposit) || deposit < 0) errors.deposit = '请输入有效的押金金额';
  }
  if (values.initialReceived) {
    const amount = Number(values.initialAmount);
    if (!values.initialAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
      errors.initialAmount = '已选择“已收”，请输入大于0的实收金额';
    }
    if (!isValidDateOnly(values.initialDate)) errors.initialDate = '请选择有效的收款日期';
  }
  if (values.moveInReading.trim().length > 256) {
    errors.moveInReading = '入住水电读数不能超过256个字';
  }
  return errors;
}

interface FeeFormValue {
  name: string;
  type: 'fixed' | 'manual';
  amount: string;
  enabled: boolean;
  isRent?: boolean;
}

export function validateFeeForm(fees: FeeFormValue[]): FormErrors {
  if (fees.length === 0) return { fee: '请至少添加一个收费项目' };
  if (fees.length > 50) return { fee: '收费项目不能超过50个' };
  if (!fees.some(fee => fee.enabled)) return { fee: '请至少启用一个收费项目' };
  if (!fees.some(fee => fee.isRent)) return { fee: '收费项目必须包含房租' };
  const names = new Set<string>();
  for (let index = 0; index < fees.length; index += 1) {
    const fee = fees[index];
    const label = `第${index + 1}个收费项`;
    if (!fee.name.trim()) return { fee: `${label}请输入名称` };
    if (fee.name.trim().length > 32) return { fee: `${label}名称不能超过32个字` };
    if (names.has(fee.name.trim())) return { fee: `收费项目“${fee.name.trim()}”重复` };
    names.add(fee.name.trim());
    if (fee.enabled && fee.type === 'fixed') {
      const amount = Number(fee.amount);
      if (!/^\d+(\.\d{1,2})?$/.test(fee.amount.trim()) || !Number.isFinite(amount) || amount < 0 || amount > 99999999.99) {
        return { fee: `${label}请输入有效金额` };
      }
    }
  }
  return {};
}

export function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}
