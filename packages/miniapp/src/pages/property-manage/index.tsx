import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { get, del } from '../../services/request';
import Icon from '../../components/Icon';
import EmptyState from '../../components/EmptyState';
import ConfirmModal from '../../components/ConfirmModal';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import './index.scss';

interface Property {
  id: number;
  name: string;
  address?: string;
  coverImage?: string;
  note?: string;
  roomCount?: number;
  rentedCount?: number;
  vacantCount?: number;
}

type ListResponse<T> = T[] | { list?: T[] };

export default function PropertyManage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number>(0);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await get<ListResponse<Property>>('/properties');
      if (res.code === 0) {
        const list = Array.isArray(res.data) ? res.data : (res.data?.list || []);
        setProperties(list);
      }
    } catch (err) {
      console.error('[PropertyManage] 加载房源失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '房源管理' });
    loadData();
  });

  const handleDelete = async () => {
    setDeleteVisible(false);
    try {
      await del(`/properties/${deleteTarget}`);
      Taro.showToast({ title: '已删除', icon: 'none', duration: 1500 });
      loadData();
    } catch (err) {
      console.error('[PropertyManage] 删除房源失败:', err);
      Taro.showToast({ title: '删除失败', icon: 'none' });
    }
  };

  return (
    <View className="page-property-manage">
      <ScrollView className="pm-scroll" scrollY>
        {loading && <Loading />}
        {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
        {!loading && !error && (
          <>
            {properties.length === 0 ? (
              <EmptyState
                title="还没有房源"
                description="添加第一个房源开始管理"
                actionText="添加房源"
                onAction={() => Taro.navigateTo({ url: '/pages/add-property/index' })}
              />
            ) : (
              <>
                {properties.map((p) => (
                  <View key={p.id} className="pm-card">
                    <View
                      className="pm-card-main"
                      onClick={() => Taro.navigateTo({ url: `/pages/add-property/index?propertyId=${p.id}` })}
                    >
                      <View className="pm-card-top">
                        <Text className="pm-card-name">{p.name}</Text>
                      </View>
                      {p.address && (
                        <Text className="pm-card-addr">{p.address}</Text>
                      )}
                      <View className="pm-card-stats">
                        <Text className="pm-card-stat">{p.roomCount || 0}间房</Text>
                        {((p.rentedCount || 0) > 0) && (
                          <Text className="pm-card-stat rented">已租{p.rentedCount}</Text>
                        )}
                        {((p.vacantCount || 0) > 0) && (
                          <Text className="pm-card-stat vacant">空{p.vacantCount}</Text>
                        )}
                      </View>
                    </View>
                    <View className="pm-card-actions">
                      <Text
                        className="pm-card-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(p.id);
                          setDeleteVisible(true);
                        }}
                      >
                        删除
                      </Text>
                      <Text
                        style={{ fontSize: '24px', color: 'var(--text-hint)', lineHeight: 1 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          Taro.navigateTo({ url: `/pages/add-property/index?propertyId=${p.id}` });
                        }}
                      >
                        编辑
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      <View className="pm-fab" onClick={() => Taro.navigateTo({ url: '/pages/add-property/index' })}>
        <Icon name="plus" size={40} color="#fff" />
      </View>

      <ConfirmModal
        visible={deleteVisible}
        title="确认删除该房源？"
        description="房源下的房间也会一起删除，删除后不可恢复"
        confirmText="确认删除"
        onConfirm={handleDelete}
        onCancel={() => setDeleteVisible(false)}
      />
    </View>
  );
}
