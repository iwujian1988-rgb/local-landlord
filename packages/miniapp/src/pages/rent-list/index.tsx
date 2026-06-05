import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';
import { useCallback, useState, useEffect, useMemo } from 'react';
import { getAppData, setAppData } from '../../utils/storage';
import './index.scss';

interface RentItem {
  roomId: number;
  roomName: string;
  tenantId: number;
  tenantName: string;
  amount: number;
  rentDay: number;
  month: number;
  year: number;
  paidMonth?: number;
}

interface RentItemComputed extends RentItem {
  status: 'today' | 'overdue' | 'soon' | 'paid';
  statusLabel: string;
  tagClass: string;
  overdueDays?: number;
  daysUntil?: number;
  description: string;
}

function computeStatus(item: RentItem): RentItemComputed {
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();

  if (item.tenantName === '-' || item.amount === 0) {
    return { ...item, status: 'paid', statusLabel: '完成', tagClass: 'green', description: '此房间暂无租客' };
  }

  // Check appData.bills for current month paid record
  const appData = getAppData();
  const bills = appData.bills || [];
  const currentPeriod = `${todayYear}年${todayMonth}月`;
  const hasPaidInBills = bills.some(
    (b: any) => b.roomId === item.roomId && b.status === 1 && b.period === currentPeriod
  );

  if ((item.month && item.paidMonth && item.paidMonth === todayMonth) || hasPaidInBills) {
    return { ...item, status: 'paid', statusLabel: '完成', tagClass: 'green', description: '已收到，本月不再提醒' };
  }

  if (item.rentDay === todayDay || item.rentDay === 0 && todayDay >= 28) {
    return { ...item, status: 'today', statusLabel: '今天该收', tagClass: 'orange', description: `今天 ${item.rentDay || '月底'} 号该收，这个月还没通知` };
  }

  const daysUntil = item.rentDay > todayDay ? item.rentDay - todayDay : 999;
  if (daysUntil <= 3 && daysUntil > 0) {
    return { ...item, status: 'soon', statusLabel: '快到日子', tagClass: 'blue', description: `还有 ${daysUntil} 天到收租日，可提前通知` };
  }

  if (item.rentDay < todayDay) {
    const overdueDays = todayDay - item.rentDay;
    return { ...item, status: 'overdue', statusLabel: '没交', tagClass: 'red', description: `已晚 ${overdueDays} 天，还没收到`, overdueDays };
  }

  return { ...item, status: 'soon', statusLabel: '快到日子', tagClass: 'blue', description: `还有 ${daysUntil} 天到收租日` };
}

export default function RentList() {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmItem, setConfirmItem] = useState<RentItemComputed | null>(null);
  const [rentItems, setRentItems] = useState<RentItem[]>([]);

  const loadData = useCallback(() => {
    const appData = getAppData();
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayYear = today.getFullYear();

    if (appData.tenants && appData.tenants.length > 0 && appData.rooms && appData.rooms.length > 0) {
      const items: RentItem[] = appData.tenants
        .filter((t: any) => t.status !== 0)
        .map((t: any) => {
          const room = appData.rooms.find((r: any) => r.id === t.roomId);
          return {
            roomId: t.roomId,
            roomName: room?.name || `房间${t.roomId}`,
            tenantId: t.id,
            tenantName: t.name || '-',
            amount: room?.rent || 0,
            rentDay: t.rentDay || 1,
            month: todayMonth,
            year: todayYear,
          };
        });
      if (items.length > 0) {
        setRentItems(items);
      }
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useDidShow(() => { loadData(); });

  const computedItems: RentItemComputed[] = useMemo(() => rentItems.map(computeStatus), [rentItems]);

  // Sort: overdue > today > soon
  const activeItems = useMemo(() => {
    const order: Record<string, number> = { overdue: 0, today: 1, soon: 2 };
    return computedItems
      .filter(r => r.status !== 'paid')
      .sort((a, b) => (order[a.status] || 99) - (order[b.status] || 99));
  }, [computedItems]);

  const paidItems = computedItems.filter(r => r.status === 'paid');

  const totalActive = activeItems.length;

  const handleConfirm = useCallback((item: RentItemComputed) => {
    setConfirmItem(item);
    setConfirmVisible(true);
  }, []);

  const handleConfirmSubmit = useCallback(() => {
    if (!confirmItem) return;
    setConfirmVisible(false);

    const appData = getAppData();
    appData.billSettings = appData.billSettings || {};
    appData.billSettings.paidRooms = appData.billSettings.paidRooms || [];
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    if (!appData.billSettings.paidRooms.find((p: any) => p.roomId === confirmItem.roomId && p.month === monthKey)) {
      appData.billSettings.paidRooms.push({ roomId: confirmItem.roomId, month: monthKey, amount: confirmItem.amount, paidAt: now.toISOString() });
    }
    setAppData(appData);

    Taro.showToast({ title: '已标记为收到', icon: 'none', duration: 2000 });
    loadData();
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

        {activeItems.length === 0 && paidItems.length === 0 && (
          <EmptyState icon="🏠" title="还没有收租数据" description="添加房间和租客后，这里会自动帮您算该收哪些租" actionText="去添加房间" onAction={() => Taro.switchTab({ url: '/pages/rooms/index' })} />
        )}

        <View style={{ height: '160px' }} />
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
