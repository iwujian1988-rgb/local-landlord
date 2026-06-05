import { View, Text } from '@tarojs/components';
import './index.scss';

interface ConfirmModalProps {
  visible: boolean;
  title?: string;
  amount?: number;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible,
  title = '确认已收款',
  amount,
  confirmText = '确认已收',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <View className={`confirm-overlay${visible ? ' show' : ''}`} onClick={onCancel}>
      <View className="confirm-content" onClick={(e) => e.stopPropagation()}>
        <View className="confirm-handle" />

        <View className="confirm-text">
          <Text className="confirm-title">{title}</Text>
          <Text className="confirm-desc">
            确认已收到{' '}
            {amount !== undefined ? (
              <Text className="confirm-amount-highlight">{amount.toLocaleString()} 元</Text>
            ) : (
              <Text className="confirm-amount-highlight">这笔钱</Text>
            )}
            {' '}吗？
          </Text>
        </View>

        <View className="confirm-actions">
          <View className="confirm-btn cancel-btn" onClick={onCancel}>
            取消
          </View>
          <View className="confirm-btn ok-btn" onClick={onConfirm}>
            {confirmText}
          </View>
        </View>
      </View>
    </View>
  );
}
