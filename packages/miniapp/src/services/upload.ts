import Taro from '@tarojs/taro';
import { API_BASE_URL, USE_CLOUD } from '../config';
import { useAuthStore } from '../store/useAuthStore';
import { post } from './request';

interface UploadResult {
  url: string;
  fileID?: string;
}

/**
 * Unified file upload:
 * - Dev mode: Taro.uploadFile() to local server
 * - Cloud mode: wx.cloud.uploadFile → 直传云存储 COS, 再用 cloudPath 调后端拼永久 URL
 *   (官方推荐做法 — callContainer 请求体不适合传大文件)
 */
export async function uploadFile(filePath: string): Promise<UploadResult> {
  if (USE_CLOUD) {
    return uploadViaCloudStorage(filePath);
  }
  return uploadViaHttp(filePath);
}

function uploadViaHttp(filePath: string): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const token = useAuthStore.getState().token || Taro.getStorageSync('auth_token') || '';
    Taro.uploadFile({
      url: `${API_BASE_URL}/upload`,
      filePath,
      name: 'file',
      header: { Authorization: `Bearer ${token}` },
      success: (uploadRes) => {
        try {
          const data = JSON.parse(uploadRes.data);
          if (data.code === 0) {
            resolve({
              url: data.data?.url || '',
              fileID: data.data?.fileID || data.data?.url || '',
            });
          } else {
            reject(new Error(data.message || '上传失败'));
          }
        } catch {
          reject(new Error('解析上传结果失败'));
        }
      },
      fail: (err) => reject(new Error(err.errMsg || '上传失败')),
    });
  });
}

function randomFilename(ext: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ts}-${rand}.${ext}`;
}

/**
 * 通过 wx.cloud.uploadFile 直接上传到云存储 COS，
 * 之后用 cloudPath 调后端 /upload/cloud-path 拿永久 CDN URL。
 *
 * 优点（相对 base64 via callContainer）：
 * - 无 callContainer body 限制（默认 ~100KB），支持大文件（最大 50MB）
 * - 不阻塞 JS 线程做 base64 转换
 * - 走微信内网，速度更快
 */
async function uploadViaCloudStorage(filePath: string): Promise<UploadResult> {
  console.log('[upload] uploadViaCloudStorage start, filePath:', filePath);

  const ext = (filePath.split('.').pop() || 'jpg').toLowerCase();
  const filename = randomFilename(ext);
  const cloudPath = `uploads/${filename}`;
  console.log('[upload] cloudPath:', cloudPath);

  const uploadRes = await Taro.cloud.uploadFile({
    cloudPath,
    filePath,
  });
  console.log('[upload] cloud.uploadFile result:', uploadRes);

  if (!uploadRes.fileID) {
    throw new Error(uploadRes.errMsg || '云存储上传失败');
  }

  // 用 cloudPath 调后端拿永久 URL —— 不传文件内容，body 只有几十字节
  const res = await post<any>('/upload/cloud-path', { cloudPath });
  console.log('[upload] cloud-path response:', JSON.stringify(res));

  if (res.code !== 0) {
    throw new Error(`[code=${res.code}] ${res.message || '获取永久 URL 失败'}`);
  }

  return {
    url: res.data?.url || '',
    fileID: uploadRes.fileID,
  };
}

/**
 * Upload multiple files in parallel
 */
export async function uploadFiles(filePaths: string[]): Promise<UploadResult[]> {
  return Promise.all(filePaths.map(uploadFile));
}
