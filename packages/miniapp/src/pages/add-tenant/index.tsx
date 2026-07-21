import { View, Text, Input, Textarea, Picker } from '@tarojs/components';
import Taro, { useDidHide } from '@tarojs/taro';
import { useState, useCallback, useEffect, useRef } from 'react';
import { get, post, put } from '../../services/request';
import { requestNotification } from '../../services/notification';
import { withInitialPayment, withOptionalTenantDates } from '../../utils/tenant-form';
import { firstFormError, validateTenantForm } from '../../utils/form-validation';
import { calculateInitialFeeTotal, FeeFormItem, normalizeFeeItems } from '../../utils/fee-form';
import { validateFeeForm } from '../../utils/form-validation';
import { getNextTenantWizardIndex, getPreviousTenantWizardIndex, getTenantWizardStepIds } from '../../utils/tenant-wizard';
import './index.scss';

const rentDayLabels = Array.from({ length: 28 }, (_, i) => `${i + 1}号`);
rentDayLabels.push('月底');

function rentDayToIndex(day: number): number {
  if (day === 0) return 28;
  if (day >= 1 && day <= 28) return day - 1;
  return 0; // default to 1号
}

function indexToRentDay(idx: number): number {
  return idx === 28 ? 0 : idx + 1;
}

function rentDayToLabel(day: number): string {
  if (day === 0) return '月底';
  return `${day}号`;
}

// Payment method presets. 押X付Y: X = 押月数 (deposit multiplier), Y = 付月数
// (bill cadence — bills auto-generate every Y months instead of monthly).
// Both are persisted on the tenant.
const PAYMENT_PRESETS = [
  { label: '押一付一', depositMonths: 1, payMonths: 1 },
  { label: '押二付一', depositMonths: 2, payMonths: 1 },
  { label: '押三付一', depositMonths: 3, payMonths: 1 },
  { label: '押一付三', depositMonths: 1, payMonths: 3 },
  { label: '押二付三', depositMonths: 2, payMonths: 3 },
  { label: '押三付三', depositMonths: 3, payMonths: 3 },
];
const PAYMENT_LABELS = [...PAYMENT_PRESETS.map((p) => p.label), '自定义金额'];
const CUSTOM_PAYMENT_IDX = PAYMENT_LABELS.length - 1;

const PAYMENT_METHOD_LABELS = ['现金', '微信', '支付宝', '银行转账'];
const PAYMENT_METHOD_VALUES = ['cash', 'wechat', 'alipay', 'bank'];
const MONTH_OPTIONS = [1, 3, 6, 12];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function inferPaymentIdx(deposit: number, rent: number, payMonths: number): number {
  // Try to match a preset by (depositMonths, payMonths). If deposit doesn't match
  // any integer multiplier or payMonths is non-standard, fall back to 自定义.
  if (!deposit || !rent) return CUSTOM_PAYMENT_IDX;
  const depositMonths = deposit / rent;
  if (!Number.isInteger(depositMonths) || depositMonths < 1 || depositMonths > 3) {
    return CUSTOM_PAYMENT_IDX;
  }
  const idx = PAYMENT_PRESETS.findIndex(
    p => p.depositMonths === depositMonths && p.payMonths === payMonths,
  );
  return idx >= 0 ? idx : CUSTOM_PAYMENT_IDX;
}

export default function AddTenant() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const urlRoomId = Number(routerParams.roomId) || 0;
  const tenantId = Number(routerParams.tenantId) || 0;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [moveInDate, setMoveInDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [rentDay, setRentDay] = useState<number>(1);
  const [deposit, setDeposit] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isEdit, setIsEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentRoomName, setCurrentRoomName] = useState('');
  const [currentRoomRent, setCurrentRoomRent] = useState(0);
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomLoadError, setRoomLoadError] = useState(false);
  const [paymentIdx, setPaymentIdx] = useState<number>(-1);
  const [loadedPayMonths, setLoadedPayMonths] = useState<number>(1);
  const inferredRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const saveCompletedRef = useRef(false);
  const feeDraftRestoredRef = useRef(false);
  const initialAmountEditedRef = useRef(false);
  const initialDepositEditedRef = useRef(false);
  const [feeItems, setFeeItems] = useState<FeeFormItem[]>([]);
  const [feesLoading, setFeesLoading] = useState(false);
  const [feesLoadError, setFeesLoadError] = useState(false);
  const [showExtraFees, setShowExtraFees] = useState(false);
  const [wizardIndex, setWizardIndex] = useState(0);
  const [feeEditorIndex, setFeeEditorIndex] = useState<number | null>(null);
  const [feeEditorStage, setFeeEditorStage] = useState(0);

  // P0-A: 入住实收
  const [initialReceived, setInitialReceived] = useState<boolean>(false);
  const [initialAmount, setInitialAmount] = useState<string>('');
  const [initialDepositAmount, setInitialDepositAmount] = useState<string>('');
  const [initialMethodIdx, setInitialMethodIdx] = useState<number>(0);
  const [initialDate, setInitialDate] = useState<string>(todayISO());
  // P0-C: 入住水电读数
  const [moveInReading, setMoveInReading] = useState<string>('');

  const loadFeeItems = useCallback(async () => {
    if (urlRoomId <= 0) return;
    setFeesLoading(true);
    setFeesLoadError(false);
    try {
      const res = await get<unknown>(`/rooms/${urlRoomId}/fee-items`);
      if (!feeDraftRestoredRef.current) setFeeItems(normalizeFeeItems(res.data));
    } catch (error) {
      console.error('[AddTenant] 加载收费项目失败:', error);
      setFeesLoadError(true);
    } finally {
      setFeesLoading(false);
    }
  }, [urlRoomId]);

  const loadRoom = useCallback(async () => {
    if (urlRoomId <= 0) return;
    setRoomLoading(true);
    setRoomLoadError(false);
    try {
      const res = await get<any>(`/rooms/${urlRoomId}`);
      if (res.code !== 0 || !res.data) throw new Error('房间信息为空');
      setCurrentRoomName(res.data.name || '');
      setCurrentRoomRent(Number(res.data.rent) || 0);
    } catch (error) {
      console.error('[AddTenant] 加载房间失败:', error);
      setRoomLoadError(true);
    } finally {
      setRoomLoading(false);
    }
  }, [urlRoomId]);

  // Load room info
  useEffect(() => {
    if (urlRoomId > 0) {
      loadRoom();
      loadFeeItems();
    }
  }, [urlRoomId, loadFeeItems, loadRoom]);

  // Pre-fill for edit mode
  useEffect(() => {
    if (tenantId > 0) {
      get<any>(`/tenants/${tenantId}`).then((res) => {
        if (res.code === 0 && res.data) {
          const found = res.data;
          Taro.setNavigationBarTitle({ title: '编辑租客' });
          setIsEdit(true);
          setName(found.name || '');
          setPhone(found.phone || '');
          setMoveInDate(found.moveInDate || '');
          setContractEndDate(found.contractEndDate || '');
          setDeposit(found.deposit ? String(found.deposit) : '');
          setLoadedPayMonths(Number(found.payMonths) || 1);
          setNote(found.note || '');
          const day = found.rentDay;
          if (day !== undefined) {
            setRentDay(day);
          }
          // P0-A: 回填入住实收
          if (found.initialPaymentMethod) {
            setInitialReceived(true);
            const mIdx = PAYMENT_METHOD_VALUES.indexOf(found.initialPaymentMethod);
            setInitialMethodIdx(mIdx >= 0 ? mIdx : 0);
            setInitialDate(found.initialPaymentDate || todayISO());
            setInitialAmount(found.initialPaymentAmount != null ? String(found.initialPaymentAmount) : '');
            setInitialDepositAmount(found.initialDepositAmount != null ? String(found.initialDepositAmount) : '');
          }
          // P0-C: 回填入住水电读数
          if (found.moveInReading) {
            setMoveInReading(found.moveInReading);
          }
          if (Array.isArray(found.feeItems)) setFeeItems(normalizeFeeItems(found.feeItems, Number(found.payMonths) || 1));
        }
      }).catch(() => {});
    }
  }, [tenantId]);

  // Infer payment method once both rent and deposit are known (edit mode)
  useEffect(() => {
    if (!isEdit || inferredRef.current) return;
    if (!currentRoomRent || !deposit) return;
    setPaymentIdx(inferPaymentIdx(Number(deposit), currentRoomRent, loadedPayMonths));
    inferredRef.current = true;
  }, [isEdit, currentRoomRent, deposit, loadedPayMonths]);

  // Check draft
  useEffect(() => {
    if (tenantId <= 0) {
      Taro.setNavigationBarTitle({ title: '登记租客' });
      const draft: any = Taro.getStorageSync('draft_tenant');
      if (draft && Number(draft.roomId) === urlRoomId) {
        setName(draft.name || '');
        setPhone(draft.phone || '');
        setMoveInDate(draft.moveInDate || '');
        setContractEndDate(draft.contractEndDate || '');
        if (draft.rentDay !== undefined) setRentDay(draft.rentDay);
        if (draft.deposit) setDeposit(draft.deposit);
        if (draft.paymentIdx !== undefined) setPaymentIdx(draft.paymentIdx);
        if (draft.note) setNote(draft.note);
        if (draft.initialReceived) setInitialReceived(true);
        if (draft.initialAmount) setInitialAmount(draft.initialAmount);
        if (draft.initialDepositAmount) setInitialDepositAmount(draft.initialDepositAmount);
        if (draft.initialMethodIdx !== undefined) setInitialMethodIdx(draft.initialMethodIdx);
        if (draft.initialDate) setInitialDate(draft.initialDate);
        if (draft.moveInReading) setMoveInReading(draft.moveInReading);
        if (Number.isInteger(draft.wizardIndex)) setWizardIndex(Math.min(10, Math.max(0, Number(draft.wizardIndex))));
        if (Array.isArray(draft.feeItems)) {
          feeDraftRestoredRef.current = true;
          setFeeItems(normalizeFeeItems(draft.feeItems));
        }
        Taro.showToast({ title: '已恢复未完成的草稿', icon: 'none', duration: 2000 });
      } else if (draft) {
        Taro.removeStorageSync('draft_tenant');
      }
    }
  }, []);

  useDidHide(() => {
    if (tenantId <= 0 && !saveCompletedRef.current) {
      const formData = {
        roomId: urlRoomId,
        name, phone, moveInDate, contractEndDate,
        rentDay, deposit, note, paymentIdx,
        initialReceived, initialAmount, initialDepositAmount, initialMethodIdx, initialDate, moveInReading,
        feeItems, wizardIndex,
      };
      if (name || phone) {
        Taro.setStorageSync('draft_tenant', formData);
      }
    }
  });

  const handlePaymentChange = useCallback((idx: number) => {
    if (roomLoading || roomLoadError) {
      Taro.showToast({ title: roomLoadError ? '请先重新加载房间' : '房间信息正在加载', icon: 'none' });
      return;
    }
    setPaymentIdx(idx);
    if (idx !== CUSTOM_PAYMENT_IDX && currentRoomRent > 0) {
      const { depositMonths, payMonths: pm } = PAYMENT_PRESETS[idx];
      setDeposit(String(currentRoomRent * depositMonths));
      setFeeItems(prev => prev.map(fee => fee.isRent
        ? { ...fee, billingMonths: pm, initialMonths: pm, cycleMode: 'rent' }
        : fee));
      if (initialReceived && !initialAmountEditedRef.current) {
        setInitialAmount(String(calculateInitialFeeTotal(feeItems.map(fee => fee.isRent ? { ...fee, initialMonths: pm } : fee))));
      }
      if (initialReceived && !initialDepositEditedRef.current) {
        setInitialDepositAmount(String(currentRoomRent * depositMonths));
      }
    }
  }, [currentRoomRent, initialReceived, feeItems, roomLoading, roomLoadError]);

  const handleToggleInitialReceived = useCallback((on: boolean) => {
    setInitialReceived(on);
    if (on && currentRoomRent > 0) {
      initialAmountEditedRef.current = false;
      initialDepositEditedRef.current = false;
      setInitialAmount(String(calculateInitialFeeTotal(feeItems)));
      setInitialDepositAmount(String(Number(deposit) || 0));
    }
  }, [currentRoomRent, feeItems, deposit]);

  const updateFee = useCallback((index: number, patch: Partial<FeeFormItem>) => {
    setFeeItems(prev => prev.map((fee, i) => i === index ? { ...fee, ...patch } : fee));
  }, []);

  const addFee = useCallback((name: string, type: 'fixed' | 'manual') => {
    setShowExtraFees(true);
    const existingIndex = name
      ? feeItems.findIndex(fee => !fee.isRent && fee.name.trim() === name)
      : -1;
    if (existingIndex >= 0) {
      setFeeEditorIndex(existingIndex);
      setFeeEditorStage(type === 'manual' ? 3 : 1);
      Taro.showToast({ title: `正在修改${name}`, icon: 'none' });
      return;
    }
    setFeeItems(prev => [...prev, {
      name, type, amount: type === 'manual' ? '0' : '', enabled: true,
      isRent: false, cycleMode: 'monthly', billingMonths: 1, initialMonths: 1,
    }]);
    setFeeEditorIndex(feeItems.length);
    setFeeEditorStage(name ? (type === 'manual' ? 3 : 1) : 0);
  }, [feeItems]);

  const removeFee = useCallback((index: number) => {
    setFeeItems(prev => prev.filter((fee, i) => i !== index || fee.isRent));
    setFeeEditorIndex(null);
    setFeeEditorStage(0);
  }, []);

  const clearExtraFees = useCallback(() => {
    setFeeItems(prev => prev.filter(fee => fee.isRent));
    setShowExtraFees(false);
    setFeeEditorIndex(null);
    setFeeEditorStage(0);
  }, []);

  const advanceFeeEditor = () => {
    if (feeEditorIndex == null) return;
    const fee = feeItems[feeEditorIndex];
    if (!fee) return;
    if (feeEditorStage === 0 && !fee.name.trim()) {
      Taro.showToast({ title: '请先填写费用名称', icon: 'none' });
      return;
    }
    if (fee.type === 'manual' || feeEditorStage >= 3) {
      setFeeEditorIndex(null);
      setFeeEditorStage(0);
      Taro.pageScrollTo({ scrollTop: 0, duration: 200 });
      return;
    }
    if (feeEditorStage === 1 && (!fee.amount.trim() || Number(fee.amount) < 0)) {
      Taro.showToast({ title: '请先填写每月金额', icon: 'none' });
      return;
    }
    setFeeEditorStage(stage => stage + 1);
    Taro.pageScrollTo({ scrollTop: 0, duration: 200 });
  };

  const handleNoExtraFees = useCallback(async () => {
    if (feeItems.some(fee => !fee.isRent)) {
      const result = await Taro.showModal({
        title: '不收其他费用？',
        content: '已添加的物业费、水电费等会被移除。',
        confirmText: '确认移除',
        cancelText: '保留费用',
      });
      if (!result.confirm) return;
    }
    clearExtraFees();
  }, [feeItems, clearExtraFees]);

  useEffect(() => {
    if (feeItems.some(fee => !fee.isRent)) setShowExtraFees(true);
  }, [feeItems]);

  useEffect(() => {
    if (!initialReceived || initialAmountEditedRef.current || feeItems.length === 0) return;
    setInitialAmount(String(calculateInitialFeeTotal(feeItems)));
  }, [feeItems, initialReceived]);

  const handleSave = useCallback(async () => {
    if (saveInFlightRef.current) return;
    if (feesLoading || feesLoadError) {
      Taro.showToast({ title: feesLoadError ? '请先重新加载收费项目' : '收费项目正在加载', icon: 'none' });
      return;
    }
    setErrors({});
    const validationErrors = validateTenantForm({
      name, phone, roomId: urlRoomId, moveInDate, contractEndDate, deposit,
      initialReceived, initialAmount, initialDepositAmount, initialDate, moveInReading,
    });
    Object.assign(validationErrors, validateFeeForm(feeItems));
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      Taro.showToast({ title: firstFormError(validationErrors), icon: 'none' });
      return;
    }

    saveInFlightRef.current = true;
    setSaving(true);

    // Resolve payMonths: preset → preset.payMonths; custom → keep loaded value (default 1)
    const resolvedPayMonths = paymentIdx >= 0 && paymentIdx !== CUSTOM_PAYMENT_IDX
      ? PAYMENT_PRESETS[paymentIdx].payMonths
      : loadedPayMonths;

    let tenantData: any = withOptionalTenantDates({
      name: name.trim(),
      phone: phone.trim(),
      rentDay,
      payMonths: resolvedPayMonths,
      deposit: deposit ? Number(deposit) : undefined,
      note: note.trim() || undefined,
      status: 1,
      feeItems: feeItems.map(fee => ({
        ...fee,
        name: fee.name.trim(),
        amount: fee.type === 'manual' ? 0 : Number(fee.amount),
        billingMonths: fee.billingMonths,
        initialMonths: fee.initialMonths,
      })),
    }, { moveInDate, contractEndDate });

    // P0-A: 入住实收（仅新建租客时附带；编辑模式不重新触发账单生成）
    tenantData = withInitialPayment(tenantData, {
      isEdit,
      initialReceived,
      initialAmount,
      initialDepositAmount,
      initialMethod: PAYMENT_METHOD_VALUES[initialMethodIdx] || PAYMENT_METHOD_VALUES[0],
      initialDate: initialDate || todayISO(),
    });

    // P0-C: 入住水电读数
    if (moveInReading.trim()) {
      tenantData.moveInReading = moveInReading.trim();
    }

    try {
      // For new tenants, request notification subscription synchronously
      // BEFORE the await — requestSubscribeMessage must be inside the user
      // TAP gesture's sync call stack.
      if (!isEdit) {
        requestNotification();
      }
      if (isEdit) {
        await put(`/tenants/${tenantId}`, tenantData);
      } else {
        await post(`/rooms/${urlRoomId}/tenant`, tenantData);
      }
      saveCompletedRef.current = true;
      Taro.removeStorageSync('draft_tenant');
      setSaving(false);

      // Give landlord peace of mind: confirm the system will remind them.
      // Do not navigate away until the landlord dismisses this modal; otherwise
      // the route switch closes it immediately and the prompt only flashes.
      const rentDayLabel = rentDay === 0 ? '月底' : `每月${rentDay}号`;
      if (!isEdit) {
        await Taro.showModal({
          title: '租客已保存',
          content: `系统会在${rentDayLabel}自动提醒你收${name.trim()}的房租。合同到期前也会提醒你续签。`,
          showCancel: false,
          confirmText: '放心了',
        });
        Taro.switchTab({ url: '/pages/home/index' });
      } else {
        Taro.showToast({ title: '租客信息已更新', icon: 'none', duration: 2000 });
        setTimeout(() => {
          Taro.navigateBack();
        }, 800);
      }
    } catch (err: any) {
      console.error('[AddTenant] 保存租客失败:', err);
      Taro.showToast({ title: err?.message || '保存失败', icon: 'none' });
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }, [isEdit, tenantId, name, phone, urlRoomId, rentDay, moveInDate, contractEndDate,
    deposit, note, paymentIdx, loadedPayMonths, initialReceived, initialAmount, initialDepositAmount,
    initialMethodIdx, initialDate, moveInReading, feeItems, feesLoading, feesLoadError]);

  const previewPayMonths = paymentIdx >= 0 && paymentIdx !== CUSTOM_PAYMENT_IDX
    ? PAYMENT_PRESETS[paymentIdx].payMonths
    : loadedPayMonths;
  const rentFee = feeItems.find(fee => fee.isRent);
  const extraFees = feeItems.filter(fee => !fee.isRent);
  const fixedExtraFees = extraFees.filter(fee => fee.type === 'fixed');
  const manualExtraFees = extraFees.filter(fee => fee.type === 'manual');
  const previewTotal = calculateInitialFeeTotal(feeItems);
  const previewRentTotal = rentFee
    ? calculateInitialFeeTotal([rentFee])
    : Math.round((currentRoomRent || 0) * previewPayMonths * 100) / 100;
  const activeFeeEditor = feeEditorIndex == null ? null : feeItems[feeEditorIndex];
  const wizardStepIds = getTenantWizardStepIds(isEdit);
  const safeWizardIndex = Math.min(wizardIndex, wizardStepIds.length - 1);
  const activeWizardStep = wizardStepIds[safeWizardIndex];

  const validateCurrentWizardStep = (): boolean => {
    if (activeWizardStep === 3 && (roomLoading || roomLoadError)) {
      Taro.showToast({ title: roomLoadError ? '请先重新加载房间' : '房间信息正在加载', icon: 'none' });
      return false;
    }
    if ((activeWizardStep === 4 || activeWizardStep === 5) && (feesLoading || feesLoadError)) {
      Taro.showToast({ title: feesLoadError ? '请先重新加载收费项目' : '收费项目正在加载', icon: 'none' });
      return false;
    }
    const allErrors = validateTenantForm({
      name, phone, roomId: urlRoomId, moveInDate, contractEndDate, deposit,
      initialReceived, initialAmount, initialDepositAmount, initialDate, moveInReading,
    });
    if (activeWizardStep === 5) Object.assign(allErrors, validateFeeForm(feeItems));
    const fieldsByStep: Record<number, string[]> = {
      0: ['name', 'phone', 'room'],
      1: ['moveInDate', 'contractEndDate'],
      3: ['deposit'],
      5: ['fee'],
      7: ['initialAmount'],
      8: ['initialDate'],
      9: ['moveInReading'],
    };
    const currentErrors: Record<string, string> = {};
    if (activeWizardStep === 3 && paymentIdx < 0) {
      currentErrors.deposit = '请先选择一种收租方式';
    }
    (fieldsByStep[activeWizardStep] || []).forEach((field) => {
      if (allErrors[field]) currentErrors[field] = allErrors[field];
    });
    setErrors(currentErrors);
    if (Object.keys(currentErrors).length > 0) {
      Taro.showToast({ title: firstFormError(currentErrors), icon: 'none' });
      return false;
    }
    return true;
  };

  const goNextWizardStep = () => {
    if (activeWizardStep === 5 && feeEditorIndex != null) {
      Taro.showToast({ title: '请先完成当前费用设置', icon: 'none' });
      return;
    }
    if (!validateCurrentWizardStep()) return;
    setWizardIndex(index => getNextTenantWizardIndex(index, wizardStepIds, initialReceived));
    Taro.pageScrollTo({ scrollTop: 0, duration: 200 });
  };

  const goPreviousWizardStep = () => {
    if (activeWizardStep === 5 && feeEditorIndex != null) {
      const firstStage = activeFeeEditor?.type === 'manual' ? 3 : (activeFeeEditor?.name ? 1 : 0);
      if (feeEditorStage > firstStage) {
        setFeeEditorStage(stage => stage - 1);
      } else {
        setFeeEditorIndex(null);
        setFeeEditorStage(0);
      }
      Taro.pageScrollTo({ scrollTop: 0, duration: 200 });
      return;
    }
    setErrors({});
    setWizardIndex(index => getPreviousTenantWizardIndex(index, wizardStepIds, isEdit, initialReceived));
    Taro.pageScrollTo({ scrollTop: 0, duration: 200 });
  };

  return (
    <View className="page-add-tenant">
      <View className="wizard-progress-card">
        <View className="wizard-progress-top">
          <Text className="wizard-progress-label">第 {safeWizardIndex + 1} 步，共 {wizardStepIds.length} 步</Text>
          <Text className="wizard-room-name">{currentRoomName || (urlRoomId > 0 ? `房间 #${urlRoomId}` : '正在读取房间…')}</Text>
        </View>
        <View className="wizard-progress-track">
          <View className="wizard-progress-fill" style={{ width: `${((safeWizardIndex + 1) / wizardStepIds.length) * 100}%` }} />
        </View>
      </View>

      {activeWizardStep === 0 && (
      <View className="tenant-form-section wizard-card">
        <View className="tenant-section-heading">
          <View>
            <Text className="tenant-section-kicker">先认识一下</Text>
            <Text className="tenant-section-title">租客是谁？</Text>
            <Text className="tenant-section-desc">填写姓名和联系电话，方便以后查找和联系。</Text>
          </View>
        </View>

      <View className="form-group">
        <Text className="form-label">租客姓名（必填）</Text>
        <Input
          className={`form-input${errors.name ? ' error' : ''}`}
          type="text"
          placeholder="如：王先生"
          value={name}
          maxlength={32}
          onInput={(e) => { setName(e.detail.value); setErrors({}); }}
          placeholderStyle="color: #B5A99A"
        />
        {errors.name && <Text className="form-error-text">{errors.name}</Text>}
      </View>

      <View className="form-group">
        <Text className="form-label">联系电话（必填）</Text>
        <Input
          className={`form-input${errors.phone ? ' error' : ''}`}
          type="number"
          placeholder="如：138 0000 0000"
          value={phone}
          onInput={(e) => { setPhone(e.detail.value); setErrors({}); }}
          placeholderStyle="color: #B5A99A"
          maxlength={11}
        />
        {errors.phone && <Text className="form-error-text">{errors.phone}</Text>}
      </View>
      </View>
      )}

      {activeWizardStep === 1 && (
      <View className="tenant-form-section wizard-card">
        <View className="tenant-section-heading">
          <View>
            <Text className="tenant-section-kicker">租期</Text>
            <Text className="tenant-section-title">准备住多久？</Text>
            <Text className="tenant-section-desc">不知道具体日期也没关系，可以直接下一步。</Text>
          </View>
        </View>
      <View className="form-group">
        <Text className="form-label">哪天入住？（可不填）</Text>
        <Picker mode="date" value={moveInDate} onChange={e => setMoveInDate(e.detail.value)}>
          <View className="date-input-wrap">
            <Text className="date-input-text" style={{ color: moveInDate ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {moveInDate || '选择入住日期'}
            </Text>
            <Text style={{ fontSize: '28px', color: 'var(--text-muted)', lineHeight: 1 }}>📅</Text>
          </View>
        </Picker>
        {errors.moveInDate && <Text className="form-error-text">{errors.moveInDate}</Text>}
      </View>

      <View className="form-group">
        <Text className="form-label">合同哪天到期？（可不填）</Text>
        <Picker mode="date" value={contractEndDate} onChange={e => setContractEndDate(e.detail.value)}>
          <View className="date-input-wrap">
            <Text className="date-input-text" style={{ color: contractEndDate ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {contractEndDate || '选择到期日期'}
            </Text>
            <Text style={{ fontSize: '28px', color: 'var(--text-muted)', lineHeight: 1 }}>📅</Text>
          </View>
        </Picker>
        {errors.contractEndDate && <Text className="form-error-text">{errors.contractEndDate}</Text>}
      </View>
      </View>
      )}

      {activeWizardStep >= 2 && activeWizardStep <= 4 && (
      <View className="tenant-form-section wizard-card">
        <View className="tenant-section-heading">
          <View>
            <Text className="tenant-section-kicker">{activeWizardStep === 2 ? '收租提醒' : activeWizardStep === 3 ? '押金和房租' : '第一次收房租'}</Text>
            <Text className="tenant-section-title">{activeWizardStep === 2 ? '每月几号提醒你收租？' : activeWizardStep === 3 ? '平时怎么收房租？' : '入住这次先收几个月房租？'}</Text>
            <Text className="tenant-section-desc">{activeWizardStep === 2 ? '只需要选一个日期，到了这一天系统会提醒你。' : activeWizardStep === 3 ? '点一个常用方式，押金会自动算好。' : '例如押一付三，就选择 3 个月。'}</Text>
          </View>
        </View>

      {activeWizardStep === 2 && <View className="form-group">
        <Text className="form-label">每月几号收租？</Text>
        <Picker
          mode="selector"
          range={rentDayLabels}
          value={rentDayToIndex(rentDay)}
          onChange={(e) => setRentDay(indexToRentDay(Number(e.detail.value)))}
        >
          <View className="form-select-wrap">
            <Text className="form-select-text" style={{ color: 'var(--text-primary)' }}>
              {rentDayToLabel(rentDay)}
            </Text>
            <Text style={{ fontSize: '24px', color: 'var(--text-hint)', lineHeight: 1 }}>▾</Text>
          </View>
        </Picker>
        <View className="elder-answer-confirmed"><Text className="elder-answer-check">✓</Text><Text>每月 {rentDayToLabel(rentDay)} 提醒收租</Text></View>
      </View>}

      {activeWizardStep === 3 && <View className="form-group">
        {roomLoading && <Text className="fee-section-status">正在读取房间和月租…</Text>}
        {roomLoadError && <View className="fee-load-error" onClick={loadRoom}><Text>房间信息加载失败，点这里重试</Text></View>}
        <View className="elder-choice-grid">
          {PAYMENT_PRESETS.map((preset, index) => (
            <View key={preset.label} className={`elder-choice${paymentIdx === index ? ' active' : ''}`} onClick={() => handlePaymentChange(index)}>
              {paymentIdx === index && <Text className="elder-choice-mark">✓</Text>}
              <Text className="elder-choice-title">{preset.label}</Text>
              <Text className="elder-choice-desc">押 {preset.depositMonths} 个月，收 {preset.payMonths} 个月</Text>
            </View>
          ))}
          <View className={`elder-choice wide${paymentIdx === CUSTOM_PAYMENT_IDX ? ' active' : ''}`} onClick={() => handlePaymentChange(CUSTOM_PAYMENT_IDX)}>
            {paymentIdx === CUSTOM_PAYMENT_IDX && <Text className="elder-choice-mark">✓</Text>}
            <Text className="elder-choice-title">其他方式</Text>
            <Text className="elder-choice-desc">自己填写押金</Text>
          </View>
        </View>
      </View>}

      {activeWizardStep === 3 && <View className="form-group elder-reveal-block">
        <Text className="form-label">押金金额</Text>
        <View className="input-with-suffix">
          <Input
            className="form-input suffix-input"
            type="digit"
            placeholder="输入押金金额"
            value={deposit}
            onInput={(e) => {
              const val = e.detail.value;
              if (Number(val) < 0) { setDeposit(''); return; }
              setDeposit(val);
            }}
            placeholderStyle="color: #B5A99A"
          />
          <Text className="input-suffix">元</Text>
        </View>
        {errors.deposit && <Text className="form-error-text">{errors.deposit}</Text>}
        {currentRoomRent > 0 && paymentIdx >= 0 && paymentIdx !== CUSTOM_PAYMENT_IDX && <Text className="form-help-text">已按月租 {currentRoomRent} 元自动算好。</Text>}
      </View>}

      {activeWizardStep === 4 && rentFee && (
        <View className="form-group">
          <View className="elder-choice-stack">
            {MONTH_OPTIONS.map(months => (
              <View key={`rent-initial-${months}`} className={`elder-choice-row${rentFee.initialMonths === months ? ' active' : ''}`} onClick={() => {
                const rentIndex = feeItems.findIndex(fee => fee.isRent);
                if (rentIndex >= 0) updateFee(rentIndex, { initialMonths: months });
              }}>
                <View><Text className="elder-choice-title">先收 {months} 个月</Text><Text className="elder-choice-desc">月租 {currentRoomRent || Number(rentFee.amount) || 0} 元</Text></View>
                <Text className="elder-choice-amount">{Math.round((currentRoomRent || Number(rentFee.amount) || 0) * months * 100) / 100} 元</Text>
              </View>
            ))}
          </View>
          <View className="elder-tip-box"><Text>这里只决定入住第一次收多少钱，以后仍按你选择的押付方式正常收租。</Text></View>
        </View>
      )}
      </View>
      )}

      {activeWizardStep === 5 && (
      <View className="tenant-form-section wizard-card">
        <View className="tenant-section-heading">
          <View>
            <Text className="tenant-section-kicker">其他费用</Text>
            <Text className="tenant-section-title">{activeFeeEditor ? `设置${activeFeeEditor.name || '其他费用'}` : '除了房租，还收别的钱吗？'}</Text>
            <Text className="tenant-section-desc">{activeFeeEditor ? '一次只回答一个问题，系统会自动算好。' : '没有就选“只收房租”，不用设置复杂规则。'}</Text>
          </View>
        </View>
      <View className="form-group fee-form-group">
        <View className="rent-fee-summary">
          <View>
            <Text className="rent-fee-label">房租</Text>
            <Text className="rent-fee-note">已自动加入，不用重复填写</Text>
          </View>
          <Text className="rent-fee-price">{rentFee?.amount || currentRoomRent || 0} 元/月</Text>
        </View>
        {feesLoading && <Text className="fee-section-status">正在加载收费项目…</Text>}
        {feesLoadError && (
          <View className="fee-load-error" onClick={loadFeeItems}>
            <Text>收费项目加载失败，点此重试</Text>
          </View>
        )}
        {feeEditorIndex == null ? (
          <>
            <View className="extra-fee-answer-row">
              <View className={`extra-fee-answer${!showExtraFees ? ' active' : ''}`} onClick={handleNoExtraFees}>
                <Text className="answer-title">只收房租</Text>
                <Text className="answer-desc">没有其他费用</Text>
              </View>
              <View className={`extra-fee-answer${showExtraFees ? ' active' : ''}`} onClick={() => setShowExtraFees(true)}>
                <Text className="answer-title">还要收其他费用</Text>
                <Text className="answer-desc">物业、水电、网费</Text>
              </View>
            </View>
            {showExtraFees && <>
              <Text className="fee-preset-title">点一下要添加的费用</Text>
              <View className="fee-preset-grid">
                <View className="fee-preset" onClick={() => addFee('物业费', 'fixed')}><Text>物业费</Text></View>
                <View className="fee-preset" onClick={() => addFee('水电费', 'manual')}><Text>水电费</Text></View>
                <View className="fee-preset" onClick={() => addFee('网费', 'fixed')}><Text>网费</Text></View>
                <View className="fee-preset" onClick={() => addFee('', 'fixed')}><Text>其他费用</Text></View>
              </View>
              {extraFees.length > 0 && <View className="elder-fee-summary-list">
                <Text className="selected-fee-title">已经添加</Text>
                {feeItems.map((fee, index) => !fee.isRent && (
                  <View className="elder-fee-summary-row" key={`${fee.name}-${index}`}>
                    <View onClick={() => { setFeeEditorIndex(index); setFeeEditorStage(fee.type === 'manual' ? 3 : (fee.name ? 1 : 0)); }}>
                      <Text className="selected-fee-name">{fee.name || '未命名费用'}</Text>
                      <Text className="rent-fee-note">{fee.type === 'manual' ? '收租时再填金额' : `${fee.amount || 0} 元/月，入住先收 ${fee.initialMonths || 1} 个月`}</Text>
                    </View>
                    <Text className="selected-fee-remove" onClick={() => removeFee(index)}>移除</Text>
                  </View>
                ))}
              </View>}
            </>}
            {extraFees.length > 0 && <View className="fee-preview compact">
              <Text className="fee-preview-title">入住费用合计</Text>
              <View className="fee-preview-row"><Text>房租</Text><Text>{previewRentTotal} 元</Text></View>
              {fixedExtraFees.map((fee, index) => <View className="fee-preview-row" key={`${fee.name}-preview-${index}`}><Text>{fee.name || '其他费用'}</Text><Text>{calculateInitialFeeTotal([fee])} 元</Text></View>)}
              {manualExtraFees.map((fee, index) => <View className="fee-preview-row muted" key={`${fee.name}-manual-${index}`}><Text>{fee.name || '其他费用'}</Text><Text>以后填写</Text></View>)}
              <View className="fee-preview-total"><Text>不含押金</Text><Text>{previewTotal} 元</Text></View>
            </View>}
          </>
        ) : activeFeeEditor && (
          <View className="elder-fee-editor">
            <Text className="elder-fee-editor-count">正在设置：{activeFeeEditor.name || '其他费用'}</Text>
            {feeEditorStage === 0 && <View>
              <Text className="elder-question-title">这项费用叫什么？</Text>
              <Input className="form-input elder-large-input" type="text" value={activeFeeEditor.name} placeholder="例如：停车费" maxlength={32} onInput={e => updateFee(feeEditorIndex, { name: e.detail.value })} />
            </View>}
            {feeEditorStage === 1 && <View>
              <Text className="elder-question-title">{activeFeeEditor.name}每月多少钱？</Text>
              <View className="input-with-suffix"><Input className="form-input suffix-input elder-large-input" type="digit" value={activeFeeEditor.amount} placeholder="输入金额" onInput={e => updateFee(feeEditorIndex, { amount: e.detail.value })} /><Text className="input-suffix">元</Text></View>
            </View>}
            {feeEditorStage === 2 && <View>
              <Text className="elder-question-title">平时多久收一次？</Text>
              <View className="elder-choice-stack">{MONTH_OPTIONS.map(months => <View key={`billing-${months}`} className={`elder-choice-row${activeFeeEditor.billingMonths === months ? ' active' : ''}`} onClick={() => updateFee(feeEditorIndex, { billingMonths: months })}><Text className="elder-choice-title">{months === 1 ? '每月收一次' : `每 ${months} 个月收一次`}</Text></View>)}</View>
            </View>}
            {feeEditorStage === 3 && activeFeeEditor.type === 'fixed' && <View>
              <Text className="elder-question-title">入住这次先收几个月？</Text>
              <View className="elder-choice-stack">{MONTH_OPTIONS.map(months => <View key={`initial-${months}`} className={`elder-choice-row${activeFeeEditor.initialMonths === months ? ' active' : ''}`} onClick={() => updateFee(feeEditorIndex, { initialMonths: months })}><Text className="elder-choice-title">先收 {months} 个月</Text><Text className="elder-choice-amount">{Math.round((Number(activeFeeEditor.amount) || 0) * months * 100) / 100} 元</Text></View>)}</View>
            </View>}
            {activeFeeEditor.type === 'manual' && <View className="elder-manual-note">
              <Text className="elder-question-title">水电费以后按实际金额填写</Text>
              <Text>登记租客时不用估算，收租时抄表后再填就可以。</Text>
            </View>}
          </View>
        )}
        {errors.fee && <Text className="form-error-text">{errors.fee}</Text>}
      </View>
      </View>
      )}

      {activeWizardStep >= 6 && activeWizardStep <= 8 && !isEdit && (
        <View className="tenant-form-section wizard-card">
          <View className="tenant-section-heading">
            <View>
              <Text className="tenant-section-kicker">{activeWizardStep === 6 ? '第一笔账' : activeWizardStep === 7 ? '核对金额' : '收款记录'}</Text>
              <Text className="tenant-section-title">{activeWizardStep === 6 ? '入住这次的钱收到了吗？' : activeWizardStep === 7 ? '实际收到了多少钱？' : '这笔钱是怎么收的？'}</Text>
              <Text className="tenant-section-desc">{activeWizardStep === 6 ? '只需选择“已收到”或“还没收到”。' : activeWizardStep === 7 ? '押金和其他费用分开填写，以后退押金时不会算错。' : '选择收款方式和日期，就记录完成了。'}</Text>
            </View>
          </View>
        {activeWizardStep === 6 && <View className="elder-choice-stack">
          <View className={`elder-choice-row${initialReceived ? ' active' : ''}`} onClick={() => handleToggleInitialReceived(true)}>
            <View><Text className="elder-choice-title">已经收到了</Text><Text className="elder-choice-desc">下一步填写实际金额</Text></View>
            {initialReceived && <Text className="elder-answer-check">✓</Text>}
          </View>
          <View className={`elder-choice-row${!initialReceived ? ' active' : ''}`} onClick={() => handleToggleInitialReceived(false)}>
            <View><Text className="elder-choice-title">还没有收到</Text><Text className="elder-choice-desc">先生成待收账单</Text></View>
            {!initialReceived && <Text className="elder-answer-check">✓</Text>}
          </View>
        </View>}
          {activeWizardStep === 7 && initialReceived && (
            <View className="form-sub-fields elder-payment-fields">
              <View className="fee-preview">
                <View className="fee-preview-row"><Text>应收押金</Text><Text>{Number(deposit) || 0} 元</Text></View>
                <View className="fee-preview-row"><Text>房租和其他费用</Text><Text>{previewTotal} 元</Text></View>
                <View className="fee-preview-total"><Text>本次合计</Text><Text>{Math.round(((Number(deposit) || 0) + previewTotal) * 100) / 100} 元</Text></View>
              </View>
              <View className="form-sub-row">
                <Text className="form-sub-label">实收押金</Text>
                <View className="input-with-suffix">
                  <Input
                    className="form-input suffix-input"
                    type="digit"
                    value={initialDepositAmount}
                    onInput={(e) => { initialDepositEditedRef.current = true; setInitialDepositAmount(e.detail.value); }}
                    placeholder={`默认 ${Number(deposit) || 0}`}
                    placeholderStyle="color: #B5A99A"
                  />
                  <Text className="input-suffix">元</Text>
                </View>
              </View>
              <View className="form-sub-row">
                <Text className="form-sub-label">实收房租和其他费用</Text>
                <View className="input-with-suffix">
                  <Input
                    className="form-input suffix-input"
                    type="digit"
                    value={initialAmount}
                    onInput={(e) => { initialAmountEditedRef.current = true; setInitialAmount(e.detail.value); }}
                    placeholder={`默认 ${previewTotal}`}
                    placeholderStyle="color: #B5A99A"
                  />
                  <Text className="input-suffix">元</Text>
                </View>
              </View>
              {errors.initialAmount && <Text className="form-error-text">{errors.initialAmount}</Text>}
            </View>
          )}
          {activeWizardStep === 8 && initialReceived && (
            <View className="form-sub-fields elder-payment-fields">
              <View className="form-sub-row">
                <Text className="form-sub-label">收款方式</Text>
                <Picker
                  mode="selector"
                  range={PAYMENT_METHOD_LABELS}
                  value={initialMethodIdx}
                  onChange={(e) => setInitialMethodIdx(Number(e.detail.value))}
                >
                  <View className="form-select-wrap">
                    <Text className="form-select-text">{PAYMENT_METHOD_LABELS[initialMethodIdx]}</Text>
                    <Text style={{ fontSize: '24px', color: 'var(--text-hint)', lineHeight: 1 }}>▾</Text>
                  </View>
                </Picker>
              </View>
              <View className="form-sub-row">
                <Text className="form-sub-label">收款日期</Text>
                <Picker mode="date" value={initialDate} onChange={e => setInitialDate(e.detail.value)}>
                  <View className="date-input-wrap">
                    <Text className="date-input-text">{initialDate}</Text>
                    <Text style={{ fontSize: '28px', color: 'var(--text-muted)', lineHeight: 1 }}>📅</Text>
                  </View>
                </Picker>
              </View>
              {errors.initialDate && <Text className="form-error-text">{errors.initialDate}</Text>}
            </View>
          )}
        </View>
      )}

      {activeWizardStep === 9 && (
      <View className="tenant-form-section wizard-card">
        <View className="tenant-section-heading">
          <View>
            <Text className="tenant-section-kicker">可选内容</Text>
            <Text className="tenant-section-title">还有什么要记下来？</Text>
            <Text className="tenant-section-desc">水电表数字和备注都可以不填，以后也能补。</Text>
          </View>
        </View>
      <View className="form-group">
        <Text className="form-label">入住时的水电表数字（可不填）</Text>
        <Input
          className="form-input"
          type="text"
          placeholder="如：电 1234 / 水 56 / 气 12（可选）"
          value={moveInReading}
          onInput={(e) => setMoveInReading(e.detail.value)}
          placeholderStyle="color: #B5A99A"
          maxlength={200}
        />
        {errors.moveInReading && <Text className="form-error-text">{errors.moveInReading}</Text>}
        <Text className="form-help-text">现在记下来，退租时更方便核对水电费。</Text>
      </View>

      <View className="form-group">
        <Text className="form-label">备注（可不填）</Text>
        <Textarea
          className="form-textarea"
          placeholder="写点备注（可选）"
          value={note}
          onInput={(e) => setNote(e.detail.value)}
          placeholderStyle="color: #B5A99A"
          maxlength={200}
          autoHeight
        />
      </View>
      </View>
      )}

      {activeWizardStep === 10 && (
        <View className="tenant-form-section wizard-card wizard-review-card">
          <View className="tenant-section-heading">
            <View>
              <Text className="tenant-section-kicker">最后一步</Text>
              <Text className="tenant-section-title">核对一下，就完成了</Text>
              <Text className="tenant-section-desc">信息有误可以点“上一步”返回修改。</Text>
            </View>
          </View>
          <View className="wizard-review-list">
            <View className="wizard-review-row"><Text>房间</Text><Text>{currentRoomName || `#${urlRoomId}`}</Text></View>
            <View className="wizard-review-row"><Text>租客</Text><Text>{name || '未填写'} · {phone || '未填写'}</Text></View>
            <View className="wizard-review-row"><Text>租期</Text><Text>{moveInDate || '未填'} 至 {contractEndDate || '未填'}</Text></View>
            <View className="wizard-review-row"><Text>收租日</Text><Text>{rentDayToLabel(rentDay)}</Text></View>
            <View className="wizard-review-row"><Text>押付方式</Text><Text>{paymentIdx >= 0 ? PAYMENT_LABELS[paymentIdx] : '未选择'}</Text></View>
            <View className="wizard-review-row"><Text>押金</Text><Text>{deposit ? `${deposit} 元` : '未填写'}</Text></View>
            <View className="wizard-review-row"><Text>其他费用</Text><Text>{extraFees.length ? extraFees.map(fee => fee.name || '其他').join('、') : '无'}</Text></View>
            {!isEdit && <View className="wizard-review-row"><Text>入住收款</Text><Text>{initialReceived ? `押金 ${initialDepositAmount || 0} 元，费用 ${initialAmount || 0} 元` : '尚未收到'}</Text></View>}
          </View>
          <View className="wizard-review-total">
            <Text>入住应收费用（不含押金）</Text>
            <Text>{previewTotal} 元</Text>
          </View>
        </View>
      )}

      <View className="wizard-actions">
        {safeWizardIndex > 0 && (
          <View className="wizard-back-btn" onClick={goPreviousWizardStep}>
            <Text>上一步</Text>
          </View>
        )}
        {activeWizardStep === 10 ? (
          <View className={`save-btn wizard-primary-btn ${saving ? 'disabled' : ''}`} onClick={saving ? undefined : handleSave}>
            <Text className="save-btn-text">{isEdit ? '确认保存修改' : saving ? '正在保存…' : '确认保存租客'}</Text>
          </View>
        ) : activeWizardStep === 5 && activeFeeEditor ? (
          <View className="save-btn wizard-primary-btn" onClick={advanceFeeEditor}>
            <Text className="save-btn-text">{activeFeeEditor.type === 'manual' || feeEditorStage === 3 ? '完成这项设置' : '下一问'}</Text>
          </View>
        ) : (
          <View className="save-btn wizard-primary-btn" onClick={goNextWizardStep}>
            <Text className="save-btn-text">{activeWizardStep === 1 || activeWizardStep === 9 ? '跳过 / 下一步' : '下一步'}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
