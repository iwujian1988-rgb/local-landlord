import { View, Text, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import EmptyState from '../../components/EmptyState';
import { FeeSetting } from '../../appData';
import { getAppData, setAppData } from '../../utils/storage';
import { useState, useCallback } from 'react';
import './index.scss';

export default function FeeSetup() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const roomId = Number(routerParams.roomId) || 0;

  const [fees, setFees] = useState<FeeSetting[]>([]);

  useDidShow(() => {
    const data = getAppData();
    setFees((data.billSettings && data.billSettings.feeSettings) ? data.billSettings.feeSettings : []);
  });

  const title = (() => {
    if (roomId > 0) {
      const appData = getAppData();
      const room = (appData.rooms || []).find((r: any) => r.id === roomId);
      return room ? `${room.name} · 每月要收哪些钱` : '每月要收哪些钱';
    }
    return '每月要收哪些钱';
  })();

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

  const handleSendBill = useCallback(() => {
    const appData = getAppData();
    appData.billSettings = appData.billSettings || {};
    appData.billSettings.feeSettings = fees;
    setAppData(appData);
    Taro.navigateTo({ url: `/pages/bill/index?roomId=${roomId}` });
  }, [fees]);

  const handleMarkPaid = useCallback(() => {
    const appData = getAppData();
    appData.billSettings = appData.billSettings || {};
    appData.billSettings.feeSettings = fees;
    setAppData(appData);
    Taro.showToast({ title: '已标记为已收款', icon: 'none', duration: 2000 });
  }, [fees]);

  const addCustomFee = useCallback(() => {
    setFees((prev) => [
      ...prev,
      { name: '自定义项目', type: 'manual', amount: '', enabled: true, isRent: false },
    ]);
  }, []);

  return (
    <View className="page-fee-setup">
      <NavBar title={title} onBack={goBack} />

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
        <View className="action-btn primary" onClick={handleSendBill}>
          <Text className="action-btn-text">发微信账单</Text>
        </View>
        <View className="action-btn secondary" onClick={handleMarkPaid}>
          <Text className="action-btn-text secondary-text">标记已收款</Text>
        </View>
      </View>
    </View>
  );
}
