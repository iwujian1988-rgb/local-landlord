import { View, Text } from '@tarojs/components';
import './index.scss';

interface LoadingProps {
  /** 加载提示文字，默认"加载中..." */
  text?: string;
  /** 是否全屏居中 */
  fullPage?: boolean;
  /** 是否显示为骨架屏模式 */
  skeleton?: boolean;
}

/**
 * 统一 Loading 组件
 * - 默认显示温暖风 spinner + 加载文字
 * - fullPage 模式下铺满屏幕居中
 * - skeleton 模式下显示骨架屏占位
 */
export default function Loading({ text = '加载中...', fullPage = false, skeleton = false }: LoadingProps) {
  if (skeleton) {
    return (
      <View className={`loading-container ${fullPage ? 'full-page' : ''}`}>
        <View className="skeleton-list">
          <View className="skeleton-card">
            <View className="skeleton-line w-60" />
            <View className="skeleton-line w-80" />
            <View className="skeleton-line w-40" />
          </View>
          <View className="skeleton-card">
            <View className="skeleton-line w-60" />
            <View className="skeleton-line w-80" />
            <View className="skeleton-line w-40" />
          </View>
          <View className="skeleton-card">
            <View className="skeleton-line w-60" />
            <View className="skeleton-line w-80" />
            <View className="skeleton-line w-40" />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className={`loading-container ${fullPage ? 'full-page' : ''}`}>
      <View className="loading-spinner">
        <View className="spinner-dot dot-1" />
        <View className="spinner-dot dot-2" />
        <View className="spinner-dot dot-3" />
      </View>
      <Text className="loading-text">{text}</Text>
    </View>
  );
}
