import { View, Text } from '@tarojs/components';
import { useState } from 'react';
import Taro from '@tarojs/taro';
import { useAuthStore } from '../../store/useAuthStore';
import './index.scss';

interface Props {
  title: string;
  desc?: string;
}

export default function LoginPrompt({ title, desc }: Props) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await useAuthStore.getState().login();
    } catch {
      Taro.showToast({ title: '登录没成功，稍后再试', icon: 'none', duration: 2000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="login-prompt">
      <Text className="login-prompt-title">{title}</Text>
      {desc ? <Text className="login-prompt-desc">{desc}</Text> : null}
      <View className="login-prompt-btn" onClick={handleLogin}>
        <Text className="login-prompt-btn-text">{loading ? '登录中...' : '微信一键登录'}</Text>
      </View>
    </View>
  );
}
