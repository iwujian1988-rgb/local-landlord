import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import EmptyState from '../../components/EmptyState';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import { get } from '../../services/request';
import { useState, useCallback, useMemo } from 'react';
import './index.scss';

type FilterKey = 'all' | 'overdue' | 'paid' | 'unpaid' | 'single';

const filters: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'overdue', label: '逾期' },
  { key: 'paid', label: '已收' },
  { key: 'unpaid', label: '未收' },
  { key: 'single', label: '单独收' },
];

interface RecordItem {
  type: string;
  dotColor: string;
  title: string;
  description: string;
  time: string;
}

const filterMapping: Record<FilterKey, string[]> = {
  all: [],
  // 逾期 is matched specially via title substring — backend has no dedicated type
  overdue: [],
  single: ['single_charge', 'single_paid'],
  paid: ['bill_paid', 'single_paid'],
  unpaid: ['bill_sent', 'single_charge', 'reminder'],
};

export default function Records() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const roomId = Number(routerParams.roomId) || 0;

  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [title, setTitle] = useState('收租记录');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    // No roomId → no records to fetch. Avoids 400 from /rooms/0/records.
    if (!roomId) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const res = await get<any[]>('/rooms/' + roomId + '/records');
      const data = res.data || [];
      setRecords(data);

      if (roomId > 0) {
        const roomRes = await get<any>(`/rooms/${roomId}`);
        if (roomRes.code === 0 && roomRes.data) {
          const roomTitle = `${roomRes.data.name} · 收租记录`;
          setTitle(roomTitle);
          Taro.setNavigationBarTitle({ title: roomTitle });
        }
      }
    } catch (err) {
      console.error('[Records] 加载记录失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: title });
    loadData();
  });

  const filteredRecords = useMemo(() => {
    if (activeFilter === 'overdue') {
      // Overdue reminders have type='reminder' and title containing '逾期'
      return records.filter((r) => r.type === 'reminder' && (r.title || '').includes('逾期'));
    }
    const types = filterMapping[activeFilter];
    if (!types || types.length === 0) return records;
    return records.filter((r) => types.includes(r.type));
  }, [activeFilter, records]);

  return (
    <View className="page-records">
      <ScrollView className="records-filter" scrollX>
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

      <ScrollView className="records-scroll" scrollY>
        {loading && <Loading />}
        {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
        {!loading && !error && (
          <>
            {filteredRecords.length === 0 && records.length === 0 ? (
              <EmptyState title="还没有收租记录" description="给租客发账单后，收款和提醒记录会出现在这里" actionText="去发账单" onAction={() => Taro.switchTab({ url: '/pages/rent-list/index' })} />
            ) : filteredRecords.length === 0 && records.length > 0 ? (
              <EmptyState title="没有匹配的收租记录" description="换个筛选条件试试" />
            ) : (
              <View className="record-list">
                {filteredRecords.map((item, idx) => (
                  <View key={idx} className="record-item">
                    <View className={`record-dot ${item.dotColor}`} />
                    <View className="record-content">
                      <Text className="record-time">{item.time}</Text>
                      <Text className="record-title">{item.title}</Text>
                      <Text className="record-desc">{item.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
        <View style={{ height: '100px' }} />
      </ScrollView>
    </View>
  );
}
