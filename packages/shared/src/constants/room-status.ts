export const ROOM_STATUS_LABELS: Record<number, string> = {
  0: '空着',
  1: '已出租',
};

export const ROOM_DISPLAY_STATUS_LABELS: Record<string, string> = {
  vacant: '空着',
  rented: '已出租',
  pending_rent: '待收租',
  overdue: '已逾期',
  expiring_soon: '即将到期',
};

export const ROOM_DISPLAY_STATUS_COLORS: Record<string, string> = {
  vacant: '#A8C9A8',
  rented: '#7BA37B',
  pending_rent: '#F5D78E',
  overdue: '#C97B7B',
  expiring_soon: '#E8B87D',
};
