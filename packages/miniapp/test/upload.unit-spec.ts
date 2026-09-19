import Taro from '@tarojs/taro';
import { uploadFile } from '../src/services/upload';

beforeEach(() => { (Taro as any).uploadFile = jest.fn(); });

it.each([
  { statusCode: 500, data: JSON.stringify({ code: 0, data: { url: '/bad.jpg' } }) },
  { statusCode: 200, data: JSON.stringify({ code: 0, data: {} }) },
])('does not report unusable photo uploads as saved: %p', async response => {
  (Taro.uploadFile as jest.Mock).mockImplementation(options => options.success(response));
  await expect(uploadFile('/photo.jpg')).rejects.toThrow('上传失败');
});

it('returns the uploaded photo URL on success', async () => {
  (Taro.uploadFile as jest.Mock).mockImplementation(options => options.success({
    statusCode: 200, data: JSON.stringify({ code: 0, data: { url: '/uploads/photo.jpg' } }),
  }));
  await expect(uploadFile('/photo.jpg')).resolves.toMatchObject({ url: '/uploads/photo.jpg' });
});
