/**
 * 云存储服务 — 封装 wx.cloud 图片上传/删除/访问
 *
 * 依赖：
 *   - R01: wx.cloud.init() 已完成
 *   - R02: useAuthStore 中有 openid
 *
 * 文件命名规则：{openid}/{entityType}/{timestamp}_{random}.{ext}
 */

import Taro from '@tarojs/taro';
import { useAuthStore } from '../store/useAuthStore';

/** 获取当前用户 openid，失败返回空串 */
function getOpenid(): string {
  const fromStore = useAuthStore.getState().openid;
  if (fromStore) return fromStore;
  // 兜底：从 storage 读取（兼容刚初始化还未写入 store 的情况）
  return Taro.getStorageSync('openid') || '';
}

/**
 * 从临时文件路径推测扩展名
 * 若无法推测则默认用 .jpg
 */
function getExt(filePath: string): string {
  const match = filePath.match(/\.([a-zA-Z0-9]+)$/);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

/**
 * 生成云存储路径
 * @param entityType 业务类型：property / room / qrCode / contract / bill 等
 * @param ext        文件扩展名（含点号）
 */
function buildCloudPath(entityType: string, ext: string): string {
  const openid = getOpenid() || 'anonymous';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${openid}/${entityType}/${timestamp}_${random}${ext}`;
}

export interface UploadResult {
  /** 云文件 ID（以 cloud:// 开头，可持久化到数据库） */
  fileID: string;
  /** 临时访问链接（用于当前会话展示，有时效） */
  tempFileURL?: string;
  /** 云存储路径（可用于删除） */
  cloudPath: string;
}

/**
 * 上传图片到云存储（基础版）
 *
 * @param filePath   本地临时文件路径（Taro.chooseImage 返回的 tempFilePath）
 * @param entityType 业务类型，影响云存储目录结构
 * @returns UploadResult
 */
export async function uploadImage(
  filePath: string,
  entityType: string = 'common',
): Promise<UploadResult> {
  const ext = getExt(filePath);
  const cloudPath = buildCloudPath(entityType, ext);

  try {
    const res: any = await wx.cloud.uploadFile({
      cloudPath,
      filePath,
    });
    console.log('[cloudStorage] upload success:', res.fileID);
    return {
      fileID: res.fileID,
      cloudPath,
    };
  } catch (err: any) {
    console.error('[cloudStorage] upload failed:', err);
    throw err;
  }
}

/**
 * 带进度回调的上传
 *
 * @param filePath    本地临时文件路径
 * @param entityType  业务类型
 * @param onProgress  进度回调，percent 范围 0~100
 * @returns UploadResult
 */
export function uploadImageWithProgress(
  filePath: string,
  entityType: string = 'common',
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const ext = getExt(filePath);
    const cloudPath = buildCloudPath(entityType, ext);

    const uploadTask: any = wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (res: any) => {
        console.log('[cloudStorage] uploadWithProgress success:', res.fileID);
        resolve({
          fileID: res.fileID,
          cloudPath,
        });
      },
      fail: (err: any) => {
        console.error('[cloudStorage] uploadWithProgress failed:', err);
        reject(err);
      },
    });

    if (uploadTask && uploadTask.onProgressUpdate && onProgress) {
      uploadTask.onProgressUpdate((res: any) => {
        onProgress(res.progress || 0);
      });
    }
  });
}

/**
 * 获取临时访问链接（用于展示已上传的图片）
 *
 * fileID 数组 → 返回 map：fileID → tempFileURL
 */
export async function getTempFileURLs(
  fileIDs: string[],
): Promise<Record<string, string>> {
  if (!fileIDs.length) return {};

  try {
    const res: any = await wx.cloud.getTempFileURL({
      fileList: fileIDs,
    });

    const map: Record<string, string> = {};
    if (res.fileList) {
      res.fileList.forEach((f: any) => {
        if (f.tempFileURL) {
          map[f.fileID] = f.tempFileURL;
        }
      });
    }
    return map;
  } catch (err: any) {
    console.error('[cloudStorage] getTempFileURLs failed:', err);
    throw err;
  }
}

/**
 * 获取单个 fileID 的临时访问链接
 */
export async function getTempFileURL(fileID: string): Promise<string> {
  const map = await getTempFileURLs([fileID]);
  return map[fileID] || '';
}

/**
 * 删除云存储文件
 * @param fileIDs 云文件 ID 数组（cloud:// 开头）
 */
export async function deleteImages(fileIDs: string[]): Promise<void> {
  if (!fileIDs.length) return;
  try {
    await wx.cloud.deleteFile({ fileList: fileIDs });
    console.log('[cloudStorage] deleted:', fileIDs);
  } catch (err: any) {
    console.error('[cloudStorage] deleteImages failed:', err);
    throw err;
  }
}

/**
 * 删除单个云存储文件
 */
export async function deleteImage(fileID: string): Promise<void> {
  await deleteImages([fileID]);
}
