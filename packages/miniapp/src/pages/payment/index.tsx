import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import Icon from '../../components/Icon';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const period = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}年${now.getMonth() + 1}月`;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // Fetch QR code settings
      const qrRes = await get<any>('/payment-qr');
      const qrData = qrRes.data || {};
      if (qrData.payeeName) setPayeeName(qrData.payeeName);
      const codes = qrData.codes || [];
      const defaultCode = codes.find((c: any) => c.isDefault) || codes[0];
      if (defaultCode?.imageUrl) setQrImageUrl(defaultCode.imageUrl);

      // Fetch room name if not provided via params
      if (roomNameParam) {
        setRoomName(roomNameParam);
      } else if (roomId > 0) {
        const roomRes = await get<any>(`/rooms/${roomId}`);
        if (roomRes.code === 0 && roomRes.data) {
          setRoomName(roomRes.data.name || '');
        }
      }

      // Build payment items
      if (feeType && paramAmount > 0) {
        setItems([{ name: feeType, amount: paramAmount }]);
        setTotalAmount(paramAmount);
      } else if (paramAmount > 0) {
        setItems([{ name: '房租及杂费', amount: paramAmount }]);
        setTotalAmount(paramAmount);
      } else {
        setItems([]);
        setTotalAmount(0);
      }
    } catch (err) {
      console.error('[Payment] 加载数据失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [roomId, paramAmount, feeType, note, roomNameParam]);

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '发给租客' });
    loadData();
  });

  // Save image — for WeChat mini-program, guide user to screenshot
  const handleSaveImage = useCallback(() => {
    Taro.showModal({
      title: '保存账单图片',
      content: '请用手机截屏保存此页面，然后发给租客。截屏包含金额和收款码。',
      showCancel: false,
      confirmText: '知道了',
    });
  }, []);

  // Share via WeChat
  const handleShare = useCallback(() => {
    // Copy bill text to clipboard as the simplest sharing method
    const itemsText = items.map(i => `${i.name} ${i.amount}元`).join('，');
    const text = `${roomName} ${period}账单\n${itemsText}\n合计 ${totalAmount.toLocaleString()} 元\n${payeeName ? `收款人：${payeeName}\n` : ''}付款后请告诉房东，方便核对。`;

    Taro.setClipboardData({
      data: text,
      success: () => Taro.showToast({ title: '账单文字已复制，粘贴发给租客即可', icon: 'none', duration: 2500 }),
    });
  }, [roomName, period, items, totalAmount, payeeName]);

  const headerLabel = feeType
    ? `单独收款 · ${feeType}`
    : `${roomName || '101 房'} · ${period}账单`;

  return (
    <View className="page-payment">
      <ScrollView className="payment-scroll" scrollY>
        {loading && <Loading />}
        {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
        {!loading && !error && (
          <>
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
              <Icon name="smartphone" size={28} color="var(--text-hint)" />
              <Text className="payment-qr-placeholder-text">收款二维码</Text>
              <Text className="payment-qr-placeholder-hint" onClick={() => Taro.navigateTo({ url: '/pages/qr-code/index' })}>
                去设置收款码
              </Text>
            </View>
          )}
          {payeeName && <Text className="payment-payee">收款人：{payeeName}</Text>}
          <Text className="payment-payee-hint">付款后请告诉房东，方便核对</Text>
        </View>

        {/* Action Buttons */}
        <View className="payment-actions">
          <View className="payment-btn secondary" onClick={handleSaveImage}>
            <Text style={{ fontSize: '28px', lineHeight: 1, color: 'var(--accent)' }}>🖼</Text>
            <Text className="payment-btn-text secondary">保存图片</Text>
          </View>
          <View className="payment-btn primary" onClick={handleShare}>
            <Icon name="send" size={28} color="currentColor" />
            <Text className="payment-btn-text">复制账单</Text>
          </View>
        </View>

        <View style={{ height: 60 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
