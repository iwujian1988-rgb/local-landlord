import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import RoomCard from '../../components/RoomCard';
import { get } from '../../services/request';
import EmptyState from '../../components/EmptyState';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import { useState, useCallback, useMemo } from 'react';
import './index.scss';

interface RoomItem {
  id: number;
  propertyId: number;
  name: string;
  rent: number;
  status: number;
  availableDate?: string;
  deposit?: number;
  area?: string;
  floor?: string;
  orientation?: string;
  facilities?: string[];
  images?: string[];
  note?: string;
  createdAt: string;
  updatedAt: string;
  tenantName?: string;
  rentDay?: number;
  overdueDays?: number;
  displayStatus: string;
}

type FilterKey = 'all' | 'vacant' | 'rented' | 'expiring' | 'overdue';

const filters: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'vacant', label: '空着' },
  { key: 'rented', label: '已出租' },
  { key: 'expiring', label: '快到期' },
  { key: 'overdue', label: '欠租' },
];

interface ApiRoom {
  id: number;
  propertyId: number;
  name: string;
  rent: number;
  status: number;
  displayStatus?: string;
  tenantName?: string;
  rentDay?: number;
  overdueDays?: number;
  images?: string[];
  [key: string]: any;
}

export default function RoomList() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [propertyName, setPropertyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const propertyId = Number(Taro.getCurrentInstance().router?.params?.propertyId) || 0;

  const loadData = async () => {
    if (!propertyId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await get<{ rooms: ApiRoom[]; propertyName: string }>(`/properties/${propertyId}/rooms`);
      if (res.code === 0 && res.data) {
        setPropertyName(res.data.propertyName || '');
        const enriched: RoomItem[] = (res.data.rooms || []).map((r: ApiRoom) => ({
          ...r,
          displayStatus: r.displayStatus || (r.status === 1 ? 'rented' : 'vacant'),
        })) as RoomItem[];
        setRooms(enriched);
      }
    } catch (err) {
      console.error('[RoomList] 加载房间失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    loadData();
  });

  const goBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  const goToAddRoom = useCallback(() => {
    Taro.navigateTo({ url: `/pages/add-room-photo/index?propertyId=${propertyId}` });
  }, [propertyId]);

  const goToRoomDetail = useCallback((roomId: number) => {
    Taro.navigateTo({ url: `/pages/room-detail/index?roomId=${roomId}&propertyId=${propertyId}` });
  }, [propertyId]);

  const goToRentStats = useCallback(() => {
    Taro.navigateTo({ url: `/pages/rent-stats/index?propertyId=${propertyId}` });
  }, [propertyId]);

  const filteredRooms = useMemo(() => {
    if (activeFilter === 'all') return rooms;
    if (activeFilter === 'vacant') return rooms.filter((r) => r.displayStatus === 'vacant');
    if (activeFilter === 'rented') return rooms.filter((r) => r.displayStatus === 'rented' || r.displayStatus === 'pending_rent');
    if (activeFilter === 'expiring') return rooms.filter((r) => r.displayStatus === 'expiring_soon');
    if (activeFilter === 'overdue') return rooms.filter((r) => r.displayStatus === 'overdue');
    return rooms;
  }, [activeFilter, rooms]);

  const totalRooms = rooms.length;
  const rentedCount = rooms.filter((r) => r.status === 1 || r.displayStatus === 'rented' || r.displayStatus === 'pending_rent').length;
  const vacantCount = rooms.filter((r) => r.status === 0 || r.displayStatus === 'vacant').length;
  const overdueCount = rooms.filter((r) => r.displayStatus === 'overdue').length;

  const monthlyExpected = rooms.reduce((sum, r) => sum + (r.rent || 0), 0);
  const monthlyCollected = rooms
    .filter((r) => r.displayStatus === 'rented')
    .reduce((sum, r) => sum + (r.rent || 0), 0);
  const collectionRate = monthlyExpected > 0 ? `${((monthlyCollected / monthlyExpected) * 100).toFixed(1)}%` : '0%';

  return (
    <View className="page-room-list">
      <NavBar
        title={propertyName || '房间列表'}
        onBack={goBack}
        rightText="+"
        onRightClick={goToAddRoom}
      />

      {/* Quick stats tags */}
      <View className="stats-tags">
        <View className="stat-tag tag-blue">{totalRooms} 间房</View>
        <View className="stat-tag tag-green">{rentedCount} 已租</View>
        <View className="stat-tag tag-gray">{vacantCount} 空着</View>
        {overdueCount > 0 && <View className="stat-tag tag-red">{overdueCount} 欠租</View>}
      </View>

      {/* Stats cards */}
      <View className="stats-row">
        <View className="stat-card-item" onClick={goToRentStats}>
          <Text className="stat-card-value">{monthlyExpected.toLocaleString()}</Text>
          <Text className="stat-card-label">本月应收</Text>
        </View>
        <View className="stat-card-item" onClick={goToRentStats}>
          <Text className="stat-card-value green">{monthlyCollected.toLocaleString()}</Text>
          <Text className="stat-card-label">本月已收</Text>
        </View>
        <View className="stat-card-item" onClick={goToRentStats}>
          <Text className="stat-card-value red">{collectionRate}</Text>
          <Text className="stat-card-label">收款率</Text>
        </View>
      </View>

      {/* Stats button */}
      <View className="stats-link">
        <View className="stats-link-btn" onClick={goToRentStats}>
          <Text className="stats-link-text">查看月度 / 季度 / 年度统计</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <ScrollView className="filter-tabs" scrollX>
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

      {/* Room list */}
      <ScrollView className="rooms-scroll" scrollY>
        {loading && <Loading />}
        {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
        {!loading && !error && (
          <>
            {filteredRooms.length === 0 && rooms.length === 0 && (
              <EmptyState title="还没有房间" description="这处房源还没有房间，先添加一个吧" actionText="添加房间" onAction={goToAddRoom} />
            )}
            {filteredRooms.length === 0 && rooms.length > 0 && (
              <EmptyState
                title={
                  activeFilter === 'all' ? '暂无房间' :
                  activeFilter === 'vacant' ? '所有房间都已租出' :
                  activeFilter === 'rented' ? '没有已出租的房间' :
                  activeFilter === 'overdue' ? '没有欠租的房间，太棒了！' :
                  '暂无匹配的房间'
                }
                description="换个筛选条件试试"
              />
            )}
            {filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room as any}
                onClick={() => goToRoomDetail(room.id)}
              />
            ))}
          </>
        )}

        <View style={{ height: '120px' }} />
      </ScrollView>
    </View>
  );
}
