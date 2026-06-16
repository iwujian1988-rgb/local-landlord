import { View, Text, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import EmptyState from '../../components/EmptyState';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import { get, post } from '../../services/request';
import { useState, useCallback } from 'react';
import './index.scss';

interface FeeSetting {
  name: string;
  type: 'fixed' | 'manual';
  amount: string;
  enabled: boolean;
  isRent: boolean;
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
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      const [feeRes, roomRes] = await Promise.all([
        get<any[]>(`/rooms/${rid}/fee-items`),
        get<any>(`/rooms/${rid}`),
      ]);
      if (feeRes.code === 0) {
        const items: FeeSetting[] = (feeRes.data || []).map((f: any) => ({
          name: f.name,
          type: f.type || 'fixed',
          amount: String(f.amount || ''),
          enabled: f.enabled !== false,
          isRent: f.isRent || false,
        }));
        setFees(items);
      }
      if (roomRes.code === 0 && roomRes.data) {
        setRoomName(roomRes.data.name || '');
        Taro.setNavigationBarTitle({ title: `${roomRes.data.name || '房间'} · 每月收费项目` });
      }
    } catch (err) {
      console.error('[FeeSetup] 加载数据失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    if (effectiveRoomId) {
      loadFees(effectiveRoomId);
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

  const updateName = useCallback((idx: number, value: string) => {
    setFees((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, name: value } : f))
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (submitting || !effectiveRoomId) return;
    setSubmitting(true);
    try {
      await post(`/rooms/${effectiveRoomId}/fee-items`, { fees });
      Taro.showToast({ title: '已保存', icon: 'none', duration: 1500 });
    } catch (err) {
      console.error('[FeeSetup] 保存失败:', err);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [fees, effectiveRoomId, submitting]);

  const addCustomFee = useCallback(() => {
    setFees((prev) => [
      ...prev,
      { name: '', type: 'fixed', amount: '', enabled: true, isRent: false },
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

  const title = roomName ? `${roomName} · 每月收费项目` : '每月收费项目';

  return (
    <View className="page-fee-setup">
      {loading && <Loading />}
      {error && <ErrorState description="加载失败，请稍后重试" onRetry={() => loadFees(effectiveRoomId)} />}
      {!loading && !error && (
        <>
          <View className="fee-hint">
            <Text className="fee-hint-text">设置本房间每个月要收的项目和规则</Text>
          </View>

          <View className="fee-list">
            {fees.length === 0 ? (
              <EmptyState title="暂无收费项目" description="设置每个月要收哪些费用，比如房租、水电费" actionText="添加收费项目" onAction={addCustomFee} />
            ) : (
              fees.map((fee, idx) => (
                <View key={idx} className="fee-item">
                  <View className="fee-info">
                    {fee.name ? (
                      <Text className="fee-name">{fee.name}</Text>
                    ) : (
                      <Input
                        className="fee-name-input"
                        type="text"
                        placeholder="输入项目名称"
                        value={fee.name}
                        onInput={(e) => updateName(idx, e.detail.value)}
                      />
                    )}
                    <Text className="fee-desc">
                      {fee.isRent ? '每月都收' : fee.type === 'fixed' ? '跟房租一起收' : '每月手动填写'}
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
