import { View, Text, Input, Textarea, Picker } from '@tarojs/components';
import Taro, { useDidHide } from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import { useState, useCallback, useEffect } from 'react';
import { get, post, put } from '../../services/request';
import './index.scss';

const facilityOptions = ['有空调', '有独卫', '能做饭', '可养宠'];

export default function AddRoomInfo() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const roomId = Number(routerParams.roomId) || 0;
  const routePropertyId = Number(routerParams.propertyId) || 0;

  const [name, setName] = useState('');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [area, setArea] = useState('');
  const [floor, setFloor] = useState('');
  const [orientation, setOrientation] = useState('');
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'vacant' | 'rented'>('vacant');
  const [availableType, setAvailableType] = useState<'anytime' | 'date'>('anytime');
  const [availableDate, setAvailableDate] = useState('');
  const [propertyId, setPropertyId] = useState<number>(routePropertyId);

  const [showMore, setShowMore] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (routePropertyId) {
      if (!routePropertyId || isNaN(routePropertyId)) {
        Taro.showToast({ title: '页面打开失败，请返回重试', icon: 'none', duration: 1500 });
        setTimeout(() => Taro.navigateBack(), 1500);
        return;
      }
      setPropertyId(routePropertyId);
    }
  }, [routePropertyId]);

  // Pre-fill for edit mode
  useEffect(() => {
    if (roomId && routePropertyId) {
      loadRoomForEdit(roomId);
    }
  }, [roomId, routePropertyId]);

  const loadRoomForEdit = async (rid: number) => {
    try {
      const res = await get<any>(`/rooms/${rid}`);
      const found = res.data?.room || res.data;
      if (found && res.code === 0) {
        setIsEdit(true);
        setName(found.name || '');
        setRent(String(found.rent || ''));
        setDeposit(found.deposit ? String(found.deposit) : '');
        setArea(found.area || '');
        setFloor(found.floor || '');
        setOrientation(found.orientation || '');
        setSelectedFacilities(found.facilities || []);
        setNote(found.note || '');
        setStatus(found.status === 1 || found.status === 'rented' ? 'rented' : 'vacant');
        setAvailableDate(found.availableDate && found.availableDate !== '随时可入住' ? found.availableDate : '');
        setAvailableType(found.availableDate && found.availableDate !== '随时可入住' ? 'date' : 'anytime');
        setPropertyId(found.propertyId || routePropertyId);
      }
    } catch (err) {
      console.error('[AddRoomInfo] 加载房间失败:', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    }
  };

  // Check draft
  useEffect(() => {
    if (roomId <= 0) {
      const draft: any = Taro.getStorageSync('draft_room_info');
      if (draft) {
        setName(draft.name || '');
        setRent(draft.rent || '');
        setDeposit(draft.deposit || '');
        setArea(draft.area || '');
        setFloor(draft.floor || '');
        setOrientation(draft.orientation || '');
        setSelectedFacilities(draft.selectedFacilities || []);
        setNote(draft.note || '');
        setStatus(draft.status || 'vacant');
        setAvailableType(draft.availableType || 'anytime');
        setAvailableDate(draft.availableDate || '');
        Taro.showToast({ title: '已恢复未完成的草稿', icon: 'none', duration: 2000 });
      }
    }
  }, []);

  const goBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  useDidHide(() => {
    if (roomId <= 0) {
      const formData = {
        name, rent, deposit, area, floor, orientation,
        selectedFacilities, note, status, availableType, availableDate,
      };
      if (name || rent) {
        Taro.setStorageSync('draft_room_info', formData);
      }
    }
  });

  const toggleFacility = useCallback((f: string) => {
    setSelectedFacilities((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setErrors({});
    if (!name.trim()) {
      setErrors({ name: '请输入房间名称' });
      return;
    }
    if (!rent.trim() || Number(rent) <= 0) {
      setErrors({ rent: '请输入有效租金' });
      return;
    }
    setSaving(true);
    const tempPhotos = Taro.getStorageSync('tempRoomPhotos') || [];

    const roomData: any = {
      name: name.trim(),
      rent: Number(rent),
      status: status === 'rented' ? 1 : 0,
      availableDate: availableType === 'date' ? availableDate : '随时可入住',
      deposit: deposit ? Number(deposit) : undefined,
      area: area.trim() || undefined,
      floor: floor.trim() || undefined,
      orientation: orientation.trim() || undefined,
      facilities: selectedFacilities.length > 0 ? selectedFacilities : undefined,
      images: tempPhotos.length > 0 ? tempPhotos : [],
      note: note.trim() || undefined,
    };

    try {
      let savedRoomId = roomId;
      if (isEdit) {
        await put(`/rooms/${roomId}`, roomData);
      } else {
        const createRes = await post<any>(`/properties/${propertyId}/rooms`, roomData);
        if (createRes.code !== 0) {
          throw new Error(createRes.message || '创建失败');
        }
        savedRoomId = createRes.data?.id || createRes.data?._id || 0;
      }

      Taro.removeStorageSync('draft_room_info');
      Taro.removeStorageSync('tempRoomPhotos');
      setSaving(false);

      Taro.showModal({
        title: '房间已保存',
        content: '要现在登记租客吗？',
        confirmText: '现在登记',
        cancelText: '稍后再说',
        success: (res: any) => {
          if (res.confirm) {
            Taro.navigateTo({ url: `/pages/add-tenant/index?roomId=${savedRoomId}` });
          } else {
            Taro.navigateBack();
          }
        },
      });
    } catch (err) {
      console.error('[AddRoomInfo] 保存房间失败:', err);
      Taro.showToast({ title: '保存失败', icon: 'none' });
      setSaving(false);
    }
  }, [saving, isEdit, roomId, name, rent, propertyId, status, availableType, availableDate, deposit, area, floor, orientation, selectedFacilities, note]);

  return (
    <View className="page-add-room-info">
      <NavBar title={isEdit ? '编辑房间信息' : '填写房间信息'} onBack={goBack} />

      <View className="form-group">
        <Text className="form-label">房间名称 *</Text>
        <Input
          className={`form-input${errors.name ? ' error' : ''}`}
          type="text"
          placeholder="如：101 / 主卧 / 单间A"
          value={name}
          onInput={(e) => { setName(e.detail.value); setErrors({}); }}
          placeholderStyle="color: #B5A99A"
        />
        {errors.name && <Text className="form-error-text">{errors.name}</Text>}
      </View>

      <View className="form-group">
        <Text className="form-label">每月租金 *</Text>
        <View className="input-with-suffix">
          <Input
            className={`form-input suffix-input${errors.rent ? ' error' : ''}`}
            type="digit"
            placeholder="输入金额"
            value={rent}
            onInput={(e) => { setRent(e.detail.value); setErrors({}); }}
            placeholderStyle="color: #B5A99A"
          />
          <Text className="input-suffix">元</Text>
        </View>
        {errors.rent && <Text className="form-error-text">{errors.rent}</Text>}
      </View>

      <View className="form-group">
        <Text className="form-label">房间状态</Text>
        <View className="status-toggle">
          <View
            className={`status-option ${status === 'vacant' ? 'active accent' : ''}`}
            onClick={() => setStatus('vacant')}
          >
            <Text className="status-option-text">空着</Text>
          </View>
          <View
            className={`status-option ${status === 'rented' ? 'active accent' : ''}`}
            onClick={() => setStatus('rented')}
          >
            <Text className="status-option-text">已出租</Text>
          </View>
        </View>
      </View>

      <View className="form-group">
        <Text className="form-label">可入住时间</Text>
        <View className="status-toggle">
          <View
            className={`status-option ${availableType === 'anytime' ? 'active accent' : ''}`}
            onClick={() => setAvailableType('anytime')}
          >
            <Text className="status-option-text">随时可入住</Text>
          </View>
          <View
            className={`status-option ${availableType === 'date' ? 'active accent' : ''}`}
            onClick={() => setAvailableType('date')}
          >
            <Text className="status-option-text">选择日期</Text>
          </View>
        </View>
        {availableType === 'date' && (
          <Picker mode="date" value={availableDate} onChange={e => setAvailableDate(e.detail.value)}>
            <View className="form-input" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', color: availableDate ? 'var(--text-primary)' : 'var(--text-hint)' }}>
              {availableDate || '请选择可入住日期'}
            </View>
          </Picker>
        )}
      </View>

      {/* More Info Toggle */}
      <View className="more-toggle" onClick={() => setShowMore(!showMore)}>
        <Text className="more-toggle-text">更多信息（可选）</Text>
        <svg
          width="16" height="16" viewBox="0 0 24 24"
          stroke="var(--accent-hover)" strokeWidth="1.8" fill="none"
          style={{ transform: showMore ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.3s ease' }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </View>

      {showMore && (
        <View className="more-section">
          <View className="form-group">
            <Text className="form-label">押金</Text>
            <Input
              className="form-input"
              type="digit"
              placeholder="输入押金金额"
              value={deposit}
              onInput={(e) => setDeposit(e.detail.value)}
              placeholderStyle="color: #B5A99A"
            />
          </View>
          <View className="form-group">
            <Text className="form-label">面积</Text>
            <Input
              className="form-input"
              type="text"
              placeholder="如：25 平米"
              value={area}
              onInput={(e) => setArea(e.detail.value)}
              placeholderStyle="color: #B5A99A"
            />
          </View>
          <View className="form-group">
            <Text className="form-label">楼层</Text>
            <Input
              className="form-input"
              type="text"
              placeholder="如：3 楼"
              value={floor}
              onInput={(e) => setFloor(e.detail.value)}
              placeholderStyle="color: #B5A99A"
            />
          </View>
          <View className="form-group">
            <Text className="form-label">朝向</Text>
            <Input
              className="form-input"
              type="text"
              placeholder="如：朝南"
              value={orientation}
              onInput={(e) => setOrientation(e.detail.value)}
              placeholderStyle="color: #B5A99A"
            />
          </View>
          <View className="form-group">
            <Text className="form-label">设施</Text>
            <View className="facilities-grid">
              {facilityOptions.map((f) => (
                <View
                  key={f}
                  className={`facility-tag ${selectedFacilities.includes(f) ? 'selected' : ''}`}
                  onClick={() => toggleFacility(f)}
                >
                  <Text className="facility-tag-text">{f}</Text>
                </View>
              ))}
            </View>
          </View>
          <View className="form-group">
            <Text className="form-label">备注</Text>
            <Textarea
              className="form-textarea"
              placeholder="写点备注..."
              value={note}
              onInput={(e) => setNote(e.detail.value)}
              placeholderStyle="color: #B5A99A"
              maxlength={200}
              autoHeight
            />
          </View>
        </View>
      )}

      <View className="form-actions">
        <View className={`save-btn ${saving ? 'disabled' : ''}`} onClick={saving ? undefined : handleSave}>
          <Text className="save-btn-text">{isEdit ? '更新' : saving ? '保存中...' : '保存'}</Text>
        </View>
      </View>

    </View>
  );
}
