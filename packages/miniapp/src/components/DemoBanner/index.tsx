import { View, Text } from '@tarojs/components';
import './index.scss';

export default function DemoBanner() {
  return (
    <View className="demo-banner">
      <Text className="demo-banner-tag">演示</Text>
      <Text className="demo-banner-text">示例数据，登录后管理你自己的房子</Text>
    </View>
  );
}
