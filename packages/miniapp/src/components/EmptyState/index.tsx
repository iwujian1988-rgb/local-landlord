import { View, Text } from '@tarojs/components';
import './index.scss';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionText,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="empty-state">
      {icon && <View className="empty-icon">{icon}</View>}
      {!icon && (
        <View className="empty-icon-default">
          <Text style={{ fontSize: '40px', lineHeight: 1, color: 'var(--accent-hover)', opacity: 0.5 }}>🏠</Text>
        </View>
      )}
      <Text className="empty-title">{title}</Text>
      {description && <Text className="empty-desc">{description}</Text>}
      {actionText && onAction && (
        <View className="empty-action" onClick={onAction}>
          <Text className="empty-action-text">{actionText}</Text>
        </View>
      )}
    </View>
  );
}
