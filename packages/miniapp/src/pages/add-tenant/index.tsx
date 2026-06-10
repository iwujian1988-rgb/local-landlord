import { View, Text, Input, Textarea, Picker } from '@tarojs/components';
import Taro, { useDidHide } from '@tarojs/taro';
import { useState, useCallback, useEffect } from 'react';
import { get, post, put } from '../../services/request';
import { requestNotificationWithReason } from '../../services/notification';
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

  // Load room info
  useEffect(() => {
    if (urlRoomId > 0) {
      get<any>(`/rooms/${urlRoomId}`).then((res) => {
        if (res.code === 0 && res.data) {
          setCurrentRoomName(res.data.name || '');
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
          setNote(found.note || '');
          const day = found.rentDay;
          if (day !== undefined) {
            setRentDay(day);
          }
        }
      }).catch(() => {});
    }
  }, [tenantId]);

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
        if (draft.note) setNote(draft.note);
        Taro.showToast({ title: '已恢复未完成的草稿', icon: 'none', duration: 2000 });
      }
    }
  }, []);

  useDidHide(() => {
    if (tenantId <= 0) {
      const formData = {
        name, phone, moveInDate, contractEndDate,
        rentDay, deposit, note,
      };
      if (name || phone) {
        Taro.setStorageSync('draft_tenant', formData);
      }
    }
  });

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

    const tenantData: any = {
      name: name.trim(),
      phone: phone.trim(),
      moveInDate: moveInDate.trim(),
      contractEndDate: contractEndDate.trim(),
      rentDay,
      deposit: deposit ? Number(deposit) : undefined,
      note: note.trim() || undefined,
      status: 1,
    };

    try {
      if (isEdit) {
        await put(`/tenants/${tenantId}`, tenantData);
      } else {
        await post(`/rooms/${urlRoomId}/tenant`, tenantData);
      }
      Taro.removeStorageSync('draft_tenant');
      // Give landlord peace of mind: confirm the system will remind them
      const rentDayLabel = rentDay === 0 ? '月底' : `每月${rentDay}号`;
      if (!isEdit) {
        Taro.showModal({
          title: '租客已保存',
          content: `系统会在${rentDayLabel}自动提醒你收${name.trim()}的房租。合同到期前也会提醒你续签。`,
          showCancel: false,
          confirmText: '放心了',
        });
        requestNotificationWithReason('开启通知，到期自动提醒收租');
      } else {
        Taro.showToast({ title: '租客信息已更新', icon: 'none', duration: 2000 });
      }
      setTimeout(() => {
        setSaving(false);
        Taro.navigateBack();
      }, 800);
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
