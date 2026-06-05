/**
 * 存储工具库（兼容层）
 *
 * 此文件作为迁移期间的兼容层：
 * - 新代码应直接使用 services/cloudDb.ts 中的函数
 * - 此文件保留用于渐进式迁移，最终将被移除
 */
import Taro from '@tarojs/taro';
import {
  fetchProperties,
  createProperty,
  updateProperty,
  deleteProperty,
  fetchRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  fetchTenants,
  createTenant,
  updateTenant,
  deleteTenant,
  fetchBills,
  createBill,
  updateBill,
  deleteBill,
  migrateFromLocalStorage as migrate,
} from '../services/cloudDb';

export interface AppData {
  properties: any[];
  rooms: any[];
  tenants: any[];
  billSettings?: any;
  qrCodes?: any;
  bills?: any[];
  profile?: { name: string; phone: string };
}

/**
 * 从本地缓存读取数据（同步，用于兼容旧代码）
 * 注意：新代码应直接使用 cloudDb.ts 中的 fetchXxx 函数
 */
export function getAppData(): AppData {
  return Taro.getStorageSync('appData') || { properties: [], rooms: [], tenants: [] };
}

/**
 * 写入本地缓存（同步）
 * 注意：新代码应直接使用 cloudDb.ts 中的 createXxx/updateXxx 函数
 * 此函数仅用于迁移期间兼容
 */
export function setAppData(data: AppData): void {
  Taro.setStorageSync('appData', data);
  // 异步同步到云端（不阻塞 UI）
  syncToCloud(data).catch((err) => {
    console.warn('[Storage] 云端同步失败:', err);
  });
}

/**
 * 将本地数据同步到云端（异步）
 * 使用分集合方案，逐实体同步
 */
async function syncToCloud(data: AppData): Promise<void> {
  try {
    // 同步 properties
    for (const prop of data.properties || []) {
      if (prop._id) {
        await updateProperty(prop._id, prop);
      } else {
        await createProperty(prop);
      }
    }
    // 同步 rooms
    for (const room of data.rooms || []) {
      if (room._id) {
        await updateRoom(room._id, room);
      } else {
        await createRoom(room);
      }
    }
    // 同步 tenants
    for (const tenant of data.tenants || []) {
      if (tenant._id) {
        await updateTenant(tenant._id, tenant);
      } else {
        await createTenant(tenant);
      }
    }
    // 同步 bills
    for (const bill of data.bills || []) {
      if (bill._id) {
        await updateBill(bill._id, bill);
      } else {
        await createBill(bill);
      }
    }
  } catch (err) {
    console.warn('[Storage] syncToCloud failed:', err);
    throw err;
  }
}

/**
 * 从云端同步最新数据到本地缓存
 * 在 app onLaunch 时调用
 */
export async function syncFromCloud(): Promise<void> {
  try {
    const [properties, rooms, tenants, bills] = await Promise.all([
      fetchProperties(),
      fetchRooms(),
      fetchTenants(),
      fetchBills(),
    ]);

    const appData: AppData = {
      properties,
      rooms,
      tenants,
      bills,
    };

    Taro.setStorageSync('appData', appData);
  } catch (err) {
    console.warn('[Storage] syncFromCloud failed:', err);
  }
}

/**
 * 从 localStorage 迁移数据到云数据库
 * 在 app onLaunch 时调用（仅在首次迁移时执行）
 */
export async function migrateFromLocalStorage(): Promise<void> {
  return migrate();
}

export default {
  getAppData,
  setAppData,
  syncFromCloud,
  migrateFromLocalStorage,
};
