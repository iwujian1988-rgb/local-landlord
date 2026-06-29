import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import EmptyState from '../../components/EmptyState';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import ConfirmModal from '../../components/ConfirmModal';
import Icon from '../../components/Icon';
import UploadModal, { UploadFile } from '../../components/UploadModal';
import { get, post, del } from '../../services/request';
import { uploadFile } from '../../services/upload';
import { resolveAsset } from '../../config';
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

// Maps frontend filter key to the backend's tinyint type column.
// See server document.service.ts DOC_TYPE_MAP for the reverse mapping.
const FILTER_TO_DOC_TYPE: Record<FilterKey, number> = {
  all: 5,           // default to 'other' when filter is 'all'
  contract: 0,
  receipt: 1,
  utility: 2,
  maintenance: 3,
  deposit: 4,
  other: 5,
};

export default function Contracts() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const roomId = Number(routerParams.roomId) || 0;

  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (roomId === 0) {
      Taro.showToast({ title: '没有找到对应房间，请返回重新进入', icon: 'none', duration: 2000 });
      return;
    }
    setLoading(true);
    setError(false);
    try {
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
    } catch (err) {
      console.error('[Contracts] 加载文档失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useDidShow(() => { Taro.setNavigationBarTitle({ title: '合同收据' }); loadData(); });

  const handleUpload = useCallback(async (file: UploadFile, note: string) => {
    try {
      const result = await uploadFile(file.tempFilePath);
      const uploadedUrl = result.url;
      // Honor the currently active filter when uploading — otherwise every
      // uploaded doc lands in 'other' (type=5) and is invisible under the
      // filter the landlord had selected.
      const docType = FILTER_TO_DOC_TYPE[activeFilter] ?? 5;
      const docTypeKey: string = activeFilter === 'all' ? 'other' : activeFilter;
      const newDoc: DocumentItem = {
        id: Date.now().toString(),
        type: docTypeKey,
        name: note || '新上传文件',
        date: new Date().toISOString().slice(0, 10),
        imageUrl: uploadedUrl,
        roomId: roomId > 0 ? roomId : undefined,
      };
      await post(`/rooms/${roomId}/documents`, {
        type: docType,
        name: note || '新上传文件',
        imageUrl: uploadedUrl,
      });
      setDocs((prev) => [newDoc, ...prev]);
      setShowUpload(false);
      Taro.showToast({ title: '资料已上传', icon: 'none', duration: 2000 });
    } catch {
      Taro.showToast({ title: '上传失败了，再试一次', icon: 'none' });
    }
  }, [roomId, activeFilter]);

  const handleDeleteRequest = useCallback((docId: string) => {
    setDeleteTargetId(docId);
    setDeleteVisible(true);
  }, []);

  const handlePreview = useCallback((doc: DocumentItem) => {
    if (!doc.imageUrl) {
      Taro.showToast({ title: '该文件暂不支持预览', icon: 'none' });
      return;
    }
    const previewUrl = resolveAsset(doc.imageUrl);
    Taro.previewImage({
      urls: [previewUrl],
      current: previewUrl,
    });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTargetId) return;
    setDeleteVisible(false);
    try {
      await del(`/rooms/${roomId}/documents/${deleteTargetId}`);
      setDocs((prev) => prev.filter((d) => d.id !== deleteTargetId));
      Taro.showToast({ title: '已删除', icon: 'none', duration: 2000 });
    } catch (err) {
      console.error('[Contracts] 删除失败:', err);
      Taro.showToast({ title: '删除失败', icon: 'none' });
    }
  }, [roomId, deleteTargetId]);

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
        {loading && <Loading />}
        {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
        {!loading && !error && (
          <>
            {filteredDocs.length === 0 && docs.length === 0 ? (
              <EmptyState title="还没有合同或收据" description="上传租房合同、押金收据、水电单等资料，方便随时查看" actionText="去上传资料" onAction={() => setShowUpload(true)} />
            ) : filteredDocs.length === 0 && docs.length > 0 ? (
              <EmptyState title="没有匹配的合同收据" description="换个筛选条件试试" />
            ) : (
              filteredDocs.map((doc) => (
                <View
                  key={doc.id}
                  className="doc-card"
                  onClick={() => handlePreview(doc)}
                >
                  <View className="doc-thumb" style={{ background: docThumbColors[doc.type] || docThumbColors.other }}>
                    {doc.imageUrl ? (
                      <Image src={resolveAsset(doc.imageUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-xs)' }} />
                    ) : (
                      <Icon name="file-text" size={28} color="var(--accent-dk)" />
                    )}
                  </View>
                  <View className="doc-info">
                    <Text className="doc-name">{doc.name}</Text>
                    <Text className="doc-date">{doc.date} 上传</Text>
                  </View>
                  <View
                    className="doc-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRequest(doc.id);
                    }}
                  >
                    <Text className="doc-delete-text">删除</Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
        <View style={{ height: '120px' }} />
      </ScrollView>

      <View className="upload-footer-btn" onClick={() => setShowUpload(true)}>
        <Icon name="plus" size={32} color="var(--accent)" />
        <Text className="upload-footer-text">上传资料</Text>
      </View>

      <UploadModal
        visible={showUpload}
        onClose={() => setShowUpload(false)}
        onUpload={handleUpload}
        entityType="contract"
      />

      <ConfirmModal
        visible={deleteVisible}
        title="确认删除该文件？"
        description="删除后不可恢复"
        confirmText="确认删除"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteVisible(false)}
      />
    </View>
  );
}
