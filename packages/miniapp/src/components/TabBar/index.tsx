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

/* SVG inline icons - 对齐 HTML 原型 */
const IconHome = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" stroke={active ? 'var(--text-primary)' : 'var(--text-hint)'} strokeWidth="1.8" fill="none">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const IconRooms = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" stroke={active ? 'var(--text-primary)' : 'var(--text-hint)'} strokeWidth="1.8" fill="none">
    <rect x="4" y="3" width="16" height="19" rx="1" />
    <line x1="9" y1="3" x2="9" y2="22" />
    <line x1="15" y1="3" x2="15" y2="22" />
    <line x1="4" y1="10" x2="20" y2="10" />
    <line x1="4" y1="16" x2="20" y2="16" />
  </svg>
);

const IconRent = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" stroke={active ? 'var(--text-primary)' : 'var(--text-hint)'} strokeWidth="1.8" fill="none">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const IconMy = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" stroke={active ? 'var(--text-primary)' : 'var(--text-hint)'} strokeWidth="1.8" fill="none">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
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
