import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import EmptyState from '../../components/EmptyState';
import UploadModal, { UploadFile } from '../../components/UploadModal';
import { get, post, del } from '../../services/request';
import { API_BASE } from '../../config';
import { useState, useCallback, useMemo } from 'react';
import './index.scss';

type FilterKey = 'all' | 'contract' | 'receipt' | 'deposit' | 'utility' | 'maintenance' | 'other';

const filters: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'contract', label: '合同' },
  { key: 'receipt', label: '收据' },
  { key: 'deposit', label: '押金' },
  { key: 'utility', label: '水电单' },
  { key: 'maintenance', label: '维修' },
  { key: 'other', label: '其他' },
];

interface DocumentItem {
  id: string;
  type: string;
  name: string;
  date: string;
  imageUrl?: string;
  roomId?: number;
}

const docThumbColors: Record<string, string> = {
  contract: '#e8e0d5',
  receipt: 'linear-gradient(135deg, #e8f5e0, #d0e8c0)',
  deposit: 'linear-gradient(135deg, #e8f5e0, #d0e8c0)',
  utility: 'linear-gradient(135deg, #e0e8f0, #c8d8e8)',
  maintenance: 'linear-gradient(135deg, #f5e8e8, #e8d0d0)',
  other: '#e8e0d5',
};

export default function Contracts() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const roomId = Number(routerParams.roomId) || 0;

  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [showUpload, setShowUpload] = useState(false);

  const loadData = useCallback(async () => {
    if (roomId === 0) {
      Taro.showToast({ title: '没有找到对应房间，请返回重新进入', icon: 'none', duration: 2000 });
      return;
    }
    const res = await get<any[]>(`/rooms/${roomId}/documents`);
    const documents = (res.data || []).map((d: any) => ({
      id: d.id || d._id,
      type: d.type || 'other',
      name: d.name || '未命名文件',
      date: d.date || d.createdAt || '',
      imageUrl: d.imageUrl || d.imageTempURL || d.fileUrl || '',
      roomId: d.roomId || roomId,
    }));
    setDocs(documents);
  }, [roomId]);

  useDidShow(() => { loadData(); });

  const goBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  const handleUpload = useCallback((file: UploadFile, note: string) => {
    Taro.uploadFile({
      url: `${API_BASE}/upload`,
      filePath: file.tempFilePath,
      name: 'file',
      header: { Authorization: `Bearer ${Taro.getStorageSync('auth_token') || ''}` },
      success: async (uploadRes) => {
        const data = JSON.parse(uploadRes.data);
        const uploadedUrl = data.data?.url || data.data?.fileID || data.url || '';
        const newDoc: DocumentItem = {
          id: Date.now().toString(),
          type: 'other',
          name: note || '新上传文件',
          date: new Date().toISOString().slice(0, 10),
          imageUrl: uploadedUrl,
          roomId: roomId > 0 ? roomId : undefined,
        };
        // Save via API
        await post(`/rooms/${roomId}/documents`, {
          type: 'other',
          name: note || '新上传文件',
          imageUrl: uploadedUrl,
          roomId: roomId > 0 ? roomId : undefined,
        });
        setDocs((prev) => [newDoc, ...prev]);
        setShowUpload(false);
        Taro.showToast({ title: '资料已上传', icon: 'none', duration: 2000 });
      },
      fail: () => {
        Taro.showToast({ title: '上传失败了，再试一次', icon: 'none' });
      },
    });
  }, [roomId]);

  const handleDelete = useCallback(async (docId: string) => {
    await del(`/rooms/${roomId}/documents/${docId}`);
    setDocs((prev) => prev.filter((d) => d.id !== docId));
    Taro.showToast({ title: '已删除', icon: 'none', duration: 2000 });
  }, [roomId]);

  const filteredDocs = useMemo(() => {
    let list = docs;
    if (roomId > 0) {
      list = list.filter((d) => d.roomId === roomId);
    }
    if (activeFilter === 'all') return list;
    return list.filter((d) => d.type === activeFilter);
  }, [docs, activeFilter, roomId]);

  return (
    <View className="page-contracts">
      <NavBar
        title="合同收据"
        onBack={goBack}
        rightActions={[{
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" stroke="var(--text-secondary)" strokeWidth="1.8" fill="none">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          ),
          onClick: () => setShowUpload(true),
        }]}
      />

      <ScrollView className="contracts-filter" scrollX>
        {filters.map((f) => (
          <View
            key={f.key}
            className={`filter-tab ${activeFilter === f.key ? 'active' : ''}`}
            onClick={() => setActiveFilter(f.key)}
          >
            <Text className="filter-tab-text">{f.label}</Text>
          </View>
        ))}
      </ScrollView>

      <ScrollView className="contracts-scroll" scrollY>
        {filteredDocs.length === 0 && docs.length === 0 ? (
          <EmptyState title="还没有合同或收据" description="上传租房合同、押金收据、水电单等资料，方便随时查看" actionText="去上传资料" onAction={() => setShowUpload(true)} />
        ) : filteredDocs.length === 0 && docs.length > 0 ? (
          <EmptyState title="没有匹配的合同收据" description="换个筛选条件试试" />
        ) : (
          filteredDocs.map((doc) => (
            <View key={doc.id} className="doc-card" onClick={() => handleDelete(doc.id)}>
              <View className="doc-thumb" style={{ background: docThumbColors[doc.type] || docThumbColors.other }}>
                {doc.imageUrl ? (
                  <Image src={doc.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-xs)' }} />
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" stroke="var(--accent-dk)" strokeWidth="1.8" fill="none" opacity="0.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                )}
              </View>
              <View className="doc-info">
                <Text className="doc-name">{doc.name}</Text>
                <Text className="doc-date">{doc.date} 上传</Text>
              </View>
              <svg width="16" height="16" viewBox="0 0 24 24" stroke="var(--text-hint)" strokeWidth="1.8" fill="none" style="flex-shrink:0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </View>
          ))
        )}
        <View style={{ height: '120px' }} />
      </ScrollView>

      <View className="upload-footer-btn" onClick={() => setShowUpload(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth="1.8" fill="none">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <Text className="upload-footer-text">上传资料</Text>
      </View>

      <UploadModal
        visible={showUpload}
        onClose={() => setShowUpload(false)}
        onUpload={handleUpload}
        entityType="contract"
      />
    </View>
  );
}
