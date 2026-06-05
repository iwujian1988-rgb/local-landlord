import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import EmptyState from '../../components/EmptyState';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import { get } from '../../services/request';
import { useState, useCallback, useMemo } from 'react';
import './index.scss';

type FilterKey = 'all' | 'bill' | 'single' | 'deposit' | 'paid' | 'unpaid';

const filters: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'bill', label: '账单' },
  { key: 'single', label: '单独收' },
  { key: 'deposit', label: '押金' },
  { key: 'paid', label: '已收' },
  { key: 'unpaid', label: '未收' },
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
  bill: ['bill_sent', 'bill_paid'],
  single: ['single_charge', 'single_paid'],
  deposit: ['deposit'],
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
    setLoading(true);
    setError(false);
    try {
      const res = await get<any[]>('/rooms/' + roomId + '/records');
      const data = res.data || [];
      setRecords(data);

      if (roomId > 0) {
        // TODO: Use /rooms/${roomId} endpoint instead of /rooms when available
        // Currently the server does not have a single-room endpoint, so we fetch all.
        const roomRes = await get<any[]>('/rooms');
        const rooms = roomRes.data || [];
        const room = rooms.find((r: any) => r.id === roomId);
        setTitle(room ? `${room.name} · 收租记录` : '收租记录');
      }
    } catch (err) {
      console.error('[Records] 加载记录失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useDidShow(() => { loadData(); });

  const goBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  const filteredRecords = useMemo(() => {
    const types = filterMapping[activeFilter];
    if (!types || types.length === 0) return records;
    return records.filter((r) => types.includes(r.type));
  }, [activeFilter, records]);

  return (
    <View className="page-records">
      <NavBar title={title} onBack={goBack} />

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
