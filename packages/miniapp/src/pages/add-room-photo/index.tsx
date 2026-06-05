import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import { useCallback, useState, useEffect } from 'react';
import { uploadImage, getTempFileURL } from '../../services/cloudStorage';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import './index.scss';

interface PhotoItem {
  fileID: string;
  tempURL?: string;
}

export default function AddRoomPhoto() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const propertyId = Taro.getCurrentInstance().router?.params?.propertyId;

  const goBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  // 页面显示时恢复已上传的照片 fileID 列表
  useDidShow(() => {
    const saved = Taro.getStorageSync('tempRoomPhotos') || [];
    if (saved.length > 0 && photos.length === 0) {
      setPhotos(saved.map((fileID: string) => ({ fileID, tempURL: '' })));
    }
  });

  // 解析所有照片的临时访问链接
  useEffect(() => {
    photos.forEach((p) => {
      if (p.fileID && !p.tempURL) {
        getTempFileURL(p.fileID).then((url) => {
          setPhotos((prev) =>
            prev.map((item) =>
              item.fileID === p.fileID ? { ...item, tempURL: url } : item,
            ),
          );
        }).catch(() => {});
      }
    });
  }, [photos]);

  const goNext = useCallback(() => {
    // 持久化 fileID 列表供下一页使用
    Taro.setStorageSync('tempRoomPhotos', photos.map((p) => p.fileID));
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
          uploadImage(file.path, 'room')
            .then((result) => ({
              fileID: result.fileID,
              tempURL: '',
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
    });
  }, [photos.length]);

  return (
    <View className="page-add-room-photo">
      <NavBar title="添加一个房间" onBack={goBack} />

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
              style={{ backgroundImage: `url(${photo.tempURL})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
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
            <svg width="36" height="36" viewBox="0 0 24 24" stroke="var(--accent-hover)" strokeWidth="1.8" fill="none" opacity="0.4">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <Text className="photo-add-text">添加照片</Text>
          </View>
        )}
      </View>

      <View className="photo-actions">
        <View className="next-btn" onClick={goNext}>
          <Text className="next-btn-text">下一步</Text>
        </View>
      </View>
    </View>
  );
}
