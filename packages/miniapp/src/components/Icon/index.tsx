import { View } from '@tarojs/components';
import {
  Send, Copy, Phone, Home, UserPlus, User, DollarSign, Smartphone,
  CreditCard, Clock, FileText, Settings, Trash2, DoorOpen, Pencil,
  Camera, BarChart3, Check, AlertTriangle, MoreHorizontal, Plus,
  QrCode, HelpCircle, Shield, ScrollText, Receipt, Wrench, Key,
  Droplets, Zap, Flame, Wifi, Car, Building2, Brush, Bed,
} from 'lucide-taro-react';

// CSS variables can't be resolved in SVG data URIs, so we map them to actual values
const CSS_VAR_MAP: Record<string, string> = {
  'var(--text-primary)': '#4A4038',
  'var(--text-secondary)': '#7A6F64',
  'var(--text-hint)': '#A89B8C',
  'var(--text-muted)': '#A89B8C',
  'var(--accent)': '#F5D78E',
  'var(--accent-dk)': '#E8C76A',
  'var(--accent-hover)': '#7A6F64',
  'var(--danger)': '#C97B7B',
  'var(--red)': '#C97B7B',
  'var(--green)': '#7BA37B',
  'var(--orange)': '#E8B87D',
  'currentColor': '#4A4038',
};

function resolveColor(color?: string): string | undefined {
  if (!color) return undefined;
  return CSS_VAR_MAP[color] || color;
}

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

const iconMap: Record<string, any> = {
  send: Send, copy: Copy, phone: Phone, home: Home,
  'user-plus': UserPlus, user: User, dollar: DollarSign,
  smartphone: Smartphone, 'credit-card': CreditCard, clock: Clock,
  'file-text': FileText, settings: Settings, trash: Trash2,
  door: DoorOpen, pencil: Pencil, camera: Camera, chart: BarChart3,
  check: Check, warning: AlertTriangle, more: MoreHorizontal,
  plus: Plus, 'qr-code': QrCode, help: HelpCircle, shield: Shield,
  scroll: ScrollText, receipt: Receipt, wrench: Wrench, key: Key,
  droplets: Droplets, zap: Zap, flame: Flame, wifi: Wifi,
  car: Car, building: Building2, brush: Brush, bed: Bed,
};

export default function Icon({ name, size = 24, color, className, style }: IconProps) {
  const IconComponent = iconMap[name];
  if (!IconComponent) return null;
  return (
    <View className={className} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}>
      <IconComponent size={size} color={resolveColor(color)} />
    </View>
  );
}

export { iconMap };
export type IconName = keyof typeof iconMap;
