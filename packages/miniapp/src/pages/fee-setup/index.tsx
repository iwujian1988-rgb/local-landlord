import { View, Text, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import EmptyState from '../../components/EmptyState';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import { FeeSetting } from '../../appData';
import { get, post, put } from '../../services/request';
import { useState, useCallback } from 'react';
import './index.scss';

interface ApiFeeItem {
  _id?: string;
  id?: string;
  name: string;
  type: 'fixed' | 'manual';
  amount: string | number;
  enabled: boolean;
  isRent: boolean;
}

export default function FeeSetup() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const roomId = Number(routerParams.roomId) || 0;

  const [fees, setFees] = useState<FeeSetting[]>([]);
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    if (!roomId) return;
    setLoading(true);
    setError(false);
    try {
      const [feeRes, roomRes] = await Promise.all([
        get<ApiFeeItem[]>(`/rooms/${roomId}/fee-items`),
        get<any>(`/rooms/${roomId}`),
      ]);
      if (feeRes.code === 0) {
        const items: FeeSetting[] = (feeRes.data || []).map((f: ApiFeeItem) => ({
          name: f.name,
          type: f.type || 'fixed',
          amount: String(f.amount || ''),
          enabled: f.enabled !== false,
          isRent: f.isRent || false,
        }));
        setFees(items);
      }
      if (roomRes.code === 0 && roomRes.data) {
        const room = roomRes.data.room || roomRes.data;
        setRoomName(room.name || '');
      }
    } catch (err) {
      console.error('[FeeSetup] 加载数据失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    loadData();
  });

  const title = roomName ? `${roomName} · 每月要收哪些钱` : '每月要收哪些钱';

  const goBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

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

  const handleSendBill = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await post(`/rooms/${roomId}/fee-items`, { fees });
      Taro.navigateTo({ url: `/pages/bill/index?roomId=${roomId}` });
    } catch (err) {
      console.error('[FeeSetup] 保存失败:', err);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [fees, roomId, submitting]);

  const handleMarkPaid = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await post(`/rooms/${roomId}/fee-items`, { fees });
      Taro.showToast({ title: '已标记为已收款', icon: 'none', duration: 2000 });
    } catch (err) {
      console.error('[FeeSetup] 保存失败:', err);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [fees, roomId, submitting]);

  const addCustomFee = useCallback(() => {
    setFees((prev) => [
      ...prev,
      { name: '自定义项目', type: 'manual', amount: '', enabled: true, isRent: false },
    ]);
  }, []);

  return (
    <View className="page-fee-setup">
      <NavBar title={title} onBack={goBack} />

      {loading && <Loading />}
      {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
      {!loading && !error && (
        <>
      <View className="fee-hint">
        <Text className="fee-hint-text">设置本房间每个月要收的项目和规则</Text>
      </View>

      <View className="fee-list">
        {!loading && fees.length === 0 ? (
          <EmptyState title="暂无收费项目" description="设置每个月要收哪些费用，比如房租、水电费" actionText="添加收费项目" onAction={addCustomFee} />
        ) : (
          fees.map((fee, idx) => (
          <View key={idx} className="fee-item">
            <View className="fee-info">
              <Text className="fee-name">{fee.name}</Text>
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
        <View className={`action-btn primary${submitting ? ' disabled' : ''}`} onClick={submitting ? undefined : handleSendBill}>
          <Text className="action-btn-text">{submitting ? '处理中...' : '发微信账单'}</Text>
        </View>
        <View className={`action-btn secondary${submitting ? ' disabled' : ''}`} onClick={submitting ? undefined : handleMarkPaid}>
          <Text className="action-btn-text secondary-text">{submitting ? '处理中...' : '标记已收款'}</Text>
        </View>
      </View>
        </>
      )}
    </View>
  );
}
