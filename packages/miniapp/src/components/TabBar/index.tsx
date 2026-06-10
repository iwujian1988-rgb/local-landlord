import { View, Text } from '@tarojs/components';
import type { TabKey } from '../../store/useAppStore';
import './index.scss';

interface TabItem {
  key: TabKey;
  label: string;
  icon: string;
}

interface TabBarProps {
  current: TabKey;
  onSwitch: (tab: TabKey) => void;
}

const tabs: TabItem[] = [
  { key: 'home', label: '首页', icon: 'home' },
  { key: 'rooms', label: '房间', icon: 'rooms' },
  { key: 'rent', label: '收租', icon: 'rent' },
  { key: 'my', label: '我的', icon: 'my' },
];

/* Inline icon components - WeChat mini-program compatible */
const IconHome = ({ active }: { active: boolean }) => (
  <Text style={{ fontSize: '40px', lineHeight: 1, color: active ? 'var(--text-primary)' : 'var(--text-hint)' }}>🏠</Text>
);

const IconRooms = ({ active }: { active: boolean }) => (
  <Text style={{ fontSize: '28px', lineHeight: 1, color: active ? 'var(--text-primary)' : 'var(--text-hint)' }}>🏢</Text>
);

const IconRent = ({ active }: { active: boolean }) => (
  <Text style={{ fontSize: '28px', lineHeight: 1, color: active ? 'var(--text-primary)' : 'var(--text-hint)' }}>💰</Text>
);

const IconMy = ({ active }: { active: boolean }) => (
  <Text style={{ fontSize: '28px', lineHeight: 1, color: active ? 'var(--text-primary)' : 'var(--text-hint)' }}>👤</Text>
);

const iconMap: Record<string, React.FC<{ active: boolean }>> = {
  home: IconHome,
  rooms: IconRooms,
  rent: IconRent,
  my: IconMy,
};

export default function TabBar({ current, onSwitch }: TabBarProps) {
  return (
    <View className="tab-bar">
      {tabs.map((tab) => {
        const isActive = tab.key === current;
        const IconComponent = iconMap[tab.icon];
        return (
          <View
            key={tab.key}
            className={`tab-item${isActive ? ' active' : ''}`}
            onClick={() => onSwitch(tab.key)}
          >
            {IconComponent && <IconComponent active={isActive} />}
            <Text className="tab-label">{tab.label}</Text>
          </View>
        );
      })}
    </View>
  );
}
