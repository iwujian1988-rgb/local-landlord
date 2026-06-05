import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import { useCallback, useState, useMemo } from 'react';
import { get, post } from '../../services/request';
import './index.scss';

interface RentItem {
  id: number;
  roomId: number;
  roomName: string;
  tenantId: number;
  tenantName: string;
  amount: number;
  rentDay: number;
  status: 'today' | 'overdue' | 'soon' | 'paid';
  statusLabel: string;
  tagClass: string;
  overdueDays?: number;
  daysUntil?: number;
  description: string;
}

export default function RentList() {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmItem, setConfirmItem] = useState<RentItem | null>(null);
  const [rentItems, setRentItems] = useState<RentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await get<RentItem[]>('/rent/pending');
      if (res.code === 0) {
        setRentItems(res.data || []);
      }
    } catch (err) {
      console.error('[RentList] 加载数据失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => { loadData(); });

  const activeItems = useMemo(() => {
    const order: Record<string, number> = { overdue: 0, today: 1, soon: 2 };
    return rentItems
      .filter(r => r.status !== 'paid')
      .sort((a, b) => (order[a.status] || 99) - (order[b.status] || 99));
  }, [rentItems]);

  const paidItems = rentItems.filter(r => r.status === 'paid');

  const handleConfirm = useCallback((item: RentItem) => {
    setConfirmItem(item);
    setConfirmVisible(true);
  }, []);

  const handleConfirmSubmit = useCallback(async () => {
    if (!confirmItem) return;
    setConfirmVisible(false);

    try {
      await post(`/rent/${confirmItem.id}/confirm`, {
        roomId: confirmItem.roomId,
        amount: confirmItem.amount,
      });
      Taro.showToast({ title: '已标记为收到', icon: 'none', duration: 2000 });
      loadData();
    } catch (err) {
      console.error('[RentList] 标记失败:', err);
      Taro.showToast({ title: '操作失败', icon: 'none' });
    }
  }, [confirmItem, loadData]);

  const navigateTo = (pageId: string, params: string) => {
    Taro.navigateTo({ url: `/pages/${pageId}/index${params}` });
  };

  return (
    <View className="page-rent-list">
      <NavBar
        title="收租列表"
        showBack={false}
        rightActions={[
          {
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" stroke="var(--text-secondary)" strokeWidth="1.8" fill="none">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            ),
            onClick: () => Taro.navigateTo({ url: '/pages/rent-stats/index' }),
          },
        ]}
      />

      <ScrollView className="rent-scroll" scrollY>
        {loading && <Loading />}
        {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
        {!loading && !error && (
          <>
        {/* Explanation */}
        <View className="elder-card">
          <Text className="elder-card-title">收租提醒</Text>
          <View className="elder-step">
            <View className="elder-step-num"><Text>1</Text></View>
            <View>
              <Text className="elder-step-title">今天该收</Text>
              <Text className="elder-step-desc">到日子了，这个月还没收到，会在这里提醒。</Text>
            </View>
          </View>
          <View className="elder-step">
            <View className="elder-step-num"><Text>2</Text></View>
            <View>
              <Text className="elder-step-title">快到日子</Text>
              <Text className="elder-step-desc">提前 3 天提醒房东，避免忘记。</Text>
            </View>
          </View>
          <View className="elder-step">
            <View className="elder-step-num"><Text>3</Text></View>
            <View>
              <Text className="elder-step-title">已经逾期</Text>
              <Text className="elder-step-desc">过了收租日还没收到，放在最前面提醒。</Text>
            </View>
          </View>
        </View>

        {activeItems.length > 0 && (
          <View className="rent-section-header">
            <Text className="rent-section-title">今天要收的</Text>
          </View>
        )}

        {activeItems.length > 0 && (
          <View className="elder-card why-card">
            <Text className="elder-card-title-small">哪些房间会出现在这里？</Text>
            <Text className="elder-card-desc-sm">
              这里只放今天该收租的房间。已经收到的和还没到日子的不会出现。
            </Text>
          </View>
        )}

        {/* Active rent items */}
        {activeItems.map((item, idx) => (
          <View key={idx} className="elder-room-row">
            <View className="room-row-header">
              <View className="room-row-info">
                <Text className="elder-room-name">{item.roomName} · {item.tenantName}</Text>
                <Text className={`elder-money ${item.status === 'overdue' ? 'overdue' : ''}`}>
                  {item.amount.toLocaleString()} 元
                </Text>
                <Text className={`elder-card-desc ${item.status === 'overdue' ? 'overdue-desc' : ''}`}>
                  {item.description}
                </Text>
              </View>
              <View className={`tag tag-${item.tagClass}`}>
                <Text className="tag-text">{item.statusLabel}</Text>
              </View>
            </View>

            {/* Action buttons by status */}
            {item.status === 'today' && (
              <View className="room-row-actions">
                <View
                  className="btn-action primary"
                  onClick={() => navigateTo('bill', `?roomId=${item.roomId}&tenantId=${item.tenantId}`)}
                >
                  <Text className="btn-action-text">通知交租</Text>
                </View>
                <View className="btn-action primary" onClick={() => handleConfirm(item)}>
                  <Text className="btn-action-text">已收到</Text>
                </View>
              </View>
            )}

            {item.status === 'overdue' && (
              <View className="room-row-actions">
                <View
                  className="btn-action secondary red-text"
                  onClick={() => navigateTo('remind', `?roomId=${item.roomId}&tenantId=${item.tenantId}`)}
                >
                  <Text className="btn-action-text red-text">提醒一下</Text>
                </View>
                <View className="btn-action primary" onClick={() => handleConfirm(item)}>
                  <Text className="btn-action-text">已收到</Text>
                </View>
              </View>
            )}

            {item.status === 'soon' && (
              <View className="room-row-actions">
                <View
                  className="btn-action primary"
                  onClick={() => navigateTo('bill', `?roomId=${item.roomId}&tenantId=${item.tenantId}`)}
                >
                  <Text className="btn-action-text">通知交租</Text>
                </View>
                <View className="btn-action primary" onClick={() => handleConfirm(item)}>
                  <Text className="btn-action-text">已收到</Text>
                </View>
              </View>
            )}
          </View>
        ))}

        {/* Completed section */}
        {paidItems.length > 0 && (
          <View className="rent-section-header">
            <Text className="rent-section-title">已经完成</Text>
          </View>
        )}
        {paidItems.map((item, idx) => (
          <View key={`paid-${idx}`} className="elder-room-row paid-row">
            <View className="room-row-header">
              <View className="room-row-info">
                <Text className="elder-room-name">{item.roomName}</Text>
                <Text className="elder-money green">{item.amount.toLocaleString()} 元</Text>
                <Text className="elder-card-desc green-desc">已收到，本月不再提醒</Text>
              </View>
              <View className="tag tag-green">
                <Text className="tag-text">完成</Text>
              </View>
            </View>
          </View>
        ))}

        {!loading && activeItems.length === 0 && paidItems.length === 0 && (
          <EmptyState icon="&#127968;" title="还没有收租数据" description="添加房间和租客后，这里会自动帮您算该收哪些租" actionText="去添加房间" onAction={() => Taro.switchTab({ url: '/pages/rooms/index' })} />
        )}

        <View style={{ height: '160px' }} />
          </>
        )}
      </ScrollView>

      <ConfirmModal
        visible={confirmVisible}
        title="确认已收款"
        amount={confirmItem?.amount || 0}
        confirmText="确认已收"
        onConfirm={handleConfirmSubmit}
        onCancel={() => setConfirmVisible(false)}
      />
    </View>
  );
}
