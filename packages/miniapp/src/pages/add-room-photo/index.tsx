import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useCallback, useState, useEffect } from 'react';
import { uploadFile } from '../../services/upload';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import './index.scss';

interface PhotoItem {
  url: string;
  fileID?: string;
}

export default function AddRoomPhoto() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const propertyId = Taro.getCurrentInstance().router?.params?.propertyId;

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '添加一个房间' });
    const saved = Taro.getStorageSync('tempRoomPhotos') || [];
    if (saved.length > 0 && photos.length === 0) {
      setPhotos(saved.map((item: any) => {
        if (typeof item === 'string') {
          return { url: item, fileID: item };
        }
        return item;
      }));
    }
  });

  const goNext = useCallback(() => {
    Taro.setStorageSync('tempRoomPhotos', photos.map((p) => p.fileID || p.url));
    Taro.navigateTo({ url: `/pages/add-room-info/index?propertyId=${propertyId}` });
  }, [photos, propertyId]);

  const handleAddPhoto = useCallback(() => {
    setUploadError(false);
    Taro.chooseImage({
      count: 9 - photos.length,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        setUploading(true);
        const uploads = res.tempFiles.map((file: any) =>
          uploadFile(file.path).then(r => ({
            url: r.url,
            fileID: r.fileID || r.url,
          }))
        );

        Promise.all(uploads)
          .then((newPhotos) => {
            setPhotos((prev) => [...prev, ...newPhotos]);
          })
          .catch(() => {
            setUploadError(true);
          })
          .finally(() => {
            setUploading(false);
          });
      },
      fail: (err) => {
        const msg = err?.errMsg || '';
        // User cancelled — silent
        if (msg.includes('cancel')) return;
        // Permission denied — guide to settings
        if (msg.includes('auth') || msg.includes('fail')) {
          Taro.showModal({
            title: '相机/相册权限未开启',
            content: '请在微信设置中开启相机和相册权限，或者跳过照片直接填写房间信息',
            confirmText: '去设置',
            cancelText: '跳过照片',
            success: (r) => {
              if (r.confirm) {
                Taro.openSetting({});
              }
            },
          });
        }
      },
    });
  }, [photos.length]);

  const handleSkip = useCallback(() => {
    Taro.removeStorageSync('tempRoomPhotos');
    Taro.navigateTo({ url: `/pages/add-room-info/index?propertyId=${propertyId}` });
  }, [propertyId]);

  return (
    <View className="page-add-room-photo">
      <View className="photo-hint">
        <Text className="photo-hint-main">
          先拍几张房间照片，后面可以慢慢补信息。
        </Text>
        <Text className="photo-hint-sub">有照片更方便发给租客看</Text>
      </View>

      {/* Photo grid */}
      <View className="photo-grid">
        {uploading ? (
          <View className="photo-grid-item photo-uploading">
            <Loading text="正在上传..." fullPage={false} />
          </View>
        ) : null}

        {photos.map((photo, idx) => (
          <View key={photo.fileID || idx} className="photo-grid-item">
            <View
              className="photo-thumb"
              style={{ backgroundImage: `url(${photo.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
          </View>
        ))}

        {uploadError && (
          <View className="photo-grid-item">
            <ErrorState
              title="上传失败了"
              description="网络可能有点问题，请再试一次"
              retryText="重新上传"
              onRetry={handleAddPhoto}
              fullPage={false}
            />
          </View>
        )}

        {photos.length < 9 && !uploading && (
          <View className="photo-grid-item photo-add-btn" onClick={handleAddPhoto}>
            <Text style={{ fontSize: '32px', color: 'var(--accent-hover)', lineHeight: 1, opacity: 0.4 }}>＋</Text>
            <Text className="photo-add-text">添加照片</Text>
          </View>
        )}
      </View>

      <View className="photo-actions">
        <View className="next-btn" onClick={goNext}>
          <Text className="next-btn-text">下一步</Text>
        </View>
        <View className="skip-link" onClick={handleSkip}>
          <Text className="skip-link-text">跳过拍照，直接填写</Text>
        </View>
      </View>
    </View>
  );
}
