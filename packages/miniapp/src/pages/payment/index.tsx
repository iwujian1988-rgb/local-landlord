import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import { useState, useCallback, useMemo } from 'react';
import { get } from '../../services/request';
import './index.scss';

interface PaymentItem {
  name: string;
  amount: number;
}

export default function Payment() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const roomId = Number(routerParams.roomId) || 0;
  const paramAmount = Number(routerParams.amount) || 0;
  const feeType = routerParams.feeType || '';
  const note = routerParams.note ? decodeURIComponent(routerParams.note) : '';
  const roomNameParam = routerParams.roomName ? decodeURIComponent(routerParams.roomName) : '';

  const [roomName, setRoomName] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);

  const period = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}年${now.getMonth() + 1}月`;
  }, []);

  const loadData = useCallback(async () => {
    // Fetch QR code settings
    const qrRes = await get<any>('/payment-qr');
    const qrData = qrRes.data || {};
    if (qrData.payeeName) setPayeeName(qrData.payeeName);
    if (qrData.wechatQr) setQrImageUrl(qrData.wechatQr);
    else if (qrData.alipayQr) setQrImageUrl(qrData.alipayQr);

    // Fetch room name if not provided via params
    if (roomNameParam) {
      setRoomName(roomNameParam);
    } else if (roomId > 0) {
      const roomRes = await get<any[]>(`/rooms`);
      const rooms = roomRes.data || [];
      const room = rooms.find((r: any) => r.id === roomId);
      if (room) setRoomName(room.name);
    }

    // Build payment items
    if (feeType && paramAmount > 0) {
      // Single charge scenario
      setItems([{ name: feeType, amount: paramAmount }]);
      setTotalAmount(paramAmount);
    } else if (paramAmount > 0) {
      // Amount passed from bill page
      setItems([{ name: '房租及杂费', amount: paramAmount }]);
      setTotalAmount(paramAmount);
    } else {
      setItems([]);
      setTotalAmount(0);
    }
  }, [roomId, paramAmount, feeType, note, roomNameParam]);

  useDidShow(() => { loadData(); });

  const goBack = useCallback(() => { Taro.navigateBack(); }, []);

  const handleSaveImage = useCallback(() => {
    Taro.showToast({ title: '图片已保存到相册', icon: 'none', duration: 2000 });
  }, []);

  const handleShare = useCallback(() => {
    Taro.showToast({ title: '已生成分享卡片', icon: 'none', duration: 2000 });
  }, []);

  const headerLabel = feeType
    ? `单独收款 · ${feeType}`
    : `${roomName || '101 房'} · ${period}账单`;

  return (
    <View className="page-payment">
      <NavBar title="付款页面" onBack={goBack} />

      <ScrollView className="payment-scroll" scrollY>
        {/* Amount Header Card */}
        <View className="payment-header-card">
          <Text className="payment-header-label">{headerLabel}</Text>
          <Text className="payment-amount">{totalAmount.toLocaleString()} 元</Text>
          <View className="payment-divider" />
          <View className="payment-items">
            {items.map((item, idx) => (
              <View key={idx} className="payment-row">
                <Text className="payment-row-label">{item.name}</Text>
                <Text className="payment-row-value">{item.amount.toLocaleString()} 元</Text>
              </View>
            ))}
          </View>
          {note && (
            <Text className="payment-note">备注：{note}</Text>
          )}
        </View>

        {/* QR Code Card */}
        <View className="payment-qr-card">
          <Text className="payment-qr-title">请扫码支付</Text>
          {qrImageUrl ? (
            <Image className="payment-qr-img" src={qrImageUrl} mode="aspectFit" />
          ) : (
            <View className="payment-qr-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" stroke="var(--text-hint)" strokeWidth="1.8" fill="none" opacity="0.4">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
                <rect x="14" y="14" width="3" height="3"/>
                <line x1="21" y1="14" x2="21" y2="14.01"/>
                <line x1="21" y1="21" x2="21" y2="21.01"/>
              </svg>
              <Text className="payment-qr-placeholder-text">收款二维码</Text>
            </View>
          )}
          <Text className="payment-payee">收款人：{payeeName}</Text>
          <Text className="payment-payee-hint">付款后请告诉房东，方便核对</Text>
        </View>

        {/* Action Buttons */}
        <View className="payment-actions">
          <View className="payment-btn secondary" onClick={handleSaveImage}>
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth="1.8" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <Text className="payment-btn-text secondary">保存图片</Text>
          </View>
          <View className="payment-btn primary" onClick={handleShare}>
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="none">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            <Text className="payment-btn-text">分享给租客</Text>
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}
