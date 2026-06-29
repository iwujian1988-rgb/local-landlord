import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import Icon from '../../components/Icon';
import { useState, useCallback, useMemo } from 'react';
import { get } from '../../services/request';
import { generateAndCopyShareLink, forwardSingleChargeShare } from '../../services/share';
import { resolveAsset } from '../../config';
import './index.scss';

interface PaymentItem {
  name: string;
  amount: number;
}

export default function Payment() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const roomId = Number(routerParams.roomId) || 0;
  const paramAmount = Number(routerParams.amount) || 0;
  const billId = Number(routerParams.billId) || 0;
  const singleChargeId = Number(routerParams.singleChargeId) || 0;
  const feeType = routerParams.feeType || '';
  const note = routerParams.note ? decodeURIComponent(routerParams.note) : '';
  const roomNameParam = routerParams.roomName ? decodeURIComponent(routerParams.roomName) : '';

  // items encoded as JSON in query string (from bill page)
  const queryItems = useMemo<PaymentItem[]>(() => {
    const raw = routerParams.items ? decodeURIComponent(routerParams.items) : '';
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((x: any) => x && typeof x.name === 'string' && typeof x.amount === 'number')
          .map((x: any) => ({ name: x.name, amount: x.amount }));
      }
    } catch (e) {
      // ignore malformed
    }
    return [];
  }, [routerParams.items]);

  const [roomName, setRoomName] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [qrCodes, setQrCodes] = useState<{ type: string; imageUrl: string; payeeName: string; isDefault: boolean }[]>([]);
  const [activeCodeIdx, setActiveCodeIdx] = useState(0);
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [savingQr, setSavingQr] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const resolvedQrImageUrl = useMemo(() => resolveAsset(qrImageUrl), [qrImageUrl]);

  const period = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}年${now.getMonth() + 1}月`;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const qrRes = await get<any>('/payment-qr');
      const qrData = qrRes.data || {};
      if (qrData.payeeName) setPayeeName(qrData.payeeName);
      const codes: any[] = qrData.codes || [];
      const validCodes = codes.filter((c) => c?.imageUrl);
      setQrCodes(validCodes);
      const defaultCode = validCodes.find((c) => c.isDefault) || validCodes[0];
      if (defaultCode?.imageUrl) setQrImageUrl(defaultCode.imageUrl);
      setActiveCodeIdx(validCodes.findIndex((c) => c === defaultCode));

      if (roomNameParam) {
        setRoomName(roomNameParam);
      } else if (roomId > 0) {
        const roomRes = await get<any>(`/rooms/${roomId}`);
        if (roomRes.code === 0 && roomRes.data) {
          setRoomName(roomRes.data.name || '');
        }
      }

      // Priority: explicit items from query string > feeType > fallback
      if (queryItems.length > 0) {
        setItems(queryItems);
        setTotalAmount(queryItems.reduce((s, i) => s + Number(i.amount || 0), 0));
      } else if (feeType && paramAmount > 0) {
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
  }, [roomId, paramAmount, feeType, note, roomNameParam, queryItems]);

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '发给租客' });
    loadData();
  });

  // Save QR code to album (real download via temp file)
  const handleSaveQr = useCallback(() => {
    if (!resolvedQrImageUrl || savingQr) return;
    setSavingQr(true);
    Taro.getImageInfo({
      src: resolvedQrImageUrl,
      success: (info) => {
        Taro.saveImageToPhotosAlbum({
          filePath: info.path,
          success: () => {
            Taro.showToast({ title: '收款码已保存到相册', icon: 'success', duration: 2000 });
          },
          fail: (err) => {
            if (err.errMsg?.includes('auth')) {
              Taro.showModal({
                title: '需要相册权限',
                content: '请在设置中允许保存到相册，方便把收款码发给租客',
                confirmText: '去设置',
                success: (r) => {
                  if (r.confirm) Taro.openSetting();
                },
              });
            } else {
              Taro.showToast({ title: '保存失败，请长按图片手动保存', icon: 'none', duration: 2500 });
            }
          },
        });
      },
      fail: () => {
        Taro.showToast({ title: '图片加载失败，可长按图片手动保存', icon: 'none', duration: 2500 });
      },
      complete: () => setSavingQr(false),
    });
  }, [resolvedQrImageUrl, savingQr]);

  // Copy bill text to clipboard
  const handleShare = useCallback(() => {
    const itemsText = items.map(i => `${i.name} ${i.amount}元`).join('，');
    const text = `${roomName} ${period}账单\n${itemsText}\n合计 ${totalAmount.toLocaleString()} 元\n${payeeName ? `收款人：${payeeName}\n` : ''}付款后请告诉房东，方便核对。`;

    Taro.setClipboardData({
      data: text,
      success: () => Taro.showToast({ title: '账单文字已复制，粘贴发给租客即可', icon: 'none', duration: 2500 }),
    });
  }, [roomName, period, items, totalAmount, payeeName]);

  // Generate H5 share link (with QR codes) and copy to clipboard
  const handleShareH5 = useCallback(async () => {
    if (shareLoading) return;
    if (!billId && !singleChargeId) {
      Taro.showToast({ title: '请先生成账单', icon: 'none' });
      return;
    }
    // single_charge uses its own modal copy via forwardSingleChargeShare
    if (singleChargeId && !billId) {
      setShareLoading(true);
      await forwardSingleChargeShare(singleChargeId);
      setShareLoading(false);
      return;
    }
    setShareLoading(true);
    const result = await generateAndCopyShareLink(billId);
    setShareLoading(false);
    if (result) {
      Taro.showModal({
        title: '账单链接已复制',
        content: '粘贴发给租客，租客在微信中打开后可看到账单明细和二维码，长按二维码即可付款',
        confirmText: '我知道了',
        showCancel: false,
      });
    }
  }, [shareLoading, billId, singleChargeId]);

  const headerLabel = feeType
    ? `单独收款 · ${feeType}`
    : `${roomName || '我的房间'} · ${period}账单`;

  return (
    <View className="page-payment">
      <ScrollView className="payment-scroll" scrollY>
        {loading && <Loading />}
        {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
        {!loading && !error && (
          <>
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

        <View className="payment-qr-card">
          <Text className="payment-qr-title">请扫码支付</Text>
          {qrImageUrl ? (
            <>
              <Image className="payment-qr-img" src={resolvedQrImageUrl} mode="aspectFit" showMenuByLongpress />
              <Text className="payment-qr-tip">长按收款码可保存或转发给租客</Text>
              {qrCodes.length > 1 && (
                <View className="payment-qr-chips">
                  {qrCodes.map((c, idx) => (
                    <View
                      key={idx}
                      className={`payment-qr-chip${idx === activeCodeIdx ? ' active' : ''}`}
                      onClick={() => {
                        setActiveCodeIdx(idx);
                        setQrImageUrl(c.imageUrl);
                      }}
                    >
                      <Text className="payment-qr-chip-text">
                        {c.type === 'wechat' ? '微信' : c.type === 'alipay' ? '支付宝' : c.type === 'bank' ? '银行卡' : '其他'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
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

        {(billId > 0 || singleChargeId > 0) && (
          <View className="payment-primary-cta">
            <View
              className={`payment-btn primary full${shareLoading ? ' loading' : ''}`}
              onClick={handleShareH5}
            >
              <Icon name="send" size={28} color="currentColor" />
              <Text className="payment-btn-text">{shareLoading ? '生成中...' : '发给租客付款'}</Text>
            </View>
          </View>
        )}

        <View className="payment-actions">
          {qrImageUrl && (
            <View className="payment-btn secondary" onClick={handleSaveQr}>
              <Text style={{ fontSize: '28px', lineHeight: 1, color: 'var(--accent)' }}>{savingQr ? '…' : '⬇'}</Text>
              <Text className="payment-btn-text secondary">{savingQr ? '保存中' : '保存收款码'}</Text>
            </View>
          )}
          <View className="payment-btn secondary" onClick={handleShare}>
            <Icon name="send" size={28} color="var(--accent)" />
            <Text className="payment-btn-text secondary">复制账单文字</Text>
          </View>
        </View>

        <View style={{ height: 60 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
