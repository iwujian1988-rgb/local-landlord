import { View, Image } from '@tarojs/components';
import { ICON_SVGS } from './icons';

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

const NAME_TO_KEY: Record<string, string> = {
  send: 'Send', copy: 'Copy', phone: 'Phone', home: 'Home',
  'user-plus': 'UserPlus', user: 'User', dollar: 'DollarSign',
  smartphone: 'Smartphone', 'credit-card': 'CreditCard', clock: 'Clock',
  'file-text': 'FileText', settings: 'Settings', trash: 'Trash2',
  door: 'DoorOpen', pencil: 'Pencil', camera: 'Camera', chart: 'BarChart3',
  check: 'Check', warning: 'AlertTriangle', more: 'MoreHorizontal',
  plus: 'Plus', 'qr-code': 'QrCode', help: 'HelpCircle', shield: 'Shield',
  scroll: 'ScrollText', receipt: 'Receipt', wrench: 'Wrench', key: 'Key',
  droplets: 'Droplets', zap: 'Zap', flame: 'Flame', wifi: 'Wifi',
  car: 'Car', building: 'Building2', brush: 'Brush', bed: 'Bed',
};

// UTF-8 safe base64 encoder. The mini-program runtime lacks btoa() and
// TextEncoder, so we encode manually. SVG strings only contain ASCII paths
// in practice, but we still go through UTF-8 to be safe if a color hex
// contains a non-ASCII byte (it can't, but defensive).
function utf8Bytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) {
      bytes.push(0xc0 | (c >> 6));
      bytes.push(0x80 | (c & 0x3f));
    } else {
      bytes.push(0xe0 | (c >> 12));
      bytes.push(0x80 | ((c >> 6) & 0x3f));
      bytes.push(0x80 | (c & 0x3f));
    }
  }
  return bytes;
}

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64Encode(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64_CHARS[b1 >> 2];
    out += B64_CHARS[((b1 & 0x03) << 4) | (b2 >> 4)];
    out += i + 1 < bytes.length ? B64_CHARS[((b2 & 0x0f) << 2) | (b3 >> 6)] : '=';
    out += i + 2 < bytes.length ? B64_CHARS[b3 & 0x3f] : '=';
  }
  return out;
}

const dataUriCache = new Map<string, string>();

function buildDataUri(key: string, color: string | undefined): string | null {
  const svg = ICON_SVGS[key];
  if (!svg) return null;
  const cacheKey = key + '|' + (color || '');
  const cached = dataUriCache.get(cacheKey);
  if (cached) return cached;
  const colored = color ? svg.replace(/stroke="currentColor"/g, `stroke="${color}"`) : svg;
  const uri = 'data:image/svg+xml;base64,' + base64Encode(utf8Bytes(colored));
  dataUriCache.set(cacheKey, uri);
  return uri;
}

const iconMap: Record<string, true> = {};
for (const k of Object.keys(NAME_TO_KEY)) iconMap[k] = true;

export default function Icon({ name, size = 24, color, className, style }: IconProps) {
  const key = NAME_TO_KEY[name];
  if (!key) return null;
  const uri = buildDataUri(key, resolveColor(color));
  if (!uri) return null;
  return (
    <View className={className} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}>
      <Image src={uri} style={{ width: `${size}px`, height: `${size}px` }} mode="aspectFit" />
    </View>
  );
}

export { iconMap };
export type IconName = keyof typeof iconMap;
