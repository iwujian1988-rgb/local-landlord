import { View, Text, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { APP_NAME } from '../../constants/app';
import loginHeroImg from '../../assets/home/login-hero-illustration.png';
import './index.scss';

const FEATURES = [
  { icon: '🏠', title: '管住房间', desc: '几处房子、几十间房，一眼看清谁住着、谁空着' },
  { icon: '💰', title: '算清每笔账', desc: '房租水电一键生成账单，发给租客不费劲' },
  { icon: '🔔', title: '到日子提醒', desc: '收租日、合同到期、逾期，微信主动提醒你' },
];

export default function Onboarding() {
  const [agreed, setAgreed] = useState(false);
  const [starting, setStarting] = useState(false);

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '欢迎使用' });
  });

  const openAgreement = (type: 'privacy' | 'terms') => {
    Taro.navigateTo({ url: `/pages/${type}/index` });
  };

  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    try {
      await useAuthStore.getState().login();
      Taro.setStorageSync('has_onboarded', 1);
      Taro.removeStorageSync('guest_mode');
      Taro.reLaunch({ url: '/pages/home/index' });
    } catch (err: any) {
      Taro.showModal({
        title: '登录失败',
        content: err?.message || '网络可能有点问题，请检查后重试',
        confirmText: '重试',
        cancelText: '稍后再说',
        success: (res) => {
          if (res.confirm) {
            setStarting(false);
            setTimeout(() => handleStart(), 100);
          } else {
            setStarting(false);
          }
        },
      });
    }
  };

  const handleBrowse = () => {
    Taro.setStorageSync('has_onboarded', 1);
    Taro.setStorageSync('guest_mode', 1);
    Taro.reLaunch({ url: '/pages/home/index' });
  };

  return (
    <View className="page-onboarding">
      <View className="ob-hero-wrap">
        <Image className="ob-hero-img" src={loginHeroImg} mode="aspectFit" />
      </View>

      <View className="ob-brand">
        <Text className="ob-brand-title">{APP_NAME}</Text>
        <Text className="ob-brand-subtitle">几间房，轻松管 · 一部手机搞定收租</Text>
      </View>

      <View className="ob-features">
        {FEATURES.map((f) => (
          <View key={f.title} className="ob-feature-card">
            <Text className="ob-feature-icon">{f.icon}</Text>
            <View className="ob-feature-body">
              <Text className="ob-feature-title">{f.title}</Text>
              <Text className="ob-feature-desc">{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="ob-footer">
        <View className="ob-agreement-row" onClick={() => setAgreed(!agreed)}>
          <View className={`ob-checkbox${agreed ? ' checked' : ''}`}>
            {agreed && <Text className="ob-check-mark">✓</Text>}
          </View>
          <Text className="ob-agreement-text">
            我已阅读并同意
            <Text className="ob-agreement-link" onClick={(e) => { e.stopPropagation(); openAgreement('privacy'); }}>
              《隐私政策》
            </Text>
            与
            <Text className="ob-agreement-link" onClick={(e) => { e.stopPropagation(); openAgreement('terms'); }}>
              《用户协议》
            </Text>
          </Text>
        </View>

        <View
          className={`ob-start-btn${agreed ? '' : ' disabled'}${starting ? ' loading' : ''}`}
          onClick={agreed && !starting ? handleStart : undefined}
        >
          <Text className="ob-start-btn-text">
            {starting ? '正在登录...' : '微信一键登录并开始'}
          </Text>
        </View>
        {!agreed && (
          <Text className="ob-agreement-hint">请先勾选并同意协议</Text>
        )}

        <View className="ob-browse-link" onClick={handleBrowse}>
          <Text className="ob-browse-link-text">先逛逛，暂不登录</Text>
        </View>

        <Text className="ob-hint">本应用免费 · 数据加密存储 · 不直接处理资金</Text>
      </View>
    </View>
  );
}
