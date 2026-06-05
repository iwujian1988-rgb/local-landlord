/**
 * 云数据库服务层（分集合方案）
 *
 * 集合设计：
 *
 * ## properties（房源）
 * - _id: 自动生成
 * - _openid: 自动注入（数据隔离）
 * - name: string, 必填
 * - address: string
 * - note: string
 * - coverImage: string (云存储文件 ID)
 * - createdAt: Date
 * - updatedAt: Date
 *
 * ## rooms（房间）
 * - _id: 自动生成
 * - _openid: 自动注入
 * - propertyId: string（关联 properties._id）
 * - name: string（如 "101"）
 * - status: 'vacant' | 'occupied'
 * - tenantId: string（关联 tenants._id，可选）
 * - photos: string[]（云存储文件 ID 数组）
 * - createdAt: Date
 * - updatedAt: Date
 *
 * ## tenants（租客）
 * - _id: 自动生成
 * - _openid: 自动注入
 * - name: string
 * - phone: string
 * - roomId: string（关联 rooms._id）
 * - leaseStart: string（ISO 日期）
 * - leaseEnd: string（ISO 日期）
 * - createdAt: Date
 * - updatedAt: Date
 *
 * ## bills（账单）
 * - _id: 自动生成
 * - _openid: 自动注入
 * - roomId: string
 * - tenantId: string
 * - amount: number
 * - type: string（'rent' | 'water' | 'electricity' | ...）
 * - status: 'pending' | 'paid'
 * - dueDate: string（ISO 日期）
 * - paidAt: string（ISO 日期，可选）
 * - createdAt: Date
 * - updatedAt: Date
 *
 * ## bill_settings（账单设置）
 * - _id: 自动生成
 * - _openid: 自动注入
 * - propertyId: string
 * - waterRate: number
 * - electricityRate: number
 * - ...
 *
 * ## profile（房东个人信息）
 * - _id: 自动生成
 * - _openid: 自动注入
 * - name: string
 * - phone: string
 *
 * 索引：每个集合的 _openid 字段需要建索引（云开发自动创建）
 */
import Taro from '@tarojs/taro';
import { useAuthStore } from '../store/useAuthStore';

/**
 * 为 Promise 添加超时控制
 * @param promise 原始 Promise
 * @param ms 超时毫秒数，默认 8s
 * @param msg 超时错误信息
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number = 8000,
  msg: string = 'cloud timeout'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(msg)), ms)
    ),
  ]);
}

// 集合名称常量
const COLLECTIONS = {
  PROPERTIES: 'properties',
  ROOMS: 'rooms',
  TENANTS: 'tenants',
  BILLS: 'bills',
  BILL_SETTINGS: 'bill_settings',
  PROFILE: 'profile',
};

// 离线操作队列项
interface OfflineOp {
  collection: string;
  action: 'create' | 'update' | 'delete';
  docId?: string;
  data?: any;
  timestamp: number;
}

// 检查云开发是否可用
function isCloudAvailable(): boolean {
  return !!(typeof wx !== 'undefined' && wx.cloud && wx.cloud.database);
}

// 获取数据库实例
function getDB() {
  return wx.cloud.database();
}

// 获取集合引用
function getCollection(name: string) {
  return getDB().collection(name);
}

// 获取当前用户 openid
function getOpenid(): string {
  return useAuthStore.getState().openid || Taro.getStorageSync('openid') || '';
}

// ==================== 通用 CRUD 封装 ====================

/**
 * 创建文档
 */
async function createDoc(collection: string, data: any): Promise<string> {
  if (!isCloudAvailable()) {
    queueOfflineOp({ collection, action: 'create', data, timestamp: Date.now() });
    throw new Error('云端不可用，操作已加入离线队列');
  }

  try {
    const coll = getCollection(collection);
    const now = new Date();
    const res = await withTimeout(coll.add({
      ...data,
      createdAt: now,
      updatedAt: now,
    }), 10000, 'createDoc timeout');
    return res._id;
  } catch (err: any) {
    console.error(`[CloudDB] createDoc(${collection}) failed:`, err);
    queueOfflineOp({ collection, action: 'create', data, timestamp: Date.now() });
    throw err;
  }
}

/**
 * 查询文档列表
 */
async function fetchDocs(
  collection: string,
  where?: Record<string, any>,
  orderBy?: { field: string; direction: 'asc' | 'desc' }
): Promise<any[]> {
  if (!isCloudAvailable()) {
    console.warn(`[CloudDB] fetchDocs(${collection}) - cloud not available`);
    return [];
  }

  try {
    let query: any = getCollection(collection);
    
    if (where) {
      for (const key of Object.keys(where)) {
        query = query.where({ [key]: where[key] });
      }
    }
    
    if (orderBy) {
      query = query.orderBy(orderBy.field, orderBy.direction);
    }
    
    const res = await withTimeout(query.get(), 8000, 'fetchDocs timeout');
    return res.data || [];
  } catch (err: any) {
    console.error(`[CloudDB] fetchDocs(${collection}) failed:`, err);
    return [];
  }
}

/**
 * 更新文档
 */
async function updateDoc(collection: string, docId: string, data: any): Promise<void> {
  if (!isCloudAvailable()) {
    queueOfflineOp({ collection, action: 'update', docId, data, timestamp: Date.now() });
    throw new Error('云端不可用，操作已加入离线队列');
  }

  try {
    const coll = getCollection(collection);
    await withTimeout(coll.doc(docId).update({
      ...data,
      updatedAt: new Date(),
    }), 10000, 'updateDoc timeout');
  } catch (err: any) {
    console.error(`[CloudDB] updateDoc(${collection}, ${docId}) failed:`, err);
    queueOfflineOp({ collection, action: 'update', docId, data, timestamp: Date.now() });
    throw err;
  }
}

/**
 * 删除文档
 */
async function deleteDoc(collection: string, docId: string): Promise<void> {
  if (!isCloudAvailable()) {
    queueOfflineOp({ collection, action: 'delete', docId, timestamp: Date.now() });
    throw new Error('云端不可用，操作已加入离线队列');
  }

  try {
    const coll = getCollection(collection);
    await withTimeout(coll.doc(docId).remove(), 10000, 'deleteDoc timeout');
  } catch (err: any) {
    console.error(`[CloudDB] deleteDoc(${collection}, ${docId}) failed:`, err);
    queueOfflineOp({ collection, action: 'delete', docId, timestamp: Date.now() });
    throw err;
  }
}

// ==================== 离线队列管理 ====================

function getOfflineQueue(): OfflineOp[] {
  try {
    return Taro.getStorageSync('_cloud_offline_queue') || [];
  } catch {
    return [];
  }
}

function setOfflineQueue(queue: OfflineOp[]): void {
  Taro.setStorageSync('_cloud_offline_queue', queue);
}

function queueOfflineOp(op: OfflineOp): void {
  const queue = getOfflineQueue();
  queue.push(op);
  setOfflineQueue(queue);
}

/**
 * 处理离线队列：将积压的写入同步到云端
 */
export async function flushOfflineQueue(): Promise<number> {
  if (!isCloudAvailable()) return 0;

  const openid = getOpenid();
  if (!openid) return 0;

  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  let synced = 0;
  const remaining: OfflineOp[] = [];

  for (const op of queue) {
    try {
      if (op.action === 'create') {
        await createDoc(op.collection, op.data);
      } else if (op.action === 'update') {
        await updateDoc(op.collection, op.docId!, op.data);
      } else if (op.action === 'delete') {
        await deleteDoc(op.collection, op.docId!);
      }
      synced++;
    } catch {
      remaining.push(op);
    }
  }

  setOfflineQueue(remaining);
  return synced;
}

// ==================== Properties 服务 ====================

export async function createProperty(data: any): Promise<string> {
  return createDoc(COLLECTIONS.PROPERTIES, data);
}

export async function fetchProperties(): Promise<any[]> {
  return fetchDocs(COLLECTIONS.PROPERTIES, undefined, { field: 'createdAt', direction: 'desc' });
}

export async function updateProperty(id: string, data: any): Promise<void> {
  return updateDoc(COLLECTIONS.PROPERTIES, id, data);
}

export async function deleteProperty(id: string): Promise<void> {
  return deleteDoc(COLLECTIONS.PROPERTIES, id);
}

// ==================== Rooms 服务 ====================

export async function createRoom(data: any): Promise<string> {
  return createDoc(COLLECTIONS.ROOMS, data);
}

export async function fetchRooms(propertyId?: string): Promise<any[]> {
  const where = propertyId ? { propertyId } : undefined;
  return fetchDocs(COLLECTIONS.ROOMS, where, { field: 'createdAt', direction: 'desc' });
}

export async function updateRoom(id: string, data: any): Promise<void> {
  return updateDoc(COLLECTIONS.ROOMS, id, data);
}

export async function deleteRoom(id: string): Promise<void> {
  return deleteDoc(COLLECTIONS.ROOMS, id);
}

// ==================== Tenants 服务 ====================

export async function createTenant(data: any): Promise<string> {
  return createDoc(COLLECTIONS.TENANTS, data);
}

export async function fetchTenants(roomId?: string): Promise<any[]> {
  const where = roomId ? { roomId } : undefined;
  return fetchDocs(COLLECTIONS.TENANTS, where, { field: 'createdAt', direction: 'desc' });
}

export async function updateTenant(id: string, data: any): Promise<void> {
  return updateDoc(COLLECTIONS.TENANTS, id, data);
}

export async function deleteTenant(id: string): Promise<void> {
  return deleteDoc(COLLECTIONS.TENANTS, id);
}

// ==================== Bills 服务 ====================

export async function createBill(data: any): Promise<string> {
  return createDoc(COLLECTIONS.BILLS, data);
}

export async function fetchBills(roomId?: string): Promise<any[]> {
  const where = roomId ? { roomId } : undefined;
  return fetchDocs(COLLECTIONS.BILLS, where, { field: 'createdAt', direction: 'desc' });
}

export async function updateBill(id: string, data: any): Promise<void> {
  return updateDoc(COLLECTIONS.BILLS, id, data);
}

export async function deleteBill(id: string): Promise<void> {
  return deleteDoc(COLLECTIONS.BILLS, id);
}

// ==================== Profile 服务 ====================

export async function fetchProfile(): Promise<any | null> {
  const docs = await fetchDocs(COLLECTIONS.PROFILE);
  return docs.length > 0 ? docs[0] : null;
}

export async function saveProfile(data: any): Promise<string | void> {
  const existing = await fetchProfile();
  if (existing) {
    await updateDoc(COLLECTIONS.PROFILE, existing._id, data);
    return existing._id;
  } else {
    return createDoc(COLLECTIONS.PROFILE, data);
  }
}

// ==================== 数据迁移 ====================

/**
 * 从 localStorage 迁移数据到云数据库
 * 在 app onLaunch 时调用
 */
export async function migrateFromLocalStorage(): Promise<void> {
  if (!isCloudAvailable()) return;

  const openid = getOpenid();
  if (!openid) return;

  try {
    const localData = Taro.getStorageSync('appData');
    if (!localData) return;

    // 迁移 properties
    if (localData.properties && localData.properties.length > 0) {
      const cloudProperties = await fetchProperties();
      for (const prop of localData.properties) {
        // 检查是否已迁移
        const exists = cloudProperties.find((p: any) => p.name === prop.name && p.address === prop.address);
        if (!exists) {
          await createProperty({
            name: prop.name,
            address: prop.address || '',
            note: prop.note || '',
            coverImage: prop.coverImage || '',
          });
        }
      }
    }

    // 迁移 rooms
    if (localData.rooms && localData.rooms.length > 0) {
      const cloudRooms = await fetchRooms();
      for (const room of localData.rooms) {
        const exists = cloudRooms.find((r: any) => r.name === room.name && r.propertyId === room.propertyId);
        if (!exists) {
          await createRoom({
            propertyId: room.propertyId || '',
            name: room.name || '',
            status: room.status || 'vacant',
            tenantId: room.tenantId || '',
            photos: room.photos || [],
          });
        }
      }
    }

    // 迁移 tenants
    if (localData.tenants && localData.tenants.length > 0) {
      const cloudTenants = await fetchTenants();
      for (const tenant of localData.tenants) {
        const exists = cloudTenants.find((t: any) => t.name === tenant.name && t.phone === tenant.phone);
        if (!exists) {
          await createTenant({
            name: tenant.name || '',
            phone: tenant.phone || '',
            roomId: tenant.roomId || '',
            leaseStart: tenant.leaseStart || '',
            leaseEnd: tenant.leaseEnd || '',
          });
        }
      }
    }

    // 迁移完成，清除 localStorage
    Taro.removeStorageSync('appData');
    console.log('[CloudDB] 数据迁移完成');
  } catch (err) {
    console.warn('[CloudDB] 数据迁移失败:', err);
  }
}

export default {
  createProperty,
  fetchProperties,
  updateProperty,
  deleteProperty,
  createRoom,
  fetchRooms,
  updateRoom,
  deleteRoom,
  createTenant,
  fetchTenants,
  updateTenant,
  deleteTenant,
  createBill,
  fetchBills,
  updateBill,
  deleteBill,
  fetchProfile,
  saveProfile,
  flushOfflineQueue,
  migrateFromLocalStorage,
  isCloudAvailable,
};
