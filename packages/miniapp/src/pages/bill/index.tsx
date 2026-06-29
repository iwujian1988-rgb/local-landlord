import { View, Text, ScrollView, Image, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import ConfirmModal from '../../components/ConfirmModal';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import Icon from '../../components/Icon';
import { useState, useCallback, useMemo } from 'react';
import { get, post, put } from '../../services/request';
import { uploadFiles } from '../../services/upload';
import { requestNotification } from '../../services/notification';
import { pickImages } from '../../utils/pick-image';
import { resolveAsset } from '../../config';
import { forwardBillShare } from '../../services/share';
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
  billId: number | null;
  billStatus: number;
  paidAmount: number;
  period: string;
  periodEnd: string | null;
  billItems: BillItem[];
}

interface PageData {
  roomName: string;
  tenantName: string;
  billId: number | null;
  billStatus: number;
  paidAmount: number;
  period: string;
  periodEnd: string | null;
  billItems: BillItem[];
  photos: string[];
  loading: boolean;
  error: boolean;
  uploading: boolean;
  submitting: boolean;
  confirmVisible: boolean;
}

const emptyPageData: PageData = {
  roomName: '',
  tenantName: '-',
  billId: null,
  billStatus: 0,
  paidAmount: 0,
  period: '',
  periodEnd: null,
  billItems: [],
  photos: [],
  loading: false,
  error: false,
  uploading: false,
  submitting: false,
  confirmVisible: false,
};

function formatPeriodRange(period: string, periodEnd: string | null): string {
  if (!period) return '';
  if (!periodEnd || periodEnd === period) return period;
  return `${period} ~ ${periodEnd}`;
}

export default function Bill() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const roomId = Number(routerParams.roomId) || 0;
  const tenantId = Number(routerParams.tenantId) || 0;

  const [data, setData] = useState<PageData>(emptyPageData);

  const loadData = useCallback(async () => {
    if (!roomId) return;
    setData(prev => ({ ...prev, loading: true, error: false }));
    try {
      const res = await get<ApiBillData>(`/rooms/${roomId}/bills`);
      if (res.code === 0 && res.data) {
        const tName = res.data.tenantName || '-';
        setData(prev => ({
          ...prev,
          roomName: res.data.roomName || '',
          tenantName: tName,
          billId: res.data.billId ?? null,
          billStatus: res.data.billStatus ?? 0,
          paidAmount: Number(res.data.paidAmount || 0),
          period: res.data.period || '',
          periodEnd: res.data.periodEnd || null,
          billItems: res.data.billItems || [],
        }));
        Taro.setNavigationBarTitle({ title: `通知${tName}交租` });
      }
    } catch (err) {
      console.error('[Bill] 加载数据失败:', err);
      setData(prev => ({ ...prev, error: true }));
    } finally {
      setData(prev => ({ ...prev, loading: false }));
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
    () => data.billItems.reduce((s, i) => s + (Number(i.amount) || 0), 0),
    [data.billItems]
  );

  const handleAmountChange = useCallback((idx: number, val: string) => {
    const num = Number(val) || 0;
    if (num < 0) return;
    if (num > 999999) return;
    setData(prev => {
      const next = [...prev.billItems];
      next[idx] = { ...next[idx], amount: num };
      return { ...prev, billItems: next };
    });
  }, []);

  const handlePhotoUpload = useCallback(async () => {
    if (data.uploading) return;
    const picked = await pickImages({ count: 3, sourceType: ['camera', 'album'] });
    if (picked.length === 0) return;
    setData(prev => ({ ...prev, uploading: true }));
    uploadFiles(picked.map(p => p.path))
      .then((results) => {
        setData(prev => ({ ...prev, photos: [...prev.photos, ...results.map(r => r.url).filter(Boolean)] }));
        Taro.showToast({ title: '账单照片已上传', icon: 'none', duration: 2000 });
      })
      .catch(() => {
        Taro.showToast({ title: '照片上传失败，请重试', icon: 'none', duration: 2000 });
      })
      .finally(() => {
        setData(prev => ({ ...prev, uploading: false }));
      });
  }, [data.uploading]);

  const handleSendBill = useCallback(async () => {
    if (data.submitting) return;
    setData(prev => ({ ...prev, submitting: true }));
    try {
      let billId = data.billId;

      if (billId) {
        // Bill already exists (cron pre-generated) — update items + mark sent
        await put(`/bills/${billId}/send`, { items: data.billItems });
      } else {
        // Fallback: cron hasn't generated for this cycle yet — create on demand
        const res = await post<{ id: number }>(`/rooms/${roomId}/bills`, {
          period: data.period,
          tenantId,
          items: data.billItems,
          totalAmount,
          photos: data.photos,
        });
        billId = res.data?.id || 0;

        // If POST didn't return an id (e.g. bill already exists), look up via pending
        if (!billId) {
          const pendingRes = await get<any>('/rent/pending');
          const allEntries = [
            ...(pendingRes.data?.today || []),
            ...(pendingRes.data?.approaching || []),
            ...(pendingRes.data?.overdue || []),
            ...(pendingRes.data?.upcoming || []),
          ];
          const match = allEntries.find((e: any) => e.roomId === roomId);
          billId = match?.billId || 0;
        }
      }

      if (!billId) {
        Taro.showToast({ title: '生成账单失败', icon: 'none' });
        return;
      }
      // Persist newly-created billId so a second tap doesn't re-POST and hit
      // "该周期已存在账单".
      if (!data.billId) {
        setData(prev => ({ ...prev, billId }));
      }
      await forwardBillShare(billId);
    } catch (err) {
      console.error('[Bill] 发送账单失败:', err);
      Taro.showToast({ title: '生成账单失败，请重试', icon: 'none' });
    } finally {
      setData(prev => ({ ...prev, submitting: false }));
    }
  }, [roomId, tenantId, data.billId, data.period, data.billItems, data.photos, totalAmount, data.submitting]);

  const handleCopyText = useCallback(() => {
    const month = new Date().getMonth() + 1;
    const itemsText = data.billItems.map(i => `${i.name} ${i.amount} 元`).join('，');
    const text = `${data.tenantName}您好，${data.roomName} ${month}月账单已出。\n${itemsText}。\n本月合计 ${totalAmount} 元。\n方便时请扫码付款，谢谢您。`;
    Taro.setClipboardData({
      data: text,
      success: () => Taro.showToast({ title: '文字已复制，可以发给租客了', icon: 'none', duration: 2000 }),
      fail: () => Taro.showToast({ title: '复制失败，请长按文字后手动复制', icon: 'none', duration: 3000 }),
    });
  }, [data.billItems, data.tenantName, data.roomName, totalAmount]);

  const handleConfirmPaid = useCallback(async (actualAmount?: number) => {
    // requestSubscribeMessage MUST run inside the user TAP gesture's sync call
    // stack. Any await/setTimeout before it breaks the chain and triggers
    // "can only be invoked by user TAP gesture" error. Call it FIRST.
    requestNotification();
    if (data.submitting) return;
    setData(prev => ({ ...prev, submitting: true, confirmVisible: false }));
    try {
      // Prefer the already-loaded billId (cron pre-generated). Fall back to pending lookup.
      let billId = data.billId || 0;

      if (!billId) {
        const pendingRes = await get<any>('/rent/pending');
        const allEntries = [
          ...(pendingRes.data?.today || []),
          ...(pendingRes.data?.approaching || []),
          ...(pendingRes.data?.overdue || []),
          ...(pendingRes.data?.upcoming || []),
        ];
        const match = allEntries.find((e: any) => e.roomId === roomId);
        billId = match?.billId || 0;
      }

      // Last resort: create on demand
      if (!billId) {
        const createRes = await post<{ id: number }>(`/rooms/${roomId}/bills`, {
          period: data.period,
          tenantId,
          items: data.billItems,
          totalAmount,
          photos: data.photos,
        });
        billId = createRes.data?.id || 0;
      }

      if (!billId) {
        throw new Error('未找到账单');
      }

      await put(`/bills/${billId}/confirm`, { actualAmount });
      const remaining = Math.max(totalAmount - (data.paidAmount || 0), 0);
      const isPartial = actualAmount != null && actualAmount < remaining;
      Taro.showToast({
        title: isPartial ? '已记录部分付款' : '已标记为已收',
        icon: 'none',
        duration: 2000,
      });
    } catch (err) {
      console.error('[Bill] 标记已收失败:', err);
      Taro.showToast({ title: '操作失败', icon: 'none' });
    } finally {
      setData(prev => ({ ...prev, submitting: false }));
    }
  }, [roomId, tenantId, data.billId, data.period, data.billItems, totalAmount, data.photos, data.submitting]);

  return (
    <View className="page-bill">
      <ScrollView className="bill-scroll" scrollY>
        {data.loading && <Loading />}
        {data.error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
        {!data.loading && !data.error && (
          <>
            {data.periodEnd && data.periodEnd !== data.period && (
              <View className="bill-cycle-banner">
                <Text className="bill-cycle-text">
                  本次收款周期：{formatPeriodRange(data.period, data.periodEnd)}（共 {data.billItems.reduce((s, i) => s + (i.type === 'fixed' ? 1 : 0), 0) > 0 ? '含多月房租' : ''}）
                </Text>
              </View>
            )}
            <View className="elder-card">
              <Text className="elder-card-title">第一步：算一下这个月多少钱</Text>
              <Text className="elder-card-desc">房租已经填好了，水电有变动就改一下。</Text>

              <View className="bill-items">
                {data.billItems.map((item, idx) => (
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

            <View className="elder-card">
              <Text className="elder-card-title">第二步：拍几张表的照片</Text>
              <Text className="elder-card-desc">比如电表、水表。没有也可以不拍。</Text>

              <View className="bill-photo-btn" onClick={handlePhotoUpload}>
                <Icon name="camera" size={48} color="currentColor" />
                <Text className="bill-photo-btn-text">{data.uploading ? '上传中...' : '拍照 / 上传照片'}</Text>
              </View>

              {data.photos.length > 0 && (
                <View className="bill-photo-grid">
                  {data.photos.map((src, idx) => (
                    <View key={idx} className="bill-photo-card">
                      <Image className="bill-photo-img" src={resolveAsset(src)} mode="aspectFill" />
                      <Text className="bill-photo-tag">账单照片</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View className="elder-card">
              <Text className="elder-card-title">第三步：发给租客</Text>
              <Text className="elder-card-desc">发完以后，收到钱再点&ldquo;已收到&rdquo;。</Text>

              <View className="bill-action-btn primary" onClick={handleSendBill}>
                <Text className="bill-action-text">发微信给租客</Text>
              </View>

              <View className="bill-action-btn secondary" onClick={handleCopyText}>
                <Text className="bill-action-text secondary">复制文字</Text>
              </View>

              <View className={`bill-action-btn paid-btn${data.submitting ? ' disabled' : ''}`} onClick={data.submitting ? undefined : () => setData(prev => ({ ...prev, confirmVisible: true }))}>
                <Text className="bill-action-text paid">{data.submitting ? '处理中...' : '我已收到钱'}</Text>
              </View>
            </View>

            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>

      <ConfirmModal
        visible={data.confirmVisible}
        title="确认已收款"
        amount={totalAmount}
        paidAmount={data.paidAmount}
        editableAmount
        confirmText="确认已收"
        onConfirm={handleConfirmPaid}
        onCancel={() => setData(prev => ({ ...prev, confirmVisible: false }))}
      />
    </View>
  );
}
