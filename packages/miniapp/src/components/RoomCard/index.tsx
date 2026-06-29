import { View, Text, Image } from '@tarojs/components';
import type { Room } from '@local-landlord/shared';
import { resolveAsset } from '../../config';
import './index.scss';

interface RoomCardProps {
  room: Room & {
    tenantName?: string;
    rentDay?: number;
    overdueDays?: number;
    displayStatus?: string;
  };
  onClick?: () => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  vacant: { label: '空着', className: 'tag-gray' },
  rented: { label: '已租', className: 'tag-green' },
  pending_rent: { label: '待收租', className: 'tag-orange' },
  overdue: { label: '欠租', className: 'tag-red' },
  expiring_soon: { label: '快到期', className: 'tag-orange' },
};

export default function RoomCard({ room, onClick }: RoomCardProps) {
  const status = statusConfig[room.displayStatus || ''] || statusConfig.rented;
  const imageSrc = room.images?.[0] || '';

  return (
    <View className="room-card card" onClick={onClick}>
      <View className="room-card-body">
        {imageSrc ? (
          <Image className="room-card-img" src={resolveAsset(imageSrc)} mode="aspectFill" />
        ) : (
          <View className="room-card-img room-card-img-placeholder">
            <Text style={{ fontSize: '40px', lineHeight: 1, color: '#B5A99A' }}>🏠</Text>
          </View>
        )}
        <View className="room-card-info">
          <View className="room-card-header">
            <Text className="room-card-name">{room.name}</Text>
            <Text className={`tag ${status.className}`}>{status.label}</Text>
          </View>
          <Text className="room-card-rent">{room.rent.toLocaleString()} 元/月</Text>
          {room.tenantName && (
            <Text className="room-card-tenant">
              {room.tenantName}
              {room.rentDay ? ` · 每月 ${room.rentDay} 号收租` : ''}
              {room.overdueDays != null && room.overdueDays > 0
                ? ` · 已晚 ${room.overdueDays} 天`
                : ''}
            </Text>
          )}
          {!room.tenantName && room.displayStatus === 'vacant' && (
            <Text className="room-card-tenant room-card-vacant">随时可入住</Text>
          )}
        </View>
      </View>
    </View>
  );
}
