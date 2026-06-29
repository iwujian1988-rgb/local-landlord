import { View, Text, Input, Textarea, Picker } from '@tarojs/components';
import Taro, { useDidHide } from '@tarojs/taro';
import { useState, useCallback, useEffect, useRef } from 'react';
import { get, post, put } from '../../services/request';
import { requestNotification } from '../../services/notification';
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

  // P0-A: 入住实收
  const [initialReceived, setInitialReceived] = useState<boolean>(false);
  const [initialAmount, setInitialAmount] = useState<string>('');
  const [initialMethodIdx, setInitialMethodIdx] = useState<number>(0);
  const [initialDate, setInitialDate] = useState<string>(todayISO());
  // P0-C: 入住水电读数
  const [moveInReading, setMoveInReading] = useState<string>('');

  // Load room info
  useEffect(() => {
    if (urlRoomId > 0) {
      get<any>(`/rooms/${urlRoomId}`).then((res) => {
        if (res.code === 0 && res.data) {
          setCurrentRoomName(res.data.name || '');
          setCurrentRoomRent(Number(res.data.rent) || 0);
        }
      }).catch(() => {});
    }
  }, [urlRoomId]);

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
      if (draft) {
        setName(draft.name || '');
        setPhone(draft.phone || '');
        setMoveInDate(draft.moveInDate || '');
        setContractEndDate(draft.contractEndDate || '');
        if (draft.rentDay !== undefined) setRentDay(draft.rentDay);
        if (draft.deposit) setDeposit(draft.deposit);
        if (draft.paymentIdx !== undefined) setPaymentIdx(draft.paymentIdx);
        if (draft.note) setNote(draft.note);
        Taro.showToast({ title: '已恢复未完成的草稿', icon: 'none', duration: 2000 });
      }
    }
  }, []);

  useDidHide(() => {
    if (tenantId <= 0) {
      const formData = {
        name, phone, moveInDate, contractEndDate,
        rentDay, deposit, note, paymentIdx,
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
      if (initialReceived) {
        setInitialAmount(String(currentRoomRent * pm));
      }
    }
  }, [currentRoomRent, initialReceived]);

  const handleToggleInitialReceived = useCallback((on: boolean) => {
    setInitialReceived(on);
    if (on && !initialAmount && currentRoomRent > 0) {
      // 默认填入：月租 × payMonths（首期房租，不含押金）
      const pm = paymentIdx >= 0 && paymentIdx !== CUSTOM_PAYMENT_IDX
        ? PAYMENT_PRESETS[paymentIdx].payMonths
        : loadedPayMonths;
      setInitialAmount(String(currentRoomRent * pm));
    }
  }, [initialAmount, currentRoomRent, paymentIdx, loadedPayMonths]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setErrors({});
    if (!name.trim()) {
      setErrors({ name: '请输入租客姓名' });
      return;
    }
    if (!phone.trim()) {
      setErrors({ phone: '请输入租客电话' });
      return;
    }
    if (!urlRoomId) {
      setErrors({ room: '没有找到对应房间，请返回重新进入' });
      return;
    }

    setSaving(true);

    // Resolve payMonths: preset → preset.payMonths; custom → keep loaded value (default 1)
    const resolvedPayMonths = paymentIdx >= 0 && paymentIdx !== CUSTOM_PAYMENT_IDX
      ? PAYMENT_PRESETS[paymentIdx].payMonths
      : loadedPayMonths;

    const tenantData: any = {
      name: name.trim(),
      phone: phone.trim(),
      moveInDate: moveInDate.trim(),
      contractEndDate: contractEndDate.trim(),
      rentDay,
      payMonths: resolvedPayMonths,
      deposit: deposit ? Number(deposit) : undefined,
      note: note.trim() || undefined,
      status: 1,
    };

    // P0-A: 入住实收（仅新建租客时附带；编辑模式不重新触发账单生成）
    if (!isEdit && initialReceived && initialAmount) {
      tenantData.initialPaymentMethod = PAYMENT_METHOD_VALUES[initialMethodIdx];
      tenantData.initialPaymentDate = initialDate || todayISO();
      tenantData.initialPaymentAmount = Number(initialAmount) || 0;
    }

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
    } catch (err) {
      console.error('[AddTenant] 保存租客失败:', err);
      Taro.showToast({ title: '保存失败', icon: 'none' });
      setSaving(false);
    }
  }, [saving, isEdit, tenantId, name, phone, urlRoomId, rentDay, moveInDate, contractEndDate, deposit, note]);

  return (
    <View className="page-add-tenant">
      {currentRoomName && (
        <View className="form-group">
          <Text className="form-label">关联房间</Text>
          <Text className="form-readonly">{currentRoomName}</Text>
        </View>
      )}

      {!currentRoomName && urlRoomId > 0 && (
        <View className="form-group">
          <Text className="form-label">关联房间</Text>
          <Text className="form-readonly">房间 #{urlRoomId}</Text>
        </View>
      )}

      <View className="form-group">
        <Text className="form-label">租客姓名 *</Text>
        <Input
          className={`form-input${errors.name ? ' error' : ''}`}
          type="text"
          placeholder="如：王先生"
          value={name}
          onInput={(e) => { setName(e.detail.value); setErrors({}); }}
          placeholderStyle="color: #B5A99A"
        />
        {errors.name && <Text className="form-error-text">{errors.name}</Text>}
      </View>

      <View className="form-group">
        <Text className="form-label">租客电话 *</Text>
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

      <View className="form-group">
        <Text className="form-label">入住时间</Text>
        <Picker mode="date" value={moveInDate} onChange={e => setMoveInDate(e.detail.value)}>
          <View className="date-input-wrap">
            <Text className="date-input-text" style={{ color: moveInDate ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {moveInDate || '选择入住日期'}
            </Text>
            <Text style={{ fontSize: '28px', color: 'var(--text-muted)', lineHeight: 1 }}>📅</Text>
          </View>
        </Picker>
      </View>

      <View className="form-group">
        <Text className="form-label">合同到期时间</Text>
        <Picker mode="date" value={contractEndDate} onChange={e => setContractEndDate(e.detail.value)}>
          <View className="date-input-wrap">
            <Text className="date-input-text" style={{ color: contractEndDate ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {contractEndDate || '选择到期日期'}
            </Text>
            <Text style={{ fontSize: '28px', color: 'var(--text-muted)', lineHeight: 1 }}>📅</Text>
          </View>
        </Picker>
      </View>

      <View className="form-group">
        <Text className="form-label">每月收租日</Text>
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
      </View>

      <View className="form-group">
        <Text className="form-label">押付方式</Text>
        <Picker
          mode="selector"
          range={PAYMENT_LABELS}
          value={paymentIdx >= 0 ? paymentIdx : CUSTOM_PAYMENT_IDX}
          onChange={(e) => handlePaymentChange(Number(e.detail.value))}
        >
          <View className="form-select-wrap">
            <Text className="form-select-text" style={{ color: paymentIdx >= 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {paymentIdx >= 0 ? PAYMENT_LABELS[paymentIdx] : '选择押付方式（可选）'}
            </Text>
            <Text style={{ fontSize: '24px', color: 'var(--text-hint)', lineHeight: 1 }}>▾</Text>
          </View>
        </Picker>
      </View>

      <View className="form-group">
        <Text className="form-label">押金金额</Text>
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
        {currentRoomRent > 0 && paymentIdx >= 0 && paymentIdx !== CUSTOM_PAYMENT_IDX && (
          <Text className="form-error-text" style={{ color: 'var(--text-hint)', marginTop: '8px' }}>
            = 月租 {currentRoomRent} × 押 {PAYMENT_PRESETS[paymentIdx].depositMonths} 个月，每 {PAYMENT_PRESETS[paymentIdx].payMonths} 个月收一次
          </Text>
        )}
      </View>

      {!isEdit && (
        <View className="form-group">
          <Text className="form-label">本次实收（首期房租）</Text>
          <View
            className={`form-toggle-row${initialReceived ? ' on' : ''}`}
            onClick={() => handleToggleInitialReceived(!initialReceived)}
          >
            <Text className="form-toggle-text">
              {initialReceived ? '✓ 已收' : '○ 本次入住已收房租'}
            </Text>
            <Text className="form-toggle-hint">
              {initialReceived ? '系统将自动建第一笔账单并标记为已收' : '勾选后自动建账单，未勾选则只建未收账单'}
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
                    onInput={(e) => setInitialAmount(e.detail.value)}
                    placeholder={currentRoomRent > 0 ? `默认 ${currentRoomRent * (paymentIdx >= 0 && paymentIdx !== CUSTOM_PAYMENT_IDX ? PAYMENT_PRESETS[paymentIdx].payMonths : loadedPayMonths)}` : '0'}
                    placeholderStyle="color: #B5A99A"
                  />
                  <Text className="input-suffix">元</Text>
                </View>
              </View>
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
            </View>
          )}
        </View>
      )}

      <View className="form-group">
        <Text className="form-label">入住水电读数</Text>
        <Input
          className="form-input"
          type="text"
          placeholder="如：电 1234 / 水 56 / 气 12（可选）"
          value={moveInReading}
          onInput={(e) => setMoveInReading(e.detail.value)}
          placeholderStyle="color: #B5A99A"
          maxlength={200}
        />
        <Text className="form-error-text" style={{ color: 'var(--text-hint)', marginTop: '8px' }}>
          退租时对照读数算水电费，避免扯皮
        </Text>
      </View>

      <View className="form-group">
        <Text className="form-label">备注</Text>
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

      <View className="form-actions">
        <View className={`save-btn ${saving ? 'disabled' : ''}`} onClick={saving ? undefined : handleSave}>
          <Text className="save-btn-text">{isEdit ? '更新' : saving ? '保存中...' : '保存'}</Text>
        </View>
      </View>
    </View>
  );
}
