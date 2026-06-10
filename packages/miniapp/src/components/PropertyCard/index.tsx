import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { Property } from '@local-landlord/shared';
import Icon from '../Icon';
import './index.scss';

interface PropertyCardProps {
  property: Property;
  onClick?: () => void;
  onDelete?: (id: number) => void;
}

export default function PropertyCard({ property, onClick, onDelete }: PropertyCardProps) {
  const {
    id,
    name,
    address,
    coverImage,
    roomCount = 0,
    rentedCount = 0,
    vacantCount = 0,
    overdueCount = 0,
    monthlyExpected = 0,
  } = property;

  const handleEdit = () => {
    Taro.navigateTo({ url: `/pages/add-property/index?propertyId=${id}` });
  };

  return (
    <View className="property-card" onClick={onClick}>
      <View className="property-header">
        {coverImage ? (
          <Image className="property-thumb" src={coverImage} mode="aspectFill" />
        ) : (
          <View className="property-thumb property-thumb-placeholder">
            <Icon name="building" size={40} color="var(--text-hint)" />
          </View>
        )}
        <View className="property-info">
          <Text className="property-name">{name}</Text>
          {address && <Text className="property-address">{address}</Text>}
        </View>
        <View className="property-actions">
          <View className="property-action-btn" onClick={(e: any) => { e.stopPropagation(); onDelete?.(id); }}>
            <Icon name="trash" size={24} color="var(--text-hint)" />
          </View>
          <View className="property-action-btn" onClick={(e: any) => { e.stopPropagation(); handleEdit(); }}>
            <Icon name="pencil" size={24} color="var(--text-hint)" />
          </View>
        </View>
      </View>
      <View className="property-stats">
        <View className="property-stat">
          <Text className="property-stat-num stat-accent">{roomCount}</Text>
          <Text className="property-stat-label">房间</Text>
        </View>
        <View className="property-stat">
          <Text className="property-stat-num stat-green">{rentedCount}</Text>
          <Text className="property-stat-label">已租</Text>
        </View>
        <View className="property-stat">
          <Text className="property-stat-num stat-muted">{vacantCount}</Text>
          <Text className="property-stat-label">空着</Text>
        </View>
        {overdueCount > 0 && (
          <View className="property-stat">
            <Text className="property-stat-num stat-red">{overdueCount}</Text>
            <Text className="property-stat-label">欠租</Text>
          </View>
        )}
      </View>
      {monthlyExpected > 0 && (
        <View className="property-rent">
          本月应收 <Text className="property-rent-value">{monthlyExpected.toLocaleString()} 元</Text>
        </View>
      )}
    </View>
  );
}
