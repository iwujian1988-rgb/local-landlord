import { View, Text, Input, Textarea, PickerView, PickerViewColumn } from '@tarojs/components';
import Taro, { useDidHide } from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import { useState, useCallback, useEffect } from 'react';
import { getAppData, setAppData } from '../../utils/storage';
import './index.scss';

const rentDayOptions = [
  { label: '1号', value: 1 },
  { label: '5号', value: 5 },
  { label: '10号', value: 10 },
  { label: '15号', value: 15 },
  { label: '20号', value: 20 },
  { label: '25号', value: 25 },
  { label: '月底', value: 0 },
  { label: '自定义', value: -1 },
];

export default function AddTenant() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const urlRoomId = Number(routerParams.roomId) || 0;
  const tenantId = Number(routerParams.tenantId) || 0;

  // Load existing tenant for edit mode
  const storedRooms: Array<{ id: number; propertyId: number; name: string }> = getAppData().rooms || [];
  const currentRoom = storedRooms.find((r) => r.id === urlRoomId);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [moveInDate, setMoveInDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [rentDay, setRentDay] = useState<number>(10);
  const [rentDayLabel, setRentDayLabel] = useState('10号');
  const [deposit, setDeposit] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customDay, setCustomDay] = useState(1);
  const [isEdit, setIsEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pre-fill for edit mode
  useEffect(() => {
    if (tenantId > 0) {
      const appData = getAppData();
      const found = appData.tenants.find((t: any) => t.id === tenantId);
      if (found) {
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
          const opt = rentDayOptions.find(o => o.value === day);
          setRentDayLabel(opt ? opt.label : `${day}号`);
          if (day > 0 && !rentDayOptions.find(o => o.value === day)) {
            setCustomDay(day);
          }
        }
      }
    }
  }, [tenantId]);

  // 检查草稿
  useEffect(() => {
    if (tenantId <= 0) {
      const draft: any = Taro.getStorageSync('draft_tenant');
      if (draft) {
        setName(draft.name || '');
        setPhone(draft.phone || '');
        setMoveInDate(draft.moveInDate || '');
        setContractEndDate(draft.contractEndDate || '');
        if (draft.rentDay !== undefined) setRentDay(draft.rentDay);
        if (draft.rentDayLabel) setRentDayLabel(draft.rentDayLabel);
        if (draft.deposit) setDeposit(draft.deposit);
        if (draft.note) setNote(draft.note);
        if (draft.customDay) setCustomDay(draft.customDay);
        Taro.showToast({ title: '已恢复未完成的草稿', icon: 'none', duration: 2000 });
      }
    }
  }, []);

  const goBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  // 自动保存草稿
  useDidHide(() => {
    if (tenantId <= 0) {
      const formData = {
        name, phone, moveInDate, contractEndDate,
        rentDay, rentDayLabel, customDay, deposit, note,
      };
      if (name || phone) {
        Taro.setStorageSync('draft_tenant', formData);
      }
    }
  });

  const handleDatePick = useCallback((field: 'moveIn' | 'contractEnd') => {
    Taro.showToast({ title: '请选择日期', icon: 'none', duration: 1000 });
    // In mini-program, use a date picker to select date
    // For now, use text input with pattern hint
  }, []);

  const handleSave = useCallback(() => {
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
    const rentDayNum = rentDay === -1 ? customDay : rentDay;
    const now = new Date().toISOString();
    const appData = getAppData();

    const tenantData: any = {
      id: isEdit ? tenantId : Date.now(),
      roomId: urlRoomId,
      name: name.trim(),
      phone: phone.trim(),
      moveInDate: moveInDate.trim(),
      contractEndDate: contractEndDate.trim(),
      rentDay: rentDayNum,
      deposit: deposit ? Number(deposit) : undefined,
      note: note.trim() || undefined,
      status: 1,
      updatedAt: now,
    };
    if (!isEdit) {
      tenantData.createdAt = now;
    }

    if (isEdit) {
      const idx = appData.tenants.findIndex((t: any) => t.id === tenantId);
      if (idx !== -1) {
        appData.tenants[idx] = { ...appData.tenants[idx], ...tenantData };
      }
    } else {
      appData.tenants.push(tenantData);
    }

    // Update room status to rented
    appData.rooms = appData.rooms.map((r: any) =>
      r.id === urlRoomId ? { ...r, status: 1 } : r
    );

    setAppData(appData);
    Taro.removeStorageSync('draft_tenant');
    Taro.showToast({ title: '租客信息已保存', icon: 'none', duration: 2000 });
    setTimeout(() => {
      setSaving(false);
      Taro.navigateBack();
    }, 800);
  }, [saving, isEdit, tenantId, name, phone, urlRoomId, rentDay, customDay, moveInDate, contractEndDate, deposit, note]);

  return (
    <View className="page-add-tenant">
      <NavBar title={isEdit ? '编辑租客' : '登记租客'} onBack={goBack} />

      {currentRoom && (
        <View className="form-group">
          <Text className="form-label">关联房间</Text>
          <Text className="form-readonly">{currentRoom.name}</Text>
        </View>
      )}

      {!currentRoom && urlRoomId > 0 && (
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
        <View className="date-input-wrap" onClick={() => handleDatePick('moveIn')}>
          <Text className="date-input-text" style={{ color: moveInDate ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {moveInDate || '如：2024-08-10'}
          </Text>
          <svg width="20" height="20" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth="1.8" fill="none">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </View>
      </View>

      <View className="form-group">
        <Text className="form-label">合同到期时间</Text>
        <View className="date-input-wrap" onClick={() => handleDatePick('contractEnd')}>
          <Text className="date-input-text" style={{ color: contractEndDate ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {contractEndDate || '如：2026-08-10'}
          </Text>
          <svg width="20" height="20" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth="1.8" fill="none">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </View>
      </View>

      <View className="form-group">
        <Text className="form-label">每月收租日</Text>
        <View className="rent-day-grid">
          {rentDayOptions.map((opt) => (
            <View
              key={opt.value}
              className={`rent-day-item ${rentDay === opt.value && rentDayLabel === opt.label ? 'active' : ''}`}
              onClick={() => {
                if (opt.value === -1) {
                  setRentDay(-1);
                  setRentDayLabel('自定义');
                  setShowCustomPicker(true);
                } else {
                  setRentDay(opt.value);
                  setRentDayLabel(opt.label);
                  setShowCustomPicker(false);
                }
              }}
            >
              <Text className="rent-day-text">{opt.label}</Text>
            </View>
          ))}
        </View>

        {showCustomPicker && (
          <View className="custom-day-picker">
            <Text className="custom-day-label">选择具体日期</Text>
            <Input
              className="form-input custom-day-input"
              type="number"
              placeholder="输入日期（1-31）"
              value={String(customDay)}
              onInput={(e) => {
                const val = Number(e.detail.value);
                if (val >= 1 && val <= 31) {
                  setCustomDay(val);
                  setRentDayLabel(`${val}号`);
                }
              }}
              placeholderStyle="color: #B5A99A"
              maxlength={2}
            />
          </View>
        )}
      </View>

      <View className="form-group">
        <Text className="form-label">押金金额</Text>
        <View className="input-with-suffix">
          <Input
            className="form-input suffix-input"
            type="digit"
            placeholder="输入押金金额"
            value={deposit}
            onInput={(e) => setDeposit(e.detail.value)}
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
