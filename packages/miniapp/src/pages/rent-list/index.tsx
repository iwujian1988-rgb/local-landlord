import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import Icon from '../../components/Icon';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import { useCallback, useState } from 'react';
import { get, put } from '../../services/request';
import { requestNotification } from '../../services/notification';
import { forwardBillShare, generateAndCopyShareLink } from '../../services/share';
import { RENT_LIST_TAB_INDEX } from '../../constants/app';
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
  payMonths: number;
  billId: number | null;
  billStatus: number;
  billPeriod: string | null;
  billPeriodEnd: string | null;
  totalAmount: number;
  paidAmount: number;
  overdueDays: number;
  daysUntil: number;
  hasOverdue: boolean;
  nextDueMonth: string | null;
}

interface PendingResponse {
  today: PendingEntry[];
  approaching: PendingEntry[];
  overdue: PendingEntry[];
  completed: PendingEntry[];
  upcoming: PendingEntry[];
}

type Bucket = 'overdue' | 'today' | 'approaching' | 'upcoming';

interface DisplayItem {
  entry: PendingEntry;
  bucket: Bucket;
  label: string;
  desc: string;
}

function periodLabel(entry: PendingEntry): string {
  if (!entry.billPeriod) return '';
  if (!entry.billPeriodEnd || entry.billPeriodEnd === entry.billPeriod) {
    return entry.billPeriod;
  }
  return `${entry.billPeriod} ~ ${entry.billPeriodEnd}`;
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
  for (const e of data.upcoming) {
    const nextMonth = e.nextDueMonth || '';
    const payMonthsLabel = e.payMonths > 1 ? ` · 每${e.payMonths}个月收` : '';
    items.push({ entry: e, bucket: 'upcoming', label: `下次${nextMonth}`, desc: `下次${nextMonth}收租${payMonthsLabel}` });
  }
  return items;
}

export default function RentList() {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmItem, setConfirmItem] = useState<DisplayItem | null>(null);
  const [activeItems, setActiveItems] = useState<DisplayItem[]>([]);
  const [upcomingItems, setUpcomingItems] = useState<DisplayItem[]>([]);
  const [completedItems, setCompletedItems] = useState<PendingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  const loadData = useCallback(async (): Promise<DisplayItem[]> => {
    setLoading(true);
    setError(false);
    try {
      const res = await get<PendingResponse>('/rent/pending');
      const data = res.data || { today: [], approaching: [], overdue: [], completed: [], upcoming: [] };
      const allItems = buildDisplayItems(data);
      setActiveItems(allItems.filter(i => i.bucket !== 'upcoming'));
      setUpcomingItems(allItems.filter(i => i.bucket === 'upcoming'));
      setCompletedItems(data.completed || []);

      // Sync tab badge with remaining pending count (excludes upcoming — those aren't due yet)
      const remaining = (data.today?.length || 0) + (data.approaching?.length || 0) + (data.overdue?.length || 0);
      try {
        if (remaining > 0) {
          Taro.setTabBarBadge({ index: RENT_LIST_TAB_INDEX, text: String(Math.min(remaining, 99)) });
        } else {
          Taro.removeTabBarBadge({ index: RENT_LIST_TAB_INDEX });
        }
      } catch (e) {
        // ignore
      }
      return allItems;
    } catch (err) {
      console.error('[RentList] 加载数据失败:', err);
      setError(true);
      return [];
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
    // Use the data returned from loadData directly — closures over `activeItems`
    // state would see stale (empty) values on first mount, breaking deep-link
    // auto-open of the confirm modal when arriving from a bill notification.
    loadData().then((allItems) => {
      if (pushBillId > 0) {
        const match = allItems.find(i => i.entry.billId === pushBillId);
        if (match) {
          setConfirmItem(match);
          setConfirmVisible(true);
        }
      }
    });
  });

  const handleConfirm = useCallback((item: DisplayItem) => {
    setConfirmItem(item);
    setConfirmVisible(true);
  }, []);

  const handleConfirmSubmit = useCallback(async (actualAmount?: number) => {
    // requestSubscribeMessage MUST run inside the user TAP gesture's sync call
    // stack. Call it before any await.
    requestNotification();
    if (!confirmItem?.entry.billId) return;
    setConfirmVisible(false);

    try {
      await put(`/bills/${confirmItem.entry.billId}/confirm`, {
        actualAmount,
      });
      // Compare against remaining balance to detect true partial payment
      const remaining = confirmItem.entry.totalAmount - (confirmItem.entry.paidAmount || 0);
      const isPartial = actualAmount != null && actualAmount < remaining;
      Taro.showToast({
        title: isPartial ? '已记录部分付款' : '已标记收到',
        icon: 'none',
        duration: 1500,
      });
      loadData();
    } catch (err) {
      console.error('[RentList] 标记失败:', err);
      Taro.showToast({ title: '操作失败', icon: 'none' });
    }
  }, [confirmItem, loadData]);

  const overdueItems = activeItems.filter(i => i.bucket === 'overdue');

  const handleBatchRemind = useCallback(async () => {
    if (batchLoading) return;
    Taro.showModal({
      title: '批量发送提醒',
      content: `将为 ${overdueItems.length} 笔逾期款项生成账单链接并复制汇总文字到剪贴板，方便你逐个发给租客。`,
      confirmText: '开始生成',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return;
        setBatchLoading(true);
        const lines: string[] = [];
        let successCount = 0;
        let failCount = 0;
        const limit = overdueItems.slice(0, 10);
        for (const item of limit) {
          if (item.entry.billId) {
            const result = await generateAndCopyShareLink(item.entry.billId);
            if (result) {
              lines.push(`${item.entry.roomName} · ${item.entry.tenantName}：${result.shareUrl}`);
              successCount++;
            } else {
              failCount++;
            }
          }
        }
        const extraCount = Math.max(0, overdueItems.length - limit.length);
        const summary = lines.join('\n')
          + (extraCount > 0 ? `\n…等 ${extraCount} 笔` : '')
          + (failCount > 0 ? `\n（${failCount} 笔生成失败）` : '');
        Taro.setClipboardData({ data: summary, success: () => {} });
        setBatchLoading(false);
        Taro.showModal({
          title: '汇总已复制到剪贴板',
          content: `成功 ${successCount} 笔${failCount > 0 ? `，失败 ${failCount} 笔` : ''}。粘贴到微信群发或逐个发给租客。`,
          confirmText: '我知道了',
          showCancel: false,
        });
      },
    });
  }, [overdueItems, batchLoading]);

  // Summary numbers
  const totalPending = activeItems.reduce((s, i) => {
    const total = i.entry.totalAmount ?? i.entry.rent ?? 0;
    const paid = i.entry.paidAmount || 0;
    return s + Math.max(total - paid, 0);
  }, 0);
  const totalCollected = completedItems.reduce((s, e) => s + (e.totalAmount ?? e.rent ?? 0), 0)
    + activeItems.reduce((s, i) => s + (i.entry.paidAmount || 0), 0);

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

        {activeItems.map((item, idx) => {
          const isPartial = item.entry.billStatus === 3 && item.entry.paidAmount > 0;
          const buttonLabel = isPartial ? '补齐尾款' : '已收到';
          return (
            <View key={idx} className="rent-item-card">
              <View className="rent-item-top">
                <View className="rent-item-info">
                  <Text className="rent-item-name">{item.entry.roomName} · {item.entry.tenantName}</Text>
                  <Text className="rent-item-amount">{item.entry.totalAmount.toLocaleString()} 元</Text>
                  {periodLabel(item.entry) && (
                    <Text className="rent-item-period">{periodLabel(item.entry)}</Text>
                  )}
                </View>
                <View className={`rent-tag ${item.bucket === 'overdue' ? 'tag-red' : item.bucket === 'today' ? 'tag-accent' : 'tag-default'}`}>
                  <Text className="rent-tag-text">{isPartial ? '部分付款' : item.label}</Text>
                </View>
              </View>

              {isPartial && (
                <Text className="rent-item-desc overdue-text">已收 {item.entry.paidAmount.toLocaleString()} / {item.entry.totalAmount.toLocaleString()} 元</Text>
              )}

              {!isPartial && item.bucket === 'overdue' && (
                <Text className="rent-item-desc overdue-text">{item.desc}</Text>
              )}

              <View className="rent-item-actions">
                {item.bucket === 'overdue' && item.entry.overdueDays >= 1 && !isPartial && (
                  <View
                    className="rent-btn secondary"
                    onClick={() => {
                      if (item.entry.billId) {
                        forwardBillShare(item.entry.billId);
                      } else {
                        Taro.setClipboardData({
                          data: `${item.entry.tenantName || '租客'}你好，你的房租${item.entry.totalAmount || ''}元已经逾期${item.entry.overdueDays}天了，请尽快安排，谢谢！`,
                        });
                      }
                    }}
                  >
                    <Text className="rent-btn-text">催一下</Text>
                  </View>
                )}
                <View
                  className={`rent-btn primary${item.bucket === 'overdue' && item.entry.overdueDays <= 1 ? ' full' : ''}`}
                  onClick={() => handleConfirm(item)}
                >
                  <Text className="rent-btn-text">{buttonLabel}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {overdueItems.length >= 2 && (
          <View className="batch-actions">
            <View
              className={`batch-btn ${batchLoading ? 'disabled' : ''}`}
              onClick={batchLoading ? undefined : handleBatchRemind}
            >
              <Text className="batch-btn-text">
                {batchLoading ? '生成中...' : `批量发送提醒（${overdueItems.length}笔）`}
              </Text>
            </View>
          </View>
        )}

        {upcomingItems.length > 0 && (
          <>
            <View className="rent-section-header">
              <Text className="rent-section-title">下次收款（非本月周期）</Text>
              <Text className="rent-section-count">{upcomingItems.length}间</Text>
            </View>
            {upcomingItems.map((item, idx) => (
              <View key={idx} className="rent-item-card">
                <View className="rent-item-top">
                  <View className="rent-item-info">
                    <Text className="rent-item-name">{item.entry.roomName} · {item.entry.tenantName}</Text>
                    <Text className="rent-item-amount">{item.entry.totalAmount.toLocaleString()} 元</Text>
                    <Text className="rent-item-period">{item.desc}</Text>
                  </View>
                  <View className="rent-tag tag-default">
                    <Text className="rent-tag-text">{item.label}</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
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
          <View className="rent-link-item" onClick={async () => {
            // Records page is per-room — ask which room rather than silently
            // landing on the stats page (the previous behavior, which was a
            // dead-end since the link text promised "history records").
            try {
              const res = await get<any[]>('/rooms');
              const rooms = res.data || [];
              if (rooms.length === 0) {
                Taro.showToast({ title: '还没有房间，先去添加', icon: 'none' });
                return;
              }
              Taro.showActionSheet({
                itemList: rooms.map(r => r.name || `房间${r.id}`),
                success: (s) => {
                  const room = rooms[s.tapIndex];
                  if (room) {
                    Taro.navigateTo({ url: `/pages/records/index?roomId=${room.id}` });
                  }
                },
              });
            } catch {
              Taro.showToast({ title: '加载失败', icon: 'none' });
            }
          }}>
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
        paidAmount={confirmItem?.entry.paidAmount || 0}
        editableAmount
        confirmText="确认已收"
        onConfirm={handleConfirmSubmit}
        onCancel={() => setConfirmVisible(false)}
      />
    </View>
  );
}
