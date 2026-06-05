/**
 * 本地存储工具
 *
 * 所有页面已完成 HTTP API 迁移，此文件仅保留本地缓存读写功能。
 */
import Taro from '@tarojs/taro';

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
 * 从本地缓存读取数据（同步）
 */
export function getAppData(): AppData {
  return Taro.getStorageSync('appData') || { properties: [], rooms: [], tenants: [] };
}

/**
 * 写入本地缓存（同步）
 */
export function setAppData(data: AppData): void {
  Taro.setStorageSync('appData', data);
}
