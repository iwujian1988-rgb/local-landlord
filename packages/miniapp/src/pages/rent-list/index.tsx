import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import Icon from '../../components/Icon';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import { useCallback, useState } from 'react';
import { get, put } from '../../services/request';
import { WX_TEMPLATE_RENT, WX_TEMPLATE_OVERDUE } from '../../config';
import { requestNotification } from '../../services/notification';
import './index.scss';

interface PendingEntry {
  roomId: number;
  roomName: string;
  propertyName: string;
  propertyId: number;
  rent: number;
  tenantName: string;
  tenantId: number | null;
  contractEndDate: string;
  rentDay: number;
  billId: number | null;
  billStatus: number;
  totalAmount: number;
  overdueDays: number;
  daysUntil: number;
  hasOverdue: boolean;
}

interface PendingResponse {
  today: PendingEntry[];
  approaching: PendingEntry[];
  overdue: PendingEntry[];
  completed: PendingEntry[];
}

type Bucket = 'overdue' | 'today' | 'approaching';

interface DisplayItem {
  entry: PendingEntry;
  bucket: Bucket;
  label: string;
  desc: string;
}

function buildDisplayItems(data: PendingResponse): DisplayItem[] {
  const items: DisplayItem[] = [];
  for (const e of data.overdue) {
    items.push({ entry: e, bucket: 'overdue', label: '逾期', desc: e.overdueDays > 0 ? `已逾期${e.overdueDays}天` : '有往期欠费' });
  }
  for (const e of data.today) {
    items.push({ entry: e, bucket: 'today', label: '今天该收', desc: '今天该收了' });
  }
  for (const e of data.approaching) {
    items.push({ entry: e, bucket: 'approaching', label: `${e.daysUntil}天后`, desc: `还有${e.daysUntil}天` });
  }
  return items;
}

export default function RentList() {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmItem, setConfirmItem] = useState<DisplayItem | null>(null);
  const [activeItems, setActiveItems] = useState<DisplayItem[]>([]);
  const [completedItems, setCompletedItems] = useState<PendingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await get<PendingResponse>('/rent/pending');
      const data = res.data || { today: [], approaching: [], overdue: [], completed: [] };
      setActiveItems(buildDisplayItems(data));
      setCompletedItems(data.completed);
    } catch (err) {
      console.error('[RentList] 加载数据失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const [pushBillId] = useState(() => {
    const params = Taro.getCurrentInstance().router?.params || {};
    return Number(params.billId) || 0;
  });

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '收租' });
    loadData().then(() => {
      if (pushBillId > 0) {
        setTimeout(() => {
          const match = activeItems.find(i => i.entry.billId === pushBillId);
          if (match) {
            setConfirmItem(match);
            setConfirmVisible(true);
          }
        }, 300);
      }
    });
  });

  const handleConfirm = useCallback((item: DisplayItem) => {
    setConfirmItem(item);
    setConfirmVisible(true);
  }, []);

  const handleConfirmSubmit = useCallback(async () => {
    if (!confirmItem?.entry.billId) return;
    setConfirmVisible(false);

    try {
      await put(`/bills/${confirmItem.entry.billId}/confirm`, {});
      requestNotification();
      Taro.showToast({ title: '已标记收到', icon: 'none', duration: 1500 });
      loadData();
    } catch (err) {
      console.error('[RentList] 标记失败:', err);
      Taro.showToast({ title: '操作失败', icon: 'none' });
    }
  }, [confirmItem, loadData]);

  const overdueItems = activeItems.filter(i => i.bucket === 'overdue');

  const handleBatchConfirm = useCallback(async () => {
    if (batchLoading) return;
    Taro.showModal({
      title: '批量标记已收',
      content: `确认将 ${overdueItems.length} 笔逾期款项全部标记为已收到？`,
      confirmText: '全部确认',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return;
        setBatchLoading(true);
        let successCount = 0;
        for (const item of overdueItems) {
          if (item.entry.billId) {
            try {
              await put(`/bills/${item.entry.billId}/confirm`, {});
              successCount++;
            } catch (err) {
              console.error('[RentList] 批量标记失败:', err);
            }
          }
        }
        setBatchLoading(false);
        Taro.showToast({ title: `已标记 ${successCount} 笔`, icon: 'none', duration: 2000 });
        loadData();
      },
    });
  }, [overdueItems, batchLoading, loadData]);

  const requestNotify = useCallback(() => {
    const tmplIds = [WX_TEMPLATE_RENT, WX_TEMPLATE_OVERDUE].filter(Boolean);
    if (tmplIds.length === 0) return;
    Taro.requestSubscribeMessage({
      tmplIds,
      entityIds: tmplIds,
      success: () => {},
      fail: () => {},
    });
  }, []);

  // Summary numbers
  const totalPending = activeItems.reduce((s, i) => s + (i.entry.totalAmount ?? i.entry.rent ?? 0), 0);
  const totalCollected = completedItems.reduce((s, e) => s + (e.totalAmount ?? e.rent ?? 0), 0);

  return (
    <View className="page-rent-list">
      <ScrollView className="rent-scroll" scrollY>
        {loading && <Loading />}
        {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
        {!loading && !error && (
          <>

        {/* Summary card */}
        <View className="rent-summary-card">
          <View className="rent-summary-row">
            <View className="rent-summary-item">
              <Text className="rent-summary-number">{(totalPending + totalCollected).toLocaleString()}</Text>
              <Text className="rent-summary-label">本月应收</Text>
            </View>
            <View className="rent-summary-divider" />
            <View className="rent-summary-item">
              <Text className="rent-summary-number green">{totalCollected.toLocaleString()}</Text>
              <Text className="rent-summary-label">已收</Text>
            </View>
            <View className="rent-summary-divider" />
            <View className="rent-summary-item">
              <Text className="rent-summary-number orange">{totalPending.toLocaleString()}</Text>
              <Text className="rent-summary-label">待收</Text>
            </View>
          </View>
        </View>

        {activeItems.length > 0 && (
          <View className="rent-section-header">
            <Text className="rent-section-title">待收租</Text>
            <Text className="rent-section-count">{activeItems.length}笔</Text>
          </View>
        )}

        {activeItems.map((item, idx) => (
          <View key={idx} className="rent-item-card">
            <View className="rent-item-top">
              <View className="rent-item-info">
                <Text className="rent-item-name">{item.entry.roomName} · {item.entry.tenantName}</Text>
                <Text className="rent-item-amount">{item.entry.totalAmount.toLocaleString()} 元</Text>
              </View>
              <View className={`rent-tag ${item.bucket === 'overdue' ? 'tag-red' : item.bucket === 'today' ? 'tag-accent' : 'tag-default'}`}>
                <Text className="rent-tag-text">{item.label}</Text>
              </View>
            </View>

            {item.bucket === 'overdue' && (
              <Text className="rent-item-desc overdue-text">{item.desc}</Text>
            )}

            <View className="rent-item-actions">
              {item.bucket === 'overdue' && item.entry.overdueDays > 1 && (
                <View
                  className="rent-btn secondary"
                  onClick={() => {
                    Taro.setClipboardData({
                      data: `${item.entry.tenantName || '租客'}你好，你的房租${item.entry.totalAmount || ''}元已经逾期${item.entry.overdueDays}天了，请尽快安排，谢谢！`,
                    });
                  }}
                >
                  <Text className="rent-btn-text">催一下</Text>
                </View>
              )}
              <View
                className={`rent-btn primary${item.bucket === 'overdue' && item.entry.overdueDays <= 1 ? ' full' : ''}`}
                onClick={() => handleConfirm(item)}
              >
                <Text className="rent-btn-text">已收到</Text>
              </View>
            </View>
          </View>
        ))}

        {overdueItems.length >= 2 && (
          <View className="batch-actions">
            <View
              className={`batch-btn ${batchLoading ? 'disabled' : ''}`}
              onClick={batchLoading ? undefined : handleBatchConfirm}
            >
              <Text className="batch-btn-text">
                {batchLoading ? '处理中...' : `全部标记已收（${overdueItems.length}笔）`}
              </Text>
            </View>
          </View>
        )}

        {!loading && activeItems.length === 0 && completedItems.length === 0 && (
          <EmptyState title="本月没有待收租" description="添加房间和租客后，到日子会在这里提醒你" actionText="去添加房间" onAction={() => Taro.switchTab({ url: '/pages/rooms/index' })} />
        )}

        {/* Quick links */}
        <View className="rent-links">
          <View className="rent-link-item" onClick={() => Taro.navigateTo({ url: '/pages/rent-stats/index' })}>
            <Icon name="chart" size={28} color="var(--text-secondary)" />
            <Text className="rent-link-text">收租统计</Text>
            <Text style={{ fontSize: '24px', color: 'var(--text-hint)', lineHeight: 1 }}>›</Text>
          </View>
          <View className="rent-link-item" onClick={() => Taro.navigateTo({ url: '/pages/rent-stats/index' })}>
            <Icon name="clock" size={28} color="var(--text-secondary)" />
            <Text className="rent-link-text">历史收租记录</Text>
            <Text style={{ fontSize: '24px', color: 'var(--text-hint)', lineHeight: 1 }}>›</Text>
          </View>
        </View>

        <View style={{ height: '40px' }} />
          </>
        )}
      </ScrollView>

      <ConfirmModal
        visible={confirmVisible}
        title="确认已收款"
        amount={confirmItem?.entry.totalAmount || 0}
        confirmText="确认已收"
        onConfirm={handleConfirmSubmit}
        onCancel={() => setConfirmVisible(false)}
      />
    </View>
  );
}
