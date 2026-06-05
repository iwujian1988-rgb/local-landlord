import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import PropertyCard from '../../components/PropertyCard';
import type { Property } from '@local-landlord/shared';
import EmptyState from '../../components/EmptyState';
import ConfirmModal from '../../components/ConfirmModal';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import { get, del } from '../../services/request';
import { useState } from 'react';
import './index.scss';

export default function Rooms() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await get<Property[]>('/properties');
      if (res.code === 0) {
        setProperties(res.data || []);
      }
    } catch (err) {
      console.error('[Rooms] 加载房源失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    loadData();
  });

  const goToAddProperty = () => {
    Taro.navigateTo({ url: '/pages/add-property/index' });
  };

  const goToRoomList = (propertyId: number) => {
    Taro.navigateTo({ url: `/pages/room-list/index?propertyId=${propertyId}` });
  };

  const handleDeleteProperty = async () => {
    setDeleteVisible(false);
    try {
      await del(`/properties/${deleteTarget}`);
      Taro.showToast({ title: '已删除，页面即将刷新', icon: 'none', duration: 1500 });
      loadData();
    } catch (err) {
      console.error('[Rooms] 删除房源失败:', err);
      Taro.showToast({ title: '删除失败', icon: 'none' });
    }
  };

  return (
    <View className="page-rooms">
      <NavBar
        title="我的房源"
        showBack={false}
        rightActions={[
          {
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" stroke="var(--text-secondary)" strokeWidth="1.8" fill="none">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            ),
            onClick: goToAddProperty,
          },
        ]}
      />

      <ScrollView className="rooms-scroll" scrollY>
        {loading && <Loading />}
        {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
        {!loading && !error && (
          <>
            {properties.length === 0 && (
              <EmptyState title="还没有房源" description="添加第一套房源，开始管理您的房子" actionText="去添加房源" onAction={goToAddProperty} />
            )}
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onClick={() => goToRoomList(property.id)}
                onLongPress={() => { setDeleteTarget(property.id); setDeleteVisible(true); }}
              />
            ))}

            {/* Add Property Card */}
            <View className="add-property-card" onClick={goToAddProperty}>
              <svg width="28" height="28" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth="1.8" fill="none" opacity="0.4">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <Text className="add-property-text">添加新房源</Text>
            </View>
            <View style={{ height: '160px' }} />
          </>
        )}
      </ScrollView>

      <ConfirmModal
        visible={deleteVisible}
        title="确认删除该房源？"
        confirmText="确认删除"
        onConfirm={handleDeleteProperty}
        onCancel={() => setDeleteVisible(false)}
      />
    </View>
  );
}
