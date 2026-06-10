import { View, Text } from '@tarojs/components';
import './index.scss';

interface ConfirmModalProps {
  visible: boolean;
  title?: string;
  description?: string;
  amount?: number;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible,
  title = '确认已收款',
  description,
  amount,
  confirmText = '确认已收',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const descText = description
    ?? (amount !== undefined ? `确认已收到 ${amount.toLocaleString()} 元 吗？` : '');

  return (
    <View className={`confirm-overlay${visible ? ' show' : ''}`} onClick={onCancel}>
      <View className="confirm-content" onClick={(e) => e.stopPropagation()}>
        <View className="confirm-handle" />

        <View className="confirm-text">
          <Text className="confirm-title">{title}</Text>
          {descText ? <Text className="confirm-desc">{descText}</Text> : null}
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
