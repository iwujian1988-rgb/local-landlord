import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import EmptyState from '../../components/EmptyState';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import { get } from '../../services/request';
import { useState } from 'react';
import roomPlaceholder from '../../assets/rooms/room-placeholder.png';
import './index.scss';

interface Room {
  id: number;
  name: string;
  rent: number;
  status: number;
  propertyId: number;
  propertyName?: string;
  tenantName?: string;
  images?: string[];
}

interface Property {
  id: number;
  name: string;
  address?: string;
}

export default function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const [roomsRes, propsRes] = await Promise.all([
        get<Room[]>('/rooms'),
        get<Property[]>('/properties'),
      ]);
      if (roomsRes.code === 0) {
        setRooms(roomsRes.data || []);
      }
      if (propsRes.code === 0) {
        const list = Array.isArray(propsRes.data) ? propsRes.data : (propsRes.data?.list || []);
        setProperties(list);
      }
    } catch (err) {
      console.error('[Rooms] 加载房间失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '房间' });
    loadData();
  });

  const goToAddProperty = () => {
    if (properties.length > 0) {
      setPickerVisible(true);
    } else {
      Taro.navigateTo({ url: '/pages/add-property/index' });
    }
  };

  const selectProperty = (pid: number) => {
    setPickerVisible(false);
    Taro.navigateTo({ url: `/pages/add-room-info/index?propertyId=${pid}` });
  };

  const goToNewProperty = () => {
    setPickerVisible(false);
    Taro.navigateTo({ url: '/pages/add-property/index' });
  };

  const statusText = (status: number) => status === 1 ? '已出租' : '空着';
  const statusClass = (status: number) => status === 1 ? 'rented' : 'vacant';

  return (
    <View className="page-rooms">
      <ScrollView className="rooms-scroll" scrollY>
        {loading && <Loading />}
        {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
        {!loading && !error && (
          <>
            {rooms.length === 0 ? (
              <EmptyState title="还没有房间" description="添加房源后可以创建房间" actionText="去添加房源" onAction={goToAddProperty} />
            ) : (
              <>
                {rooms.map((room) => (
                  <View
                    key={room.id}
                    className="room-card"
                    onClick={() => Taro.navigateTo({ url: `/pages/room-detail/index?roomId=${room.id}` })}
                  >
                    <Image className="room-card-img" src={(room.images && room.images.length > 0) ? room.images[0] : roomPlaceholder} mode="aspectFill" />
                    <View className="room-card-main">
                      <View className="room-card-top">
                        <Text className="room-card-name">{room.name}</Text>
                        <View className={`room-status ${statusClass(room.status)}`}>
                          <Text>{statusText(room.status)}</Text>
                        </View>
                      </View>
                      <View className="room-card-meta">
                        {room.propertyName && (
                          <Text className="room-card-property">{room.propertyName}</Text>
                        )}
                        {room.tenantName && (
                          <Text className="room-card-tenant">· {room.tenantName}</Text>
                        )}
                        <Text className="room-card-rent">{room.rent}元/月</Text>
                      </View>
                    </View>
                    <Text className="room-card-arrow">›</Text>
                  </View>
                ))}
              </>
            )}
            <View style={{ height: '160px' }} />
          </>
        )}
      </ScrollView>

      {rooms.length > 0 && (
        <View className="fab-add" onClick={goToAddProperty}>
          <Text style={{ fontSize: '64px', lineHeight: 1, color: '#fff', fontWeight: 200 }}>+</Text>
        </View>
      )}

      <View className={`confirm-overlay${pickerVisible ? ' show' : ''}`} onClick={() => setPickerVisible(false)}>
        <View className="confirm-content property-picker-content" onClick={(e) => e.stopPropagation()}>
          <View className="confirm-handle" />
          <Text className="property-picker-title">选择房源</Text>
          <View className="property-picker-list">
            {properties.map((p) => (
              <View key={p.id} className="property-picker-item" onClick={() => selectProperty(p.id)}>
                <View className="property-picker-item-main">
                  <Text className="property-picker-item-name">{p.name}</Text>
                  {p.address && <Text className="property-picker-item-addr">{p.address}</Text>}
                </View>
                <Text style={{ fontSize: '24px', color: 'var(--text-hint)', lineHeight: 1 }}>›</Text>
              </View>
            ))}
            <View className="property-picker-item property-picker-new" onClick={goToNewProperty}>
              <Text className="property-picker-item-name" style={{ color: 'var(--accent-dk)' }}>新建房源</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
