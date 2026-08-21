import { Button, Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro';
import { useCallback, useMemo, useState } from 'react';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import { resolveAsset } from '../../config';
import { get, post } from '../../services/request';
import {
  buildTenantBillCopyText,
  formatBillPeriod,
  isLandlordTenantBillPreview,
  normalizeTenantBill,
  TenantBillPayload,
} from '../../utils/tenant-bill';
import './index.scss';

const QR_LABEL: Record<string, string> = {
  wechat: '微信收款码',
  alipay: '支付宝收款码',
  bank: '银行卡收款码',
};

export default function TenantBill() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const token = params.token || '';
  const isLandlordPreview = isLandlordTenantBillPreview(params.source);
  const [data, setData] = useState<ReturnType<typeof normalizeTenantBill> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!token) {
      setError('账单参数缺失，请让房东重新发送');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await get<TenantBillPayload>(`/share/bill/${encodeURIComponent(token)}`);
      if (!res.data) throw new Error('账单内容为空');
      const normalized = normalizeTenantBill(res.data);
      setData(normalized);
      Taro.setNavigationBarTitle({
        title: isLandlordPreview ? '发送前预览' : `${normalized.roomName || '租客'}账单`,
      });
    } catch (err: any) {
      console.error('[TenantBill] 加载失败:', err);
      setError(err?.message || '账单加载失败，请让房东重新发送');
    } finally {
      setLoading(false);
    }
  }, [token, isLandlordPreview]);

  useDidShow(() => {
    if (isLandlordPreview) {
      Taro.showShareMenu({ withShareTicket: true });
    } else {
      Taro.hideShareMenu();
    }
    loadData();
  });

  const shareTitle = useMemo(() => {
    if (!data) return '五联人家租客账单';
    return `${data.roomName} · ${formatBillPeriod(data.period, data.periodEnd)}账单`;
  }, [data]);

  useShareAppMessage(() => {
    if (isLandlordPreview && token) {
      post('/share/mark-sent', { token }).catch((err) => {
        console.error('[TenantBill] 记录发送状态失败:', err);
      });
    }
    return {
      title: shareTitle,
      path: `/pages/tenant-bill/index?token=${encodeURIComponent(token)}`,
    };
  });

  const handleCopy = useCallback(() => {
    if (!data) return;
    Taro.setClipboardData({
      data: buildTenantBillCopyText(data),
      success: () => Taro.showToast({ title: '账单文字已复制', icon: 'none' }),
    });
  }, [data]);

  if (loading) return <View className="tenant-bill-page"><Loading text="正在核对账单..." /></View>;
  if (error || !data) {
    return <View className="tenant-bill-page"><ErrorState title="账单打不开" description={error} onRetry={loadData} /></View>;
  }

  const periodText = formatBillPeriod(data.period, data.periodEnd);

  return (
    <View className={`tenant-bill-page${isLandlordPreview ? ' landlord-preview' : ''}`}>
      <ScrollView className="tenant-bill-scroll" scrollY>
        {isLandlordPreview && (
          <View className="tenant-preview-intro">
            <View className="tenant-preview-badge"><Text>发送前预览</Text></View>
            <View className="tenant-preview-copy">
              <Text className="tenant-preview-title">租客将看到以下账单</Text>
              <Text className="tenant-preview-desc">核对金额和收款码，确认后点底部“微信发送”</Text>
            </View>
          </View>
        )}

        <View className="tenant-bill-hero">
          <View className="tenant-bill-heading">
            <Text className="tenant-bill-room">{data.roomName}</Text>
            <Text className="tenant-bill-period">{periodText}账单</Text>
          </View>
          {data.tenantName && <Text className="tenant-bill-tenant">租客：{data.tenantName}</Text>}
        </View>

        <View className={`tenant-amount-card${data.isPaid ? ' paid' : ''}`}>
          <Text className="tenant-amount-label">{data.isPaid ? '这笔账已付清' : data.paidAmount > 0 ? '还需支付' : '本次应付'}</Text>
          <View className="tenant-amount-line">
            <Text className="tenant-amount-number">{(data.isPaid ? data.totalAmount : data.outstandingAmount).toLocaleString()}</Text>
            <Text className="tenant-amount-unit">元</Text>
          </View>
          {data.paidAmount > 0 && !data.isPaid && (
            <Text className="tenant-paid-tip">账单共 {data.totalAmount.toLocaleString()} 元，已付 {data.paidAmount.toLocaleString()} 元</Text>
          )}
        </View>

        <View className="tenant-card">
          <Text className="tenant-card-title">费用明细</Text>
          {data.items.map((item, index) => (
            <View className="tenant-item-row" key={`${item.name}-${index}`}>
              <Text>{item.name}</Text>
              <Text>{item.amount.toLocaleString()} 元</Text>
            </View>
          ))}
          <View className="tenant-item-total">
            <Text>账单合计</Text>
            <Text>{data.totalAmount.toLocaleString()} 元</Text>
          </View>
        </View>

        {!data.isPaid && data.qrCodes.length > 0 && (
          <View className="tenant-card tenant-qr-section">
            <Text className="tenant-card-title">长按收款码付款</Text>
            <Text className="tenant-card-help">长按图片，选择“识别图中二维码”</Text>
            {data.qrCodes.map((code, index) => (
              <View className="tenant-qr-item" key={`${code.type}-${index}`}>
                <Text className="tenant-qr-label">{QR_LABEL[code.type] || '收款码'}</Text>
                <Image
                  className="tenant-qr-image"
                  src={resolveAsset(code.imageUrl)}
                  mode="aspectFit"
                  showMenuByLongpress
                />
                <Text className="tenant-qr-payee">收款人：{code.payeeName || data.payeeName || data.landlordName}</Text>
              </View>
            ))}
            <Text className="tenant-safe-tip">付款前请核对收款人，付款后告诉房东。</Text>
          </View>
        )}

        {!data.isPaid && data.qrCodes.length === 0 && (
          <View className="tenant-card tenant-empty-qr">
            <Text className="tenant-card-title">房东暂未设置收款码</Text>
            <Text>请联系房东确认付款方式</Text>
          </View>
        )}

        {data.paymentNote && (
          <View className="tenant-card tenant-note-card">
            <Text className="tenant-card-title">房东留言</Text>
            <Text className="tenant-note-text">{data.paymentNote}</Text>
          </View>
        )}

        <Text className="tenant-footer">账单由“五联人家”生成，请以实际付款记录为准</Text>
        <View className={`tenant-bottom-space${isLandlordPreview ? ' with-dock' : ''}`} />
      </ScrollView>

      {isLandlordPreview && (
        <View className="tenant-action-dock">
          <View className="tenant-copy-button" onClick={handleCopy}>
            <Text>复制文字</Text>
          </View>
          <Button className="tenant-share-button" openType="share">微信发送</Button>
        </View>
      )}
    </View>
  );
}
