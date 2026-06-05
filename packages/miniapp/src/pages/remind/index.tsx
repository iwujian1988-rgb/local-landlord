import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import { useState, useCallback, useMemo } from 'react';
import { get, post } from '../../services/request';
import './index.scss';

export default function Remind() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const roomId = Number(routerParams.roomId) || 0;
  const tenantId = Number(routerParams.tenantId) || 0;

  const [tenantName, setTenantName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [errorChecked, setErrorChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (roomId === 0 && !errorChecked) {
    setErrorChecked(true);
    Taro.showToast({ title: '页面打开失败，请返回重试', icon: 'none', duration: 1500 });
    setTimeout(() => Taro.navigateBack(), 1500);
  }

  const month = useMemo(() => {
    const d = new Date();
    return d.getMonth() + 1;
  }, []);

  const loadData = useCallback(async () => {
    // Fetch room data
    const roomRes = await get<any>(`/rooms`);
    const rooms = roomRes.data || [];
    const room = rooms.find((r: any) => r.id === roomId);
    if (room) {
      setRoomName(room.name);
      // Calculate amount from room rent
      let amount = room.rent || 0;
      if (tenantId > 0 && room.tenants) {
        const tenant = room.tenants.find((t: any) => t.id === tenantId);
        if (tenant) setTenantName(tenant.name || '-');
      }
      // Add fixed fee items from room settings if available
      const feeItems = room.feeItems || [];
      feeItems.forEach((f: any) => {
        if (f.enabled !== false && f.type === 'fixed') {
          amount += f.amount || 0;
        }
      });
      setTotalAmount(amount);
    }
  }, [roomId, tenantId]);

  useDidShow(() => { loadData(); });

  const reminderText = useMemo(() => {
    return `${tenantName || '租客'}您好，您有一笔费用待支付：

${roomName || '房间'} · ${month}月账单
应付金额：${totalAmount.toLocaleString()} 元

请及时查看并付款，谢谢您。`;
  }, [tenantName, roomName, month, totalAmount]);

  const goBack = useCallback(() => { Taro.navigateBack(); }, []);

  const handleSendPayment = useCallback(() => {
    Taro.navigateTo({
      url: `/pages/payment/index?roomId=${roomId}&amount=${totalAmount}`
    });
  }, [roomId, totalAmount]);

  const handleCopyText = useCallback(() => {
    Taro.setClipboardData({
      data: reminderText,
      success: () => Taro.showToast({ title: '文字已复制，可以发给租客了', icon: 'none', duration: 2000 }),
      fail: () => Taro.showToast({ title: '复制失败，请长按文字后手动复制', icon: 'none', duration: 3000 }),
    });
  }, [reminderText]);

  const handleMarkReminded = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await post(`/rooms/${roomId}/remind`, {
        tenantId,
        month: `${new Date().getFullYear()}-${month}`,
      });
      Taro.showToast({ title: '已标记为已提醒', icon: 'none', duration: 2000 });
    } catch (_) {
      Taro.showToast({ title: '操作失败了，再试一次', icon: 'none', duration: 2000 });
    } finally {
      setSubmitting(false);
    }
  }, [roomId, tenantId, month, submitting]);

  return (
    <View className="page-remind">
      <NavBar title="提醒租客" onBack={goBack} />

      <View className="remind-header">
        <Text className="remind-header-title">提醒文案</Text>
        <Text className="remind-header-desc">可以直接复制发给租客</Text>
      </View>

      <View className="reminder-box">
        <Text className="reminder-text">{reminderText}</Text>
      </View>

      <View className="remind-actions">
        <View className="remind-btn primary" onClick={handleSendPayment}>
          <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="none">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          <Text className="remind-btn-text">发给租客付款</Text>
        </View>

        <View className="remind-btn secondary" onClick={handleCopyText}>
          <svg width="18" height="18" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth="1.8" fill="none">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <Text className="remind-btn-text secondary">复制文字</Text>
        </View>

        <View className="remind-btn ghost" onClick={handleMarkReminded}>
          <Text className="remind-btn-text ghost">{submitting ? '操作中...' : '标记已提醒'}</Text>
        </View>
      </View>

    </View>
  );
}
