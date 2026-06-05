import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import { useCallback } from 'react';
import './index.scss';

export default function AddSuccess() {
  const propertyId = Taro.getCurrentInstance().router?.params?.propertyId;

  const goToRoomList = useCallback(() => {
    Taro.reLaunch({ url: '/pages/rooms/index' });
  }, []);

  const goToAddNext = useCallback(() => {
    Taro.navigateTo({ url: `/pages/add-room-photo/index?propertyId=${propertyId}` });
  }, [propertyId]);

  return (
    <View className="page-add-success">
      <NavBar title="添加成功" onBack={goToRoomList} />

      <View className="success-content">
        <View className="success-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" stroke="#fff" strokeWidth="1.8" fill="none">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </View>
        <Text className="success-title">房间已添加成功！</Text>
        <Text className="success-desc">可以发给租客查看了</Text>

        <View className="success-actions">
          <View className="success-btn primary" onClick={() => Taro.showToast({ title: '已生成分享图片，可以发给租客了', icon: 'none' })}>
            <svg width="20" height="20" viewBox="0 0 24 24" stroke="var(--text-primary)" strokeWidth="1.8" fill="none">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <Text className="success-btn-text">发给微信好友</Text>
          </View>
          <View className="success-btn secondary" onClick={goToAddNext}>
            <Text className="success-btn-text secondary-text">继续添加下一个</Text>
          </View>
          <View className="success-btn ghost" onClick={goToRoomList}>
            <Text className="success-btn-text ghost-text">返回房间列表</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
