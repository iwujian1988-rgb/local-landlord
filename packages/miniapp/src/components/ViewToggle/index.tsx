import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import './index.scss';

type ViewMode = 'onboarding' | 'empty' | 'withData';

const MODES: { key: ViewMode; label: string }[] = [
  { key: 'onboarding', label: '首次打开' },
  { key: 'empty', label: '空房间' },
  { key: 'withData', label: '有数据' },
];

export default function ViewToggle() {
  const [active, setActive] = useState<ViewMode>(
    (Taro.getStorageSync('viewMode') as ViewMode) || 'withData'
  );

  // Only show in development environment
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const handleSwitch = (mode: ViewMode) => {
    setActive(mode);
    Taro.setStorageSync('viewMode', mode);
    Taro.showToast({ title: `切换到: ${MODES.find((m) => m.key === mode)?.label}`, icon: 'none', duration: 1200 });
  };

  return (
    <View className="view-toggle">
      {MODES.map((m) => (
        <View
          key={m.key}
          className={`view-toggle-btn ${active === m.key ? 'active' : ''}`}
          onClick={() => handleSwitch(m.key)}
        >
          <Text className="view-toggle-btn-text">{m.label}</Text>
        </View>
      ))}
    </View>
  );
}
