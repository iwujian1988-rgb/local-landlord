import { View, Text, Input, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import EmptyState from '../../components/EmptyState';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import Icon from '../../components/Icon';
import { get, post, put, del } from '../../services/request';
import { uploadFile } from '../../services/upload';
import { useState, useCallback } from 'react';
import './index.scss';

interface QRItem {
  id?: string;
  type: 'wechat' | 'alipay' | 'bank';
  label: string;
  imageUrl?: string;
  isDefault: boolean;
}

const DEFAULT_CODES: QRItem[] = [
  { type: 'wechat', label: '微信支付', isDefault: false },
  { type: 'alipay', label: '支付宝', isDefault: false },
  { type: 'bank', label: '银行卡', isDefault: false },
];

export default function QrCode() {
  const [codes, setCodes] = useState<QRItem[]>([]);
  const [payeeName, setPayeeName] = useState('');
  const [payeeNote, setPayeeNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
    const res = await get<any>('/payment-qr');
    const data = res.data || {};
    // Merge API data with default templates
    const apiCodes = data.codes || [];
    const merged = DEFAULT_CODES.map((def) => {
      const apiCode = (apiCodes || []).find((c: any) => c.type === def.type);
      if (apiCode) {
        return {
          ...def,
          id: apiCode.id || apiCode._id,
          imageUrl: apiCode.imageUrl || apiCode.wechatQr || apiCode.alipayQr,
          isDefault: apiCode.isDefault || false,
        };
      }
      return { ...def };
    });
    setCodes(merged);
    setPayeeName(data.payeeName || '');
    setPayeeNote(data.payeeNote || '');
    } catch (err) {
      console.error('[QrCode] 加载数据失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '我的收款码' });
    loadData();
  });

  const handleUpload = useCallback((type: string) => {
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = res.tempFilePaths[0];
        uploadFile(filePath)
          .then((result) => {
            setCodes((prev) =>
              prev.map((c) => (c.type === type ? { ...c, imageUrl: result.url } : c))
            );
            Taro.showToast({ title: '收款码已上传', icon: 'none', duration: 2000 });
          })
          .catch(() => {
            Taro.showToast({ title: '上传失败了，再试一次', icon: 'none' });
          });
      },
      fail: () => {
        Taro.showToast({ title: '没选上图片，再试一次', icon: 'none' });
      },
    });
  }, []);

  const handleDelete = useCallback(async (type: string, id?: string) => {
    if (id) {
      await del(`/payment-qr/${id}`);
    }
    setCodes((prev) =>
      prev.map((c) => (c.type === type ? { ...c, imageUrl: undefined, id: undefined, isDefault: false } : c))
    );
    Taro.showToast({ title: '已删除', icon: 'none', duration: 2000 });
  }, []);

  const handleSetDefault = useCallback(async (item: QRItem) => {
    if (item.id) {
      await put(`/payment-qr/${item.id}/set-default`);
    }
    setCodes((prev) =>
      prev.map((c) => ({ ...c, isDefault: c.type === item.type }))
    );
    Taro.showToast({ title: '已设为默认', icon: 'none', duration: 2000 });
  }, []);

  const handleSave = useCallback(async () => {
    const currentCodes = codes.filter(c => c.imageUrl);
    for (const code of currentCodes) {
      if (code.id) {
        await put(`/payment-qr/${code.id}`, {
          type: code.type,
          label: code.label,
          imageUrl: code.imageUrl,
          isDefault: code.isDefault,
          payeeName,
          payeeNote,
        });
      } else {
        await post('/payment-qr', {
          type: code.type,
          label: code.label,
          imageUrl: code.imageUrl,
          isDefault: code.isDefault,
          payeeName,
          payeeNote,
        });
      }
    }
    Taro.showToast({ title: '设置已保存', icon: 'none', duration: 2000 });
    setTimeout(() => {
      Taro.navigateBack();
    }, 800);
  }, [codes, payeeName, payeeNote]);

  const handlePreview = useCallback(() => {
    Taro.navigateTo({ url: '/pages/payment/index' });
  }, []);

  const hasCodes = codes.some(c => c.imageUrl);

  return (
    <View className="page-qr-code">
      <ScrollView className="qr-scroll" scrollY>
        {loading && <Loading />}
        {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
        {!loading && !error && (
          <>
        <View className="qr-hint">
          <Text className="qr-hint-text">
            上传您的微信、支付宝或银行收款码。租客扫码后，会按您的方式付款。本小程序不直接收钱。
          </Text>
        </View>

        {!hasCodes ? (
          <EmptyState title="还没有收款码" description="上传微信或支付宝收款码，方便租客付款给您" actionText="去添加收款码" onAction={() => handleUpload('wechat')} />
        ) : (
          <View className="qr-list">
            {codes.map((code) => (
              <View key={code.type} className="qr-card">
                <View className="qr-card-row">
                  <View className={`qr-card-icon-wrap ${code.type}`}>
                    {code.type === 'wechat' ? (
                      <Text style={{ fontSize: '28px', lineHeight: 1 }}>💬</Text>
                    ) : code.type === 'alipay' ? (
                      <Icon name="credit-card" size={28} color="currentColor" />
                    ) : (
                      <Icon name="credit-card" size={28} color="var(--orange)" />
                    )}
                  </View>
                  <View className="qr-card-info">
                    <Text className="qr-card-name">{code.label}</Text>
                    <Text className={`qr-card-status ${code.imageUrl ? 'uploaded' : ''}`}>
                      {code.imageUrl ? '已上传' : '未上传'}
                    </Text>
                  </View>
                  {code.isDefault && (
                    <View className="default-tag">
                      <Text className="default-tag-text">默认</Text>
                    </View>
                  )}
                </View>
                {code.imageUrl ? (
                  <View className="qr-preview-area">
                    <Image src={code.imageUrl} style={{ width: '100%', height: '200px', borderRadius: '16px', objectFit: 'cover' }} />
                  </View>
                ) : (
                  <View className="qr-upload-btn" onClick={() => handleUpload(code.type)}>
                    <Text className="qr-upload-btn-text">上传{code.label}</Text>
                  </View>
                )}
                {code.imageUrl && (
                  <View className="qr-card-actions">
                    {!code.isDefault && (
                      <View className="qr-card-action" onClick={() => handleSetDefault(code)}>
                        <Text className="qr-card-action-text">设为默认</Text>
                      </View>
                    )}
                    <View className="qr-card-action danger" onClick={() => handleDelete(code.type, code.id)}>
                      <Text className="qr-card-action-text danger">删除</Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        <View className="qr-form">
          <View className="qr-form-group">
            <Text className="qr-form-label">收款人姓名</Text>
            <Input
              className="qr-form-input"
              type="text"
              placeholder="输入收款人姓名"
              value={payeeName}
              onInput={(e) => setPayeeName(e.detail.value)}
            />
          </View>
          <View className="qr-form-group">
            <Text className="qr-form-label">收款说明（可选）</Text>
            <Input
              className="qr-form-input"
              type="text"
              placeholder="如：付款后请微信告诉我"
              value={payeeNote}
              onInput={(e) => setPayeeNote(e.detail.value)}
            />
          </View>
        </View>

        <View style={{ height: '100px' }} />
          </>
        )}
      </ScrollView>

      <View className="qr-bottom-actions">
        <View className="qr-action-btn secondary" onClick={handlePreview}>
          <Text className="qr-action-btn-text secondary-text">预览付款页</Text>
        </View>
        <View className="qr-action-btn primary" onClick={handleSave}>
          <Text className="qr-action-btn-text">保存</Text>
        </View>
      </View>

    </View>
  );
}
