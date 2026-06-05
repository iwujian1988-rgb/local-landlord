import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { Property } from '@local-landlord/shared';
import './index.scss';

interface PropertyCardProps {
  property: Property;
  onClick?: () => void;
  onLongPress?: () => void;
}

export default function PropertyCard({ property, onClick, onLongPress }: PropertyCardProps) {
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
    <View className="property-card" onClick={onClick} onLongPress={onLongPress}>
      <View className="property-header">
        {coverImage ? (
          <Image className="property-thumb" src={coverImage} mode="aspectFill" />
        ) : (
          <View className="property-thumb property-thumb-placeholder">
            <svg width="28" height="28" viewBox="0 0 24 24" stroke="#B5A99A" strokeWidth="1.8" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </View>
        )}
        <View className="property-info">
          <Text className="property-name">{name}</Text>
          {address && <Text className="property-address">{address}</Text>}
        </View>
        <View className="property-edit-btn" onClick={(e: any) => { e.stopPropagation(); handleEdit(); }} onLongPress={(e: any) => { e.stopPropagation(); handleEdit(); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth="1.8" fill="none">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
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
