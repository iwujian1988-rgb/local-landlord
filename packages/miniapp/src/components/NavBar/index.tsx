import { View, Text } from '@tarojs/components';
import './index.scss';

interface NavBarRightAction {
  icon?: React.ReactNode;
  text?: string;
  onClick?: () => void;
}

interface NavBarProps {
  title: string;
  showBack?: boolean;
  rightText?: string;
  rightActions?: NavBarRightAction[];
  onBack?: () => void;
  onRightClick?: () => void;
}

export default function NavBar({
  title,
  showBack = true,
  rightText,
  rightActions,
  onBack,
  onRightClick,
}: NavBarProps) {
  return (
    <View className="nav-bar">
      <View className="nav-left">
        {showBack && (
          <View className="back-btn" onClick={onBack}>
            <Text style={{ fontSize: '28px', color: 'var(--text-primary)', lineHeight: 1 }}>‹</Text>
          </View>
        )}
      </View>
      <Text className="nav-title">{title}</Text>
      <View className="nav-right">
        {rightActions && rightActions.map((action, idx) => (
          <View key={idx} className="nav-action-btn" onClick={action.onClick}>
            {action.icon || <Text className="nav-right-text">{action.text}</Text>}
          </View>
        ))}
        {rightText && !rightActions && (
          <Text className="nav-right-text" onClick={onRightClick}>
            {rightText}
          </Text>
        )}
      </View>
    </View>
  );
}
