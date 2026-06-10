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
 * - Cloud mode: base64 via callContainer → /upload/base64
 */
export async function uploadFile(filePath: string): Promise<UploadResult> {
  if (USE_CLOUD) {
    return uploadViaBase64(filePath);
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

async function uploadViaBase64(filePath: string): Promise<UploadResult> {
  const fileInfo = await Taro.getFileInfo({ filePath });
  const fs = Taro.getFileSystemManager();
  const base64 = fs.readFileSync(filePath, 'base64') as string;

  const ext = filePath.split('.').pop() || 'jpg';
  const mimeType = ext === 'png' ? 'image/png'
    : ext === 'gif' ? 'image/gif'
    : ext === 'webp' ? 'image/webp'
    : 'image/jpeg';

  const res = await post<any>('/upload/base64', {
    data: `data:${mimeType};base64,${base64}`,
    size: fileInfo.size,
  });

  if (res.code !== 0) {
    throw new Error(res.message || '上传失败');
  }

  return {
    url: res.data?.url || '',
    fileID: res.data?.url || '',
  };
}

/**
 * Upload multiple files in parallel
 */
export async function uploadFiles(filePaths: string[]): Promise<UploadResult[]> {
  return Promise.all(filePaths.map(uploadFile));
}
