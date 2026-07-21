import { View, Text, Input, Textarea, Picker } from '@tarojs/components';
import Taro, { useDidHide } from '@tarojs/taro';
import { useState, useCallback, useEffect, useRef } from 'react';
import { get, post, put } from '../../services/request';
import { requestNotification } from '../../services/notification';
import { withInitialPayment, withOptionalTenantDates } from '../../utils/tenant-form';
import { firstFormError, validateTenantForm } from '../../utils/form-validation';
import { calculateFeeCycleTotal, FeeFormItem, normalizeFeeItems } from '../../utils/fee-form';
import { validateFeeForm } from '../../utils/form-validation';
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
  const [paymentIdx, setPaymentIdx] = useState<number>(-1);
  const [loadedPayMonths, setLoadedPayMonths] = useState<number>(1);
  const inferredRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const saveCompletedRef = useRef(false);
  const feeDraftRestoredRef = useRef(false);
  const initialAmountEditedRef = useRef(false);
  const [feeItems, setFeeItems] = useState<FeeFormItem[]>([]);
  const [feesLoading, setFeesLoading] = useState(false);
  const [feesLoadError, setFeesLoadError] = useState(false);
  const [showExtraFees, setShowExtraFees] = useState(false);
  const [wizardIndex, setWizardIndex] = useState(0);

  // P0-A: 入住实收
  const [initialReceived, setInitialReceived] = useState<boolean>(false);
  const [initialAmount, setInitialAmount] = useState<string>('');
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

  // Load room info
  useEffect(() => {
    if (urlRoomId > 0) {
      get<any>(`/rooms/${urlRoomId}`).then((res) => {
        if (res.code === 0 && res.data) {
          setCurrentRoomName(res.data.name || '');
          setCurrentRoomRent(Number(res.data.rent) || 0);
        }
      }).catch(() => {});
      loadFeeItems();
    }
  }, [urlRoomId, loadFeeItems]);

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
          }
          // P0-C: 回填入住水电读数
          if (found.moveInReading) {
            setMoveInReading(found.moveInReading);
          }
          if (Array.isArray(found.feeItems)) setFeeItems(normalizeFeeItems(found.feeItems));
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
        if (draft.initialMethodIdx !== undefined) setInitialMethodIdx(draft.initialMethodIdx);
        if (draft.initialDate) setInitialDate(draft.initialDate);
        if (draft.moveInReading) setMoveInReading(draft.moveInReading);
        if (Number.isInteger(draft.wizardIndex)) setWizardIndex(Math.min(6, Math.max(0, Number(draft.wizardIndex))));
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
        initialReceived, initialAmount, initialMethodIdx, initialDate, moveInReading,
        feeItems, wizardIndex,
      };
      if (name || phone) {
        Taro.setStorageSync('draft_tenant', formData);
      }
    }
  });

  const handlePaymentChange = useCallback((idx: number) => {
    setPaymentIdx(idx);
    if (idx !== CUSTOM_PAYMENT_IDX && currentRoomRent > 0) {
      const { depositMonths, payMonths: pm } = PAYMENT_PRESETS[idx];
      setDeposit(String(currentRoomRent * depositMonths));
      // 同步更新实收金额默认值（押X付Y 的首期房租 = 月租 × payMonths）
      if (initialReceived && !initialAmountEditedRef.current) {
        setInitialAmount(String(calculateFeeCycleTotal(feeItems, pm)));
      }
    }
  }, [currentRoomRent, initialReceived, feeItems]);

  const handleToggleInitialReceived = useCallback((on: boolean) => {
    setInitialReceived(on);
    if (on && !initialAmount && currentRoomRent > 0) {
      // 默认填入：月租 × payMonths（首期房租，不含押金）
      const pm = paymentIdx >= 0 && paymentIdx !== CUSTOM_PAYMENT_IDX
        ? PAYMENT_PRESETS[paymentIdx].payMonths
        : loadedPayMonths;
      initialAmountEditedRef.current = false;
      setInitialAmount(String(calculateFeeCycleTotal(feeItems, pm)));
    }
  }, [initialAmount, currentRoomRent, paymentIdx, loadedPayMonths, feeItems]);

  const updateFee = useCallback((index: number, patch: Partial<FeeFormItem>) => {
    setFeeItems(prev => prev.map((fee, i) => i === index ? { ...fee, ...patch } : fee));
  }, []);

  const addFee = useCallback((name: string, type: 'fixed' | 'manual') => {
    setShowExtraFees(true);
    setFeeItems(prev => {
      if (name && prev.some(fee => !fee.isRent && fee.name.trim() === name)) {
        Taro.showToast({ title: `已经添加${name}`, icon: 'none' });
        return prev;
      }
      return [...prev, {
        name, type, amount: type === 'manual' ? '0' : '', enabled: true,
        isRent: false, cycleMode: 'rent',
      }];
    });
  }, []);

  const removeFee = useCallback((index: number) => {
    setFeeItems(prev => prev.filter((fee, i) => i !== index || fee.isRent));
  }, []);

  const clearExtraFees = useCallback(() => {
    setFeeItems(prev => prev.filter(fee => fee.isRent));
    setShowExtraFees(false);
  }, []);

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
    const payMonths = paymentIdx >= 0 && paymentIdx !== CUSTOM_PAYMENT_IDX
      ? PAYMENT_PRESETS[paymentIdx].payMonths
      : loadedPayMonths;
    setInitialAmount(String(calculateFeeCycleTotal(feeItems, payMonths)));
  }, [feeItems, initialReceived, paymentIdx, loadedPayMonths]);

  const handleSave = useCallback(async () => {
    if (saveInFlightRef.current) return;
    if (feesLoading || feesLoadError) {
      Taro.showToast({ title: feesLoadError ? '请先重新加载收费项目' : '收费项目正在加载', icon: 'none' });
      return;
    }
    setErrors({});
    const validationErrors = validateTenantForm({
      name, phone, roomId: urlRoomId, moveInDate, contractEndDate, deposit,
      initialReceived, initialAmount, initialDate, moveInReading,
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
      })),
    }, { moveInDate, contractEndDate });

    // P0-A: 入住实收（仅新建租客时附带；编辑模式不重新触发账单生成）
    tenantData = withInitialPayment(tenantData, {
      isEdit,
      initialReceived,
      initialAmount,
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
    deposit, note, paymentIdx, loadedPayMonths, initialReceived, initialAmount,
    initialMethodIdx, initialDate, moveInReading, feeItems, feesLoading, feesLoadError]);

  const previewPayMonths = paymentIdx >= 0 && paymentIdx !== CUSTOM_PAYMENT_IDX
    ? PAYMENT_PRESETS[paymentIdx].payMonths
    : loadedPayMonths;
  const rentFee = feeItems.find(fee => fee.isRent);
  const extraFees = feeItems.filter(fee => !fee.isRent);
  const fixedExtraFees = extraFees.filter(fee => fee.type === 'fixed');
  const manualExtraFees = extraFees.filter(fee => fee.type === 'manual');
  const previewTotal = calculateFeeCycleTotal(feeItems, previewPayMonths);
  const previewRentTotal = rentFee
    ? calculateFeeCycleTotal([rentFee], previewPayMonths)
    : Math.round((currentRoomRent || 0) * previewPayMonths * 100) / 100;
  const wizardStepIds = isEdit ? [0, 1, 2, 3, 5, 6] : [0, 1, 2, 3, 4, 5, 6];
  const safeWizardIndex = Math.min(wizardIndex, wizardStepIds.length - 1);
  const activeWizardStep = wizardStepIds[safeWizardIndex];

  const validateCurrentWizardStep = (): boolean => {
    if (activeWizardStep === 3 && (feesLoading || feesLoadError)) {
      Taro.showToast({ title: feesLoadError ? '请先重新加载收费项目' : '收费项目正在加载', icon: 'none' });
      return false;
    }
    const allErrors = validateTenantForm({
      name, phone, roomId: urlRoomId, moveInDate, contractEndDate, deposit,
      initialReceived, initialAmount, initialDate, moveInReading,
    });
    if (activeWizardStep === 3) Object.assign(allErrors, validateFeeForm(feeItems));
    const fieldsByStep: Record<number, string[]> = {
      0: ['name', 'phone', 'room'],
      1: ['moveInDate', 'contractEndDate'],
      2: ['deposit'],
      3: ['fee'],
      4: ['initialAmount', 'initialDate'],
      5: ['moveInReading'],
    };
    const currentErrors: Record<string, string> = {};
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
    if (!validateCurrentWizardStep()) return;
    setWizardIndex(index => Math.min(index + 1, wizardStepIds.length - 1));
    Taro.pageScrollTo({ scrollTop: 0, duration: 200 });
  };

  const goPreviousWizardStep = () => {
    setErrors({});
    setWizardIndex(index => Math.max(0, index - 1));
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

      {activeWizardStep === 2 && (
      <View className="tenant-form-section wizard-card">
        <View className="tenant-section-heading">
          <View>
            <Text className="tenant-section-kicker">收租安排</Text>
            <Text className="tenant-section-title">房租准备怎么收？</Text>
            <Text className="tenant-section-desc">选择收租日和押付方式，系统会帮你计算和提醒。</Text>
          </View>
        </View>

      <View className="form-group">
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
        <Text className="form-help-text">到了这一天，系统会提醒你收租。</Text>
      </View>

      <View className="form-group">
        <Text className="form-label">押金和收租方式（可不选）</Text>
        <Picker
          mode="selector"
          range={PAYMENT_LABELS}
          value={paymentIdx >= 0 ? paymentIdx : CUSTOM_PAYMENT_IDX}
          onChange={(e) => handlePaymentChange(Number(e.detail.value))}
        >
          <View className="form-select-wrap">
            <Text className="form-select-text" style={{ color: paymentIdx >= 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {paymentIdx >= 0 ? PAYMENT_LABELS[paymentIdx] : '例如：押一付一、押一付三'}
            </Text>
            <Text style={{ fontSize: '24px', color: 'var(--text-hint)', lineHeight: 1 }}>▾</Text>
          </View>
        </Picker>
      </View>

      <View className="form-group">
        <Text className="form-label">押金是多少？（可不填）</Text>
        <View className="input-with-suffix">
          <Input
            className="form-input suffix-input"
            type="digit"
            placeholder={currentRoomRent ? `如：${currentRoomRent}` : '输入押金金额'}
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
        {currentRoomRent > 0 && paymentIdx >= 0 && paymentIdx !== CUSTOM_PAYMENT_IDX && (
          <Text className="form-help-text">
            已按月租 {currentRoomRent} 元自动算好；以后每 {PAYMENT_PRESETS[paymentIdx].payMonths} 个月收一次房租。
          </Text>
        )}
      </View>
      </View>
      )}

      {activeWizardStep === 3 && (
      <View className="tenant-form-section wizard-card">
        <View className="tenant-section-heading">
          <View>
            <Text className="tenant-section-kicker">其他费用</Text>
            <Text className="tenant-section-title">除了房租，还收别的钱吗？</Text>
            <Text className="tenant-section-desc">没有就选“只收房租”，不用设置复杂规则。</Text>
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
        <View className="extra-fee-answer-row">
          <View className={`extra-fee-answer${!showExtraFees ? ' active' : ''}`} onClick={handleNoExtraFees}>
            <Text className="answer-title">不收其他费用</Text>
            <Text className="answer-desc">只有房租</Text>
          </View>
          <View className={`extra-fee-answer${showExtraFees ? ' active' : ''}`} onClick={() => setShowExtraFees(true)}>
            <Text className="answer-title">还要收其他费用</Text>
            <Text className="answer-desc">物业、水电等</Text>
          </View>
        </View>
        {feesLoading && <Text className="fee-section-status">正在加载收费项目…</Text>}
        {feesLoadError && (
          <View className="fee-load-error" onClick={loadFeeItems}>
            <Text>收费项目加载失败，点此重试</Text>
          </View>
        )}
        {showExtraFees && (
          <>
            <Text className="fee-preset-title">点一下要收的费用</Text>
            <View className="fee-preset-grid">
              <View className="fee-preset" onClick={() => addFee('物业费', 'fixed')}><Text>+ 物业费</Text></View>
              <View className="fee-preset" onClick={() => addFee('水电费', 'manual')}><Text>+ 水电费</Text></View>
              <View className="fee-preset" onClick={() => addFee('网费', 'fixed')}><Text>+ 网费</Text></View>
              <View className="fee-preset" onClick={() => addFee('', 'fixed')}><Text>+ 其他费用</Text></View>
            </View>

            {extraFees.length > 0 && (
              <View className="selected-fee-list">
                <Text className="selected-fee-title">已经添加</Text>
                {feeItems.map((fee, index) => !fee.isRent && (
                  <View className="selected-fee-card" key={`${fee.name}-${index}`}>
                    <View className="selected-fee-head">
                      {['物业费', '水电费', '网费'].includes(fee.name) ? (
                        <Text className="selected-fee-name">{fee.name}</Text>
                      ) : (
                        <Input
                          className="selected-fee-name-input"
                          type="text"
                          value={fee.name}
                          placeholder="费用叫什么？"
                          maxlength={32}
                          onInput={e => updateFee(index, { name: e.detail.value })}
                        />
                      )}
                      <Text className="selected-fee-remove" onClick={() => removeFee(index)}>移除</Text>
                    </View>
                    {fee.type === 'fixed' ? (
                      <View className="selected-fee-amount">
                        <Text>每月多少钱？</Text>
                        <View className="selected-fee-input-wrap">
                          <Input
                            className="selected-fee-input"
                            type="digit"
                            value={fee.amount}
                            placeholder="0"
                            onInput={e => updateFee(index, { amount: e.detail.value })}
                          />
                          <Text>元</Text>
                        </View>
                      </View>
                    ) : (
                      <Text className="selected-fee-later">具体金额等收租时再填写</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {extraFees.length > 0 && (
              <View className="fee-preview">
                <Text className="fee-preview-title">预计下一次收款</Text>
                <Text className="fee-preview-subtitle">按一次收 {previewPayMonths} 个月房租计算，不含押金</Text>
                <View className="fee-preview-row">
                  <Text>{previewPayMonths} 个月房租</Text>
                  <Text>{previewRentTotal} 元</Text>
                </View>
                {fixedExtraFees.map((fee, index) => (
                  <View className="fee-preview-row" key={`${fee.name}-preview-${index}`}>
                    <Text>{fee.name || '其他费用'}</Text>
                    <Text>{calculateFeeCycleTotal([fee], previewPayMonths)} 元</Text>
                  </View>
                ))}
                {manualExtraFees.map((fee, index) => (
                  <View className="fee-preview-row muted" key={`${fee.name}-manual-${index}`}>
                    <Text>{fee.name || '其他费用'}</Text>
                    <Text>收租时填写</Text>
                  </View>
                ))}
                <View className="fee-preview-total">
                  <Text>预计合计</Text>
                  <Text>{previewTotal} 元</Text>
                </View>
              </View>
            )}
          </>
        )}
        {errors.fee && <Text className="form-error-text">{errors.fee}</Text>}
      </View>
      </View>
      )}

      {activeWizardStep === 4 && !isEdit && (
        <View className="tenant-form-section wizard-card">
          <View className="tenant-section-heading">
            <View>
              <Text className="tenant-section-kicker">第一笔账</Text>
              <Text className="tenant-section-title">第一笔房租收到了吗？</Text>
              <Text className="tenant-section-desc">如实选择，系统会自动生成对应的收租记录。</Text>
            </View>
          </View>
        <View className="form-group">
          <View
            className={`form-toggle-row${initialReceived ? ' on' : ''}`}
            onClick={() => handleToggleInitialReceived(!initialReceived)}
          >
            <Text className="form-toggle-text">
              {initialReceived ? '✓ 已经收到第一笔房租' : '○ 还没有收到第一笔房租'}
            </Text>
            <Text className="form-toggle-hint">
              {initialReceived ? '保存后，这笔钱会记为“已收”' : '点这里切换为“已经收到”'}
            </Text>
          </View>
          {initialReceived && (
            <View className="form-sub-fields">
              <View className="form-sub-row">
                <Text className="form-sub-label">实收金额</Text>
                <View className="input-with-suffix">
                  <Input
                    className="form-input suffix-input"
                    type="digit"
                    value={initialAmount}
                    onInput={(e) => { initialAmountEditedRef.current = true; setInitialAmount(e.detail.value); }}
                    placeholder={`默认 ${calculateFeeCycleTotal(feeItems, paymentIdx >= 0 && paymentIdx !== CUSTOM_PAYMENT_IDX ? PAYMENT_PRESETS[paymentIdx].payMonths : loadedPayMonths)}`}
                    placeholderStyle="color: #B5A99A"
                  />
                  <Text className="input-suffix">元</Text>
                </View>
              </View>
              {errors.initialAmount && <Text className="form-error-text">{errors.initialAmount}</Text>}
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
        </View>
      )}

      {activeWizardStep === 5 && (
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

      {activeWizardStep === 6 && (
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
            {!isEdit && <View className="wizard-review-row"><Text>第一笔房租</Text><Text>{initialReceived ? `已收 ${initialAmount || previewTotal} 元` : '尚未收到'}</Text></View>}
          </View>
          <View className="wizard-review-total">
            <Text>预计下一次收款</Text>
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
        {activeWizardStep === 6 ? (
          <View className={`save-btn wizard-primary-btn ${saving ? 'disabled' : ''}`} onClick={saving ? undefined : handleSave}>
            <Text className="save-btn-text">{isEdit ? '确认保存修改' : saving ? '正在保存…' : '确认保存租客'}</Text>
          </View>
        ) : (
          <View className="save-btn wizard-primary-btn" onClick={goNextWizardStep}>
            <Text className="save-btn-text">{activeWizardStep === 1 || activeWizardStep === 5 ? '跳过 / 下一步' : '下一步'}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
