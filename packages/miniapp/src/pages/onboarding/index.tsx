import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useCallback, useState } from 'react';
import { getAppData } from '../../utils/storage';
import './index.scss';

export default function Onboarding() {
  const [fading, setFading] = useState(false);

  const handleStart = useCallback(() => {
    Taro.setStorageSync('hasOnboarded', true);
    setFading(true);
    setTimeout(() => {
      const appData = getAppData();
      const hasRooms = appData.rooms && appData.rooms.length > 0;
      if (hasRooms) {
        Taro.switchTab({ url: '/pages/home/index' });
      } else {
        Taro.reLaunch({ url: '/pages/home-empty/index' });
      }
    }, 500);
  }, []);

  return (
    <View className={`page-onboarding${fading ? ' page-fading' : ''}`}>
      {/* Logo */}
      <View className="onboarding-logo">
        <svg width="44" height="44" viewBox="0 0 24 24" stroke="var(--text-primary)" strokeWidth="1.8" fill="none">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </View>

      <Text className="onboarding-title">欢迎使用本地房东</Text>
      <Text className="onboarding-subtitle">
        用微信就能{'\n'}管房、管租客、管收租、管合同收据
      </Text>

      {/* Features */}
      <View className="features-row">
        <View className="feature-card">
          <View className="feature-icon accent-bg">
            <svg width="22" height="22" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth="1.8" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </View>
          <Text className="feature-title">管房</Text>
          <Text className="feature-desc">拍照添加房间{'\n'}一键转发租客</Text>
        </View>
        <View className="feature-card">
          <View className="feature-icon green-bg">
            <svg width="22" height="22" viewBox="0 0 24 24" stroke="var(--green)" strokeWidth="1.8" fill="none">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </View>
          <Text className="feature-title">管收租</Text>
          <Text className="feature-desc">帮你算账{'\n'}到日子提醒</Text>
        </View>
        <View className="feature-card">
          <View className="feature-icon orange-bg">
            <svg width="22" height="22" viewBox="0 0 24 24" stroke="var(--orange)" strokeWidth="1.8" fill="none">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </View>
          <Text className="feature-title">管合同</Text>
          <Text className="feature-desc">拍照存合同{'\n'}随时查收据</Text>
        </View>
      </View>

      {/* Start button */}
      <View className="start-btn" onClick={handleStart}>
        <Text className="start-btn-text">开始使用</Text>
      </View>

      <Text className="onboarding-footer">完全免费，无需注册</Text>
    </View>
  );
}
