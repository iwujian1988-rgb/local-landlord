import { View, Text, Input, Textarea, Picker } from '@tarojs/components';
import Taro, { useDidHide } from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import { useState, useCallback, useEffect } from 'react';
import { get, post, put } from '../../services/request';
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
  const [currentRoomName, setCurrentRoomName] = useState('');

  // Load room info
  useEffect(() => {
    if (urlRoomId > 0) {
      get<any>(`/rooms/${urlRoomId}`).then((res) => {
        if (res.code === 0 && res.data) {
          const room = res.data.room || res.data;
          setCurrentRoomName(room.name || '');
        }
      }).catch(() => {});
    }
  }, [urlRoomId]);

  // Pre-fill for edit mode
  useEffect(() => {
    if (tenantId > 0) {
      get<any>(`/tenants/${tenantId}`).then((res) => {
        if (res.code === 0 && res.data) {
          const found = res.data.tenant || res.data;
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
      }).catch(() => {});
    }
  }, [tenantId]);

  // Check draft
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
    const rentDayNum = rentDay === -1 ? customDay : rentDay;

    const tenantData: any = {
      name: name.trim(),
      phone: phone.trim(),
      moveInDate: moveInDate.trim(),
      contractEndDate: contractEndDate.trim(),
      rentDay: rentDayNum,
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
      Taro.showToast({ title: '租客信息已保存', icon: 'none', duration: 2000 });
      setTimeout(() => {
        setSaving(false);
        Taro.navigateBack();
      }, 800);
    } catch (err) {
      console.error('[AddTenant] 保存租客失败:', err);
      Taro.showToast({ title: '保存失败', icon: 'none' });
      setSaving(false);
    }
  }, [saving, isEdit, tenantId, name, phone, urlRoomId, rentDay, customDay, moveInDate, contractEndDate, deposit, note]);

  return (
    <View className="page-add-tenant">
      <NavBar title={isEdit ? '编辑租客' : '登记租客'} onBack={goBack} />

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
            <svg width="20" height="20" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth="1.8" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
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
            <svg width="20" height="20" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth="1.8" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </View>
        </Picker>
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
            <Picker
              mode="selector"
              range={Array.from({ length: 31 }, (_, i) => `${i + 1}号`)}
              value={customDay - 1}
              onChange={(e) => {
                const val = Number(e.detail.value) + 1;
                setCustomDay(val);
                setRentDayLabel(`${val}号`);
              }}
            >
              <View className="form-input" style={{ color: 'var(--text-primary)' }}>
                {customDay}号
              </View>
            </Picker>
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
