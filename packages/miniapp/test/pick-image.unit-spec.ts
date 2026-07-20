/**
 * Tests for miniapp/src/utils/pick-image.ts.
 *
 * The helper has a 3-tier control flow:
 *   1. try chooseMedia (current API since 2.21.0)
 *   2. on throw → fallback chooseImage (legacy)
 *   3. on throw → return []  (user-cancel must not throw)
 */
import Taro from '@tarojs/taro';
import { pickImages } from '../src/utils/pick-image';

describe('pickImages', () => {
  beforeEach(() => jest.clearAllMocks());

  it('TC-PICK-001: chooseMedia 成功 → 用 tempFiles 映射', async () => {
    (Taro.chooseMedia as jest.Mock).mockResolvedValueOnce({
      tempFiles: [
        { tempFilePath: 'wx://a.png', size: 100 },
        { tempFilePath: 'wx://b.png', size: 200 },
      ],
    });

    const out = await pickImages({ count: 2 });
    expect(out).toEqual([
      { path: 'wx://a.png', size: 100 },
      { path: 'wx://b.png', size: 200 },
    ]);
    expect(Taro.chooseImage).not.toHaveBeenCalled();
  });

  it('TC-PICK-002: chooseMedia 失败 → chooseImage 兜底，走 tempFiles', async () => {
    (Taro.chooseMedia as jest.Mock).mockRejectedValueOnce(new Error('not supported'));
    (Taro.chooseImage as jest.Mock).mockResolvedValueOnce({
      tempFiles: [{ path: 'legacy://a.png', size: 50 }],
      tempFilePaths: ['legacy://a.png'],
    });

    const out = await pickImages({});
    expect(out).toEqual([{ path: 'legacy://a.png', size: 50 }]);
  });

  it('TC-PICK-003: 两个 API 都抛错 → 返回 []，永不抛', async () => {
    (Taro.chooseMedia as jest.Mock).mockRejectedValueOnce(new Error('fail'));
    (Taro.chooseImage as jest.Mock).mockRejectedValueOnce(new Error('fail'));

    const out = await pickImages({});
    expect(out).toEqual([]);
  });

  it('TC-PICK-004: chooseMedia 返回空 tempFiles → 返回 []', async () => {
    (Taro.chooseMedia as jest.Mock).mockResolvedValueOnce({ tempFiles: [] });
    const out = await pickImages({});
    expect(out).toEqual([]);
  });

  it('TC-PICK-005: chooseMedia fail + chooseImage 无 tempFiles 但有 tempFilePaths → 用路径', async () => {
    (Taro.chooseMedia as jest.Mock).mockRejectedValueOnce(new Error('x'));
    (Taro.chooseImage as jest.Mock).mockResolvedValueOnce({
      tempFiles: [],
      tempFilePaths: ['p1.png', 'p2.png'],
    });
    const out = await pickImages({});
    expect(out).toEqual([
      { path: 'p1.png', size: 0 },
      { path: 'p2.png', size: 0 },
    ]);
  });

  it('TC-PICK-006: opts 默认值 — count=1, sizeType=compressed', async () => {
    (Taro.chooseMedia as jest.Mock).mockResolvedValueOnce({ tempFiles: [] });
    await pickImages({}); // no opts

    const call = (Taro.chooseMedia as jest.Mock).mock.calls[0][0];
    expect(call.count).toBe(1);
    expect(call.sourceType).toEqual(['album', 'camera']);
    expect(call.sizeType).toEqual(['compressed']);
    expect(call.mediaType).toEqual(['image']);
  });
});
