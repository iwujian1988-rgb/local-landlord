import { View, Text } from '@tarojs/components';
import './index.scss';

interface ErrorStateProps {
  /** 错误标题，默认"出了点问题" */
  title?: string;
  /** 错误描述 */
  description?: string;
  /** 重试按钮文字，默认"点此重试" */
  retryText?: string;
  /** 备用操作按钮文字 */
  actionText?: string;
  /** 重试回调 */
  onRetry?: () => void;
  /** 备用操作回调 */
  onAction?: () => void;
  /** 是否全屏居中 */
  fullPage?: boolean;
}

/**
 * 统一错误态组件
 * - 显示友好的错误图标、标题、描述
 * - 优先显示"重试"按钮，其次备用操作按钮
 * - 温暖有机风格，适老化大字号和大按钮
 */
export default function ErrorState({
  title = '出了点问题',
  description = '网络不稳定，请稍后重试',
  retryText = '点此重试',
  actionText,
  onRetry,
  onAction,
  fullPage = false,
}: ErrorStateProps) {
  return (
    <View className={`error-state ${fullPage ? 'full-page' : ''}`}>
      <View className="error-icon-wrap">
        <Text style={{ fontSize: '28px', lineHeight: 1, color: 'var(--text-hint, #A89B8C)', opacity: 0.4 }}>🕐</Text>
      </View>
      <Text className="error-title">{title}</Text>
      {description && <Text className="error-desc">{description}</Text>}
      <View className="error-actions">
        {onRetry && (
          <View className="error-btn retry-btn" onClick={onRetry}>
            <Text className="error-btn-text">{retryText}</Text>
          </View>
        )}
        {onAction && (
          <View className="error-btn action-btn" onClick={onAction}>
            <Text className="error-btn-text">{actionText}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
