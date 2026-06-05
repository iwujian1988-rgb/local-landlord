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
          <svg width="52" height="52" viewBox="0 0 24 24" stroke="var(--accent-hover)" strokeWidth="1.8" fill="none" opacity="0.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
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
