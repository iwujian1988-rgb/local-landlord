import Taro from '@tarojs/taro';

export interface PickedImage {
  path: string;
  size: number;
}

/**
 * Pick one or more images from album or camera.
 *
 * Uses `chooseMedia` (the current WeChat API since base lib 2.21.0) with
 * `chooseImage` as a fallback for very old devices. The legacy `chooseImage`
 * is officially deprecated and silently no-ops on some newer iOS WeChat clients,
 * so callers should route through this helper instead of invoking either API
 * directly.
 *
 * Returns `[]` if the user cancels — never throws.
 */
export async function pickImages(opts: {
  count?: number;
  sourceType?: ('album' | 'camera')[];
  sizeType?: ('original' | 'compressed')[];
}): Promise<PickedImage[]> {
  const {
    count = 1,
    sourceType = ['album', 'camera'],
    sizeType = ['compressed'],
  } = opts;

  try {
    const res = await Taro.chooseMedia({
      count,
      sourceType,
      mediaType: ['image'],
      sizeType,
      camera: 'back',
    });
    return (res.tempFiles || []).map((f: any) => ({
      path: f.tempFilePath,
      size: f.size,
    }));
  } catch {
    // Fallback for older base libraries without chooseMedia
    try {
      const res = await Taro.chooseImage({ count, sourceType, sizeType });
      const files = (res.tempFiles || []) as any[];
      if (files.length > 0) {
        return files.map((f: any) => ({ path: f.path, size: f.size }));
      }
      const paths = res.tempFilePaths || [];
      return paths.map((p: string) => ({ path: p, size: 0 }));
    } catch {
      return [];
    }
  }
}
