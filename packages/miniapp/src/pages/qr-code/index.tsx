import { View, Text, Input, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import EmptyState from '../../components/EmptyState';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import { get, post, put, del } from '../../services/request';
import { API_BASE } from '../../config';
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

  useDidShow(() => { loadData(); });

  const goBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  const handleUpload = useCallback((type: string) => {
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = res.tempFilePaths[0];
        Taro.uploadFile({
          url: `${API_BASE}/upload`,
          filePath,
          name: 'file',
          header: { Authorization: `Bearer ${Taro.getStorageSync('auth_token') || ''}` },
          success: (uploadRes) => {
            const data = JSON.parse(uploadRes.data);
            const uploadedUrl = data.data?.url || data.data?.fileID || data.url || '';
            setCodes((prev) =>
              prev.map((c) => (c.type === type ? { ...c, imageUrl: uploadedUrl } : c))
            );
            Taro.showToast({ title: '收款码已上传', icon: 'none', duration: 2000 });
          },
          fail: () => {
            Taro.showToast({ title: '上传失败了，再试一次', icon: 'none' });
          },
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
      <NavBar title="我的收款码" onBack={goBack} />

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
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.434-.982.97-.982z" fill="#6a9b7d"/>
                        <path d="M16.938 8.858c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.046c.133 0 .241-.11.241-.245 0-.06-.023-.118-.039-.174l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.062-6.122zM14.033 13.3c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z" fill="#6a9b7d"/>
                      </svg>
                    ) : code.type === 'alipay' ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#7ba3b8">
                        <rect x="2" y="2" width="20" height="20" rx="4"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" stroke="var(--orange)" strokeWidth="1.8" fill="none">
                        <rect x="2" y="3" width="20" height="18" rx="2"/>
                        <line x1="2" y1="9" x2="22" y2="9"/>
                      </svg>
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
