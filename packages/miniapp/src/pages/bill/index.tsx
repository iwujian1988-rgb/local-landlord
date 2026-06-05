import { View, Text, ScrollView, Image, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import ConfirmModal from '../../components/ConfirmModal';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import { useState, useCallback, useMemo } from 'react';
import { get, post } from '../../services/request';
import { API_BASE } from '../../config';
import './index.scss';

interface BillItem {
  name: string;
  amount: number;
  type: 'fixed' | 'manual';
  feeId?: number;
}

interface ApiBillData {
  roomName: string;
  tenantName: string;
  billItems: BillItem[];
}

export default function Bill() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const roomId = Number(routerParams.roomId) || 0;
  const tenantId = Number(routerParams.tenantId) || 0;

  const [roomName, setRoomName] = useState('');
  const [tenantName, setTenantName] = useState('-');
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await get<ApiBillData>(`/rooms/${roomId}/bills`);
      if (res.code === 0 && res.data) {
        setRoomName(res.data.roomName || '');
        setTenantName(res.data.tenantName || '-');
        setBillItems(res.data.billItems || []);
      }
    } catch (err) {
      console.error('[Bill] 加载数据失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useDidShow(() => {
    if (roomId === 0) {
      Taro.showToast({ title: '页面打开失败，请返回重试', icon: 'none', duration: 1500 });
      setTimeout(() => Taro.navigateBack(), 1500);
      return;
    }
    loadData();
  });

  const totalAmount = useMemo(
    () => billItems.reduce((s, i) => s + (Number(i.amount) || 0), 0),
    [billItems]
  );

  const goBack = useCallback(() => { Taro.navigateBack(); }, []);

  const handleAmountChange = useCallback((idx: number, val: string) => {
    setBillItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], amount: Number(val) || 0 };
      return next;
    });
  }, []);

  const handlePhotoUpload = useCallback(() => {
    if (uploading) return;
    Taro.chooseImage({
      count: 3,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        setUploading(true);
        const tempPaths = res.tempFilePaths;
        // Upload each file to server
        Promise.all(
          tempPaths.map((filePath) =>
            new Promise<string>((resolve, reject) => {
              Taro.uploadFile({
                url: `${API_BASE}/upload`,
                filePath,
                name: 'file',
                header: { Authorization: `Bearer ${Taro.getStorageSync('auth_token') || ''}` },
                success: (uploadRes) => {
                  try {
                    const data = JSON.parse(uploadRes.data);
                    const url = data.data?.url || data.data?.fileID || data.url || '';
                    resolve(url);
                  } catch {
                    reject(new Error('解析上传结果失败'));
                  }
                },
                fail: () => reject(new Error('上传失败')),
              });
            })
          )
        )
          .then((urls) => {
            setPhotos(prev => [...prev, ...urls.filter(Boolean)]);
            Taro.showToast({ title: '账单照片已上传', icon: 'none', duration: 2000 });
          })
          .catch(() => {
            Taro.showToast({ title: '照片上传失败，请重试', icon: 'none', duration: 2000 });
          })
          .finally(() => {
            setUploading(false);
          });
      },
    });
  }, [uploading]);

  const handleSendBill = useCallback(() => {
    Taro.navigateTo({
      url: `/pages/payment/index?roomId=${roomId}&amount=${totalAmount}&billId=${Date.now()}`
    });
  }, [roomId, totalAmount]);

  const handleCopyText = useCallback(() => {
    const month = new Date().getMonth() + 1;
    const itemsText = billItems.map(i => `${i.name} ${i.amount} 元`).join('，');
    const text = `${tenantName}您好，${roomName} ${month}月账单已出。\n${itemsText}。\n本月合计 ${totalAmount} 元。\n方便时请扫码付款，谢谢您。`;
    Taro.setClipboardData({
      data: text,
      success: () => Taro.showToast({ title: '文字已复制，可以发给租客了', icon: 'none', duration: 2000 }),
      fail: () => Taro.showToast({ title: '复制失败，请长按文字后手动复制', icon: 'none', duration: 3000 }),
    });
  }, [billItems, tenantName, roomName, totalAmount]);

  const handleConfirmPaid = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setConfirmVisible(false);
    try {
      await post(`/rooms/${roomId}/bills`, {
        tenantId,
        items: billItems,
        totalAmount,
        photos,
      });
      Taro.showToast({ title: '已标记为已收', icon: 'none', duration: 2000 });
    } catch (err) {
      console.error('[Bill] 标记已收失败:', err);
      Taro.showToast({ title: '操作失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [roomId, tenantId, billItems, totalAmount, photos, submitting]);

  return (
    <View className="page-bill">
      <NavBar title={`通知${tenantName}交租`} onBack={goBack} />

      <ScrollView className="bill-scroll" scrollY>
        {loading && <Loading />}
        {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
        {!loading && !error && (
          <>
            {/* Step 1: Calculate */}
            <View className="elder-card">
              <Text className="elder-card-title">第一步：算一下这个月多少钱</Text>
              <Text className="elder-card-desc">房租已经填好了，水电有变动就改一下。</Text>

              <View className="bill-items">
                {billItems.map((item, idx) => (
                  <View key={idx}>
                    {item.type === 'manual' ? (
                      <View className="form-group bill-input-group">
                        <Text className="form-label">{item.name}</Text>
                        <View className="input-with-suffix">
                          <Input
                            className="form-input bill-number-input"
                            type="digit"
                            value={String(item.amount)}
                            onInput={(e: any) => handleAmountChange(idx, e.detail.value)}
                            placeholder="0"
                          />
                          <Text className="input-suffix">元</Text>
                        </View>
                      </View>
                    ) : (
                      <View className="bill-row">
                        <Text className="bill-label">{item.name}</Text>
                        <Text className="bill-value">{item.amount.toLocaleString()} 元</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>

              <View className="bill-divider" />
              <View className="bill-total">
                <Text className="bill-total-label">合计</Text>
                <Text className="bill-total-value">{totalAmount.toLocaleString()} 元</Text>
              </View>
            </View>

            {/* Step 2: Photo */}
            <View className="elder-card">
              <Text className="elder-card-title">第二步：拍一张表照片</Text>
              <Text className="elder-card-desc">比如电表、水表。没有也可以不拍。</Text>

              <View className="bill-photo-btn" onClick={handlePhotoUpload}>
                <svg width="28" height="28" viewBox="0 0 24 24" stroke="var(--accent-dk)" strokeWidth="1.8" fill="none">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <Text className="bill-photo-btn-text">{uploading ? '上传中...' : '拍照 / 上传照片'}</Text>
              </View>

              {photos.length > 0 && (
                <View className="bill-photo-grid">
                  {photos.map((src, idx) => (
                    <View key={idx} className="bill-photo-card">
                      <Image className="bill-photo-img" src={src} mode="aspectFill" />
                      <Text className="bill-photo-tag">账单照片</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Step 3: Send */}
            <View className="elder-card">
              <Text className="elder-card-title">第三步：发给租客</Text>
              <Text className="elder-card-desc">发完以后，收到钱再点&ldquo;已收到&rdquo;。</Text>

              <View className="bill-action-btn primary" onClick={handleSendBill}>
                <Text className="bill-action-text">发微信给租客</Text>
              </View>

              <View className="bill-action-btn secondary" onClick={handleCopyText}>
                <Text className="bill-action-text secondary">复制文字</Text>
              </View>

              <View className={`bill-action-btn paid-btn${submitting ? ' disabled' : ''}`} onClick={submitting ? undefined : () => setConfirmVisible(true)}>
                <Text className="bill-action-text paid">{submitting ? '处理中...' : '我已收到钱'}</Text>
              </View>
            </View>

            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>

      <ConfirmModal
        visible={confirmVisible}
        title="确认已收款"
        amount={totalAmount}
        confirmText="确认已收"
        onConfirm={handleConfirmPaid}
        onCancel={() => setConfirmVisible(false)}
      />
    </View>
  );
}
