import { View, Text, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import EmptyState from '../../components/EmptyState';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import { get, post } from '../../services/request';
import { useState, useCallback, useRef } from 'react';
import { firstFormError, validateFeeForm } from '../../utils/form-validation';
import { FeeFormItem, getRoomNameFromResponse, normalizeFeeItems } from '../../utils/fee-form';
import './index.scss';

interface FeeSetting extends FeeFormItem {
  /**
   * Only meaningful when type==='fixed'. Controls whether the amount multiplies
   * by payMonths at bill-generation time:
   * - 'rent'    → ×payMonths (default). E.g. 房租/网费.
   * - 'monthly' → ×1 regardless. E.g. 停车管理费 charged per-month.
   */
  cycleMode: 'rent' | 'monthly';
}

interface RoomOption {
  id: number;
  name: string;
  rent: number;
  propertyName?: string;
  tenantName?: string;
}

export default function FeeSetup() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const roomId = Number(routerParams.roomId) || 0;

  const [fees, setFees] = useState<FeeSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);

  // Room picker state (when no roomId)
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<number>(roomId);

  const effectiveRoomId = selectedRoomId || roomId;

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const res = await get<any[]>('/rooms');
      if (res.code === 0 && res.data) {
        setRooms(res.data);
      }
    } catch (err) {
      console.error('[FeeSetup] 加载房间列表失败:', err);
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  const loadFees = useCallback(async (rid: number) => {
    if (!rid) return;
    setLoading(true);
    setError(false);
    try {
      const feeRes = await get<unknown>(`/rooms/${rid}/fee-items`);
      setFees(normalizeFeeItems(feeRes.data));
    } catch (err) {
      console.error('[FeeSetup] 加载数据失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Room title is auxiliary and must never delay or blank the fee list.
  const loadRoomTitle = useCallback(async (rid: number) => {
    try {
      const roomRes = await get<any>(`/rooms/${rid}`);
      const resolvedRoomName = getRoomNameFromResponse(roomRes.data);
      Taro.setNavigationBarTitle({ title: `${resolvedRoomName || '房间'} · 每月收费项目` });
    } catch (roomErr) {
      console.warn('[FeeSetup] 加载房间标题失败:', roomErr);
    }
  }, []);

  useDidShow(() => {
    if (effectiveRoomId) {
      Taro.setNavigationBarTitle({ title: '房间 · 每月收费项目' });
      loadFees(effectiveRoomId);
      loadRoomTitle(effectiveRoomId);
    } else {
      Taro.setNavigationBarTitle({ title: '收费项目' });
      loadRooms();
    }
  });

  const selectRoom = (rid: number) => {
    setSelectedRoomId(rid);
    loadFees(rid);
  };

  const toggleEnabled = useCallback((idx: number) => {
    setFees((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, enabled: !f.enabled } : f))
    );
  }, []);

  const updateAmount = useCallback((idx: number, value: string) => {
    setFees((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, amount: value } : f))
    );
  }, []);

  const updateCycleMode = useCallback((idx: number, mode: 'rent' | 'monthly') => {
    setFees((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, cycleMode: mode } : f))
    );
  }, []);

  const updateName = useCallback((idx: number, value: string) => {
    setFees((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, name: value } : f))
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (submitInFlightRef.current || !effectiveRoomId) return;
    const validationErrors = validateFeeForm(fees);
    if (Object.keys(validationErrors).length > 0) {
      Taro.showToast({ title: firstFormError(validationErrors), icon: 'none' });
      return;
    }
    submitInFlightRef.current = true;
    setSubmitting(true);
    try {
      // Coerce amount from input-string to number before POSTing — the input
      // stores strings, but the backend decimal column should receive numbers
      // to avoid relying on SQLite's implicit string→decimal coercion (which
      // silently rounds/truncates in some edge cases).
      const payload = fees.map(f => ({
        ...f,
        name: f.name.trim(),
        amount: f.type === 'manual' ? 0 : (Number(f.amount) || 0),
      }));
      await post(`/rooms/${effectiveRoomId}/fee-items`, { fees: payload });
      Taro.showToast({ title: '已保存', icon: 'success', duration: 1500 });
      // Navigate back after the toast so the landlord sees confirmation
      // feedback instead of being left on the same page wondering if it worked.
      setTimeout(() => {
        Taro.navigateBack({ delta: 1 }).catch(() => {
          // No back stack (e.g. deep-linked) — switch to rooms tab as fallback
          Taro.switchTab({ url: '/pages/rooms/index' }).catch(() => {});
        });
      }, 800);
    } catch (err) {
      console.error('[FeeSetup] 保存失败:', err);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  }, [fees, effectiveRoomId]);

  const addCustomFee = useCallback(() => {
    setFees((prev) => [
      ...prev,
      { name: '', type: 'fixed', amount: '', enabled: true, isRent: false, cycleMode: 'rent', billingMonths: 1, initialMonths: 1 },
    ]);
  }, []);

  // Room picker view (no roomId)
  if (!effectiveRoomId) {
    return (
      <View className="page-fee-setup">
        <View className="fee-hint">
          <Text className="fee-hint-text">选择一个房间来管理收费项目</Text>
        </View>
        {roomsLoading && <Loading />}
        {!roomsLoading && rooms.length === 0 && (
          <EmptyState
            title="还没有房间"
            description="先添加房间，才能设置收费项目"
            actionText="去添加房间"
            onAction={() => Taro.switchTab({ url: '/pages/rooms/index' })}
          />
        )}
        <View className="room-pick-list">
          {rooms.map((room) => (
            <View
              key={room.id}
              className="room-pick-card"
              onClick={() => selectRoom(room.id)}
            >
              <View className="room-pick-info">
                <Text className="room-pick-name">{room.name}</Text>
                <Text className="room-pick-meta">
                  {room.propertyName || ''}{room.tenantName ? ` · ${room.tenantName}` : ''} · {room.rent}元/月
                </Text>
              </View>
              <Text className="room-pick-arrow">›</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View className="page-fee-setup">
      {loading && <Loading />}
      {error && <ErrorState description="加载失败，请稍后重试" onRetry={() => loadFees(effectiveRoomId)} />}
      {!loading && !error && (
        <>
          <View className="fee-hint">
            <Text className="fee-hint-text">设置当前租客后续账单的收费规则；已经生成的账单不会追溯修改</Text>
          </View>

          <View className="fee-list">
            {fees.length === 0 ? (
              <EmptyState title="暂无收费项目" description="设置每个月要收哪些费用，比如房租、水电费" actionText="添加收费项目" onAction={addCustomFee} />
            ) : (
              fees.map((fee, idx) => (
                <View key={idx} className="fee-item">
                  <View className="fee-info">
                    {fee.isRent ? (
                      <Text className="fee-name">{fee.name}</Text>
                    ) : (
                      <Input
                        className="fee-name-input"
                        type="text"
                        placeholder="输入项目名称"
                        value={fee.name}
                        maxlength={32}
                        onInput={(e) => updateName(idx, e.detail.value)}
                      />
                    )}
                    <Text className="fee-desc">
                      {fee.isRent
                        ? '每月都收'
                        : fee.type === 'fixed'
                          ? (fee.cycleMode === 'monthly' ? '按月单独收' : '跟房租一起收')
                          : '每月手动填写'}
                    </Text>
                  </View>
                  {fee.type === 'fixed' && fee.enabled ? (
                    <View className="fee-amount">
                      <Input
                        className="fee-amount-input"
                        type="digit"
                        value={fee.amount}
                        onInput={(e) => updateAmount(idx, e.detail.value)}
                      />
                      <Text className="fee-amount-unit">元</Text>
                    </View>
                  ) : fee.type === 'manual' && fee.enabled ? (
                    <Text className="fee-amount manual">手填</Text>
                  ) : (
                    <View className="fee-amount-placeholder" />
                  )}
                  <View
                    className={`toggle-switch ${fee.enabled ? 'on' : ''} ${fee.isRent ? 'disabled' : ''}`}
                    onClick={() => !fee.isRent && toggleEnabled(idx)}
                  />
                  {/* Cycle mode picker — only for fixed-type, non-rent fees.
                      'rent' multiplies amount by payMonths at bill time,
                      'monthly' keeps it at 1 month regardless of payMonths. */}
                  {fee.type === 'fixed' && !fee.isRent && fee.enabled && (
                    <View className="fee-cycle-row">
                      <View
                        className={`cycle-chip ${fee.cycleMode === 'rent' ? 'active' : ''}`}
                        onClick={() => updateCycleMode(idx, 'rent')}
                      >
                        <Text className="cycle-chip-text">跟房租一起收</Text>
                      </View>
                      <View
                        className={`cycle-chip ${fee.cycleMode === 'monthly' ? 'active' : ''}`}
                        onClick={() => updateCycleMode(idx, 'monthly')}
                      >
                        <Text className="cycle-chip-text">按月单独收</Text>
                      </View>
                    </View>
                  )}
                </View>
              ))
            )}

            <View className="add-fee-btn" onClick={addCustomFee}>
              <Text className="add-fee-btn-text">+ 添加其他收费项目</Text>
            </View>
          </View>

          <View className="fee-actions">
            <View className={`action-btn primary${submitting ? ' disabled' : ''}`} onClick={submitting ? undefined : handleSave}>
              <Text className="action-btn-text">{submitting ? '保存中...' : '保存'}</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}
