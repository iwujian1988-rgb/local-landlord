import Taro from '@tarojs/taro';
import { useAuthStore } from '../store/useAuthStore';

// Client-side demo dataset for logged-out browsing (guests & reviewers).
// Purely static — no server calls — and always rendered under a visible
// 演示 banner. Shapes mirror the API payloads each page normally consumes
// (rooms page Room/Property, rent-list PendingResponse/BillRow/SingleChargeRow).

export function promptDemoLogin(): void {
  Taro.showModal({
    title: '登录后使用',
    content: '这是演示数据。微信一键登录后，就能管理你自己的房子了',
    confirmText: '去登录',
    cancelText: '继续逛逛',
    success: (res) => {
      if (!res.confirm) return;
      useAuthStore
        .getState()
        .login()
        .catch(() => Taro.showToast({ title: '登录没成功，稍后再试', icon: 'none', duration: 2000 }));
    },
  });
}

export const DEMO_PROPERTIES = [
  { id: 901, name: '幸福小区3栋', address: '登录后添加你自己的房源' },
  { id: 902, name: '临街商铺', address: '' },
];

export const DEMO_ROOMS = [
  { id: 9011, name: '3栋-201', rent: 1500, status: 1, displayStatus: 'rented', propertyId: 901, propertyName: '幸福小区3栋', tenantName: '王女士', images: [] as string[] },
  { id: 9012, name: '3栋-202', rent: 1800, status: 1, displayStatus: 'overdue', overdueDays: 6, propertyId: 901, propertyName: '幸福小区3栋', tenantName: '张先生', images: [] as string[] },
  { id: 9013, name: '3栋-301', rent: 1600, status: 1, displayStatus: 'approaching', propertyId: 901, propertyName: '幸福小区3栋', tenantName: '李阿姨', images: [] as string[] },
  { id: 9014, name: '3栋-302', rent: 2000, status: 1, displayStatus: 'rented', propertyId: 901, propertyName: '幸福小区3栋', tenantName: '周师傅', images: [] as string[] },
  { id: 9015, name: '3栋-501', rent: 1600, status: 0, displayStatus: 'vacant', propertyId: 901, propertyName: '幸福小区3栋', images: [] as string[] },
  { id: 9021, name: '商铺-1F', rent: 3500, status: 1, displayStatus: 'rented', propertyId: 902, propertyName: '临街商铺', tenantName: '陈老板', images: [] as string[] },
];

interface DemoEntry {
  roomId: number;
  roomName: string;
  propertyName: string;
  propertyId: number;
  rent: number;
  tenantName: string;
  tenantId: number;
  contractEndDate: string;
  rentDay: number;
  payMonths: number;
  billId: number | null;
  billStatus: number;
  billPeriod: string | null;
  billPeriodEnd: string | null;
  totalAmount: number;
  paidAmount: number;
  overdueDays: number;
  daysUntil: number;
  hasOverdue: boolean;
  nextDueMonth: string | null;
}

const entry = (e: Partial<DemoEntry> & Pick<DemoEntry, 'roomId' | 'roomName' | 'propertyName' | 'propertyId' | 'rent' | 'tenantName' | 'totalAmount'>): DemoEntry => ({
  tenantId: 1,
  contractEndDate: '2026-12-31',
  rentDay: 5,
  payMonths: 1,
  billId: null,
  billStatus: 0,
  billPeriod: '2026-08',
  billPeriodEnd: null,
  paidAmount: 0,
  overdueDays: 0,
  daysUntil: 0,
  hasOverdue: false,
  nextDueMonth: null,
  ...e,
});

export const DEMO_PENDING = {
  overdue: [
    entry({ roomId: 9012, roomName: '3栋-202', propertyName: '幸福小区3栋', propertyId: 901, rent: 1800, tenantName: '张先生', totalAmount: 1800, overdueDays: 6, billStatus: 2 }),
  ],
  today: [
    entry({ roomId: 9021, roomName: '商铺-1F', propertyName: '临街商铺', propertyId: 902, rent: 3500, tenantName: '陈老板', totalAmount: 3500 }),
  ],
  approaching: [
    entry({ roomId: 9013, roomName: '3栋-301', propertyName: '幸福小区3栋', propertyId: 901, rent: 1600, tenantName: '李阿姨', totalAmount: 1600, daysUntil: 3 }),
  ],
  completed: [
    entry({ roomId: 9011, roomName: '3栋-201', propertyName: '幸福小区3栋', propertyId: 901, rent: 1500, tenantName: '王女士', totalAmount: 1500, billId: 9101, billStatus: 1, paidAmount: 1500 }),
  ],
  upcoming: [
    entry({ roomId: 9014, roomName: '3栋-302', propertyName: '幸福小区3栋', propertyId: 901, rent: 2000, tenantName: '周师傅', totalAmount: 6000, nextDueMonth: '9月5日', payMonths: 3, billPeriod: null }),
  ],
};

export const DEMO_SUMMARY = { totalExpected: 8400, totalCollected: 1500, totalPending: 6900 };

export const DEMO_BILLS = [
  { billId: 9102, roomId: 9012, roomName: '3栋-202', propertyName: '幸福小区3栋', tenantId: 1, tenantName: '张先生', period: '2026-08', periodEnd: null, totalAmount: 1800, paidAmount: 0, status: 2, paidAt: null, createdAt: '2026-08-05' },
  { billId: 9103, roomId: 9021, roomName: '商铺-1F', propertyName: '临街商铺', tenantId: 2, tenantName: '陈老板', period: '2026-08', periodEnd: null, totalAmount: 3500, paidAmount: 0, status: 0, paidAt: null, createdAt: '2026-08-05' },
  { billId: 9104, roomId: 9013, roomName: '3栋-301', propertyName: '幸福小区3栋', tenantId: 3, tenantName: '李阿姨', period: '2026-08', periodEnd: null, totalAmount: 1600, paidAmount: 0, status: 0, paidAt: null, createdAt: '2026-08-05' },
  { billId: 9101, roomId: 9011, roomName: '3栋-201', propertyName: '幸福小区3栋', tenantId: 4, tenantName: '王女士', period: '2026-08', periodEnd: null, totalAmount: 1500, paidAmount: 1500, status: 1, paidAt: '2026-08-06', createdAt: '2026-08-05' },
];

export const DEMO_SINGLE_CHARGES = [
  { id: 9201, roomId: 9011, roomName: '3栋-201', propertyName: '幸福小区3栋', tenantName: '王女士', feeType: '水电费', amount: 86, note: '8月水电', status: 0, paidAt: null, createdAt: '2026-08-20' },
];
