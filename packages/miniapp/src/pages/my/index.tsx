import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState, useCallback } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import avatarImg from '../../assets/my/profile-avatar.png';
import heroIll from '../../assets/my/profile-hero-objects.png';
import iconPayment from '../../assets/my/icon-payment-code.png';
import iconFee from '../../assets/my/icon-fee-item.png';
import iconPrivacy from '../../assets/my/icon-privacy.png';
import iconAgreement from '../../assets/my/icon-agreement.png';
import iconFaq from '../../assets/my/icon-faq.png';
import './index.scss';

interface MenuItem {
  icon: string;
  label: string;
  url?: string;
  toast?: string;
}

const menuItems: MenuItem[] = [
  { icon: iconPayment, label: '默认收款码', url: '/pages/qr-code/index' },
  { icon: iconFee, label: '常用收费项目', url: '/pages/fee-setup/index' },
  { icon: iconPrivacy, label: '隐私政策', url: '/pages/privacy/index' },
  { icon: iconAgreement, label: '用户协议', url: '/pages/terms/index' },
];

const faqItems = [
  { question: '怎么添加房间?', answer: '在房间列表页点击右上角 + 号，拍照后填写房间信息保存即可' },
  { question: '怎么发给租客?', answer: '在房间详情点击「发账单」，确认金额后点击「发微信给租客」' },
  { question: '怎么设置收款码?', answer: '在房间详情或「我的」页面点击「收款码」，上传微信或支付宝收款码' },
  { question: '怎么记录已收?', answer: '在收租列表找到对应房间，点击「已收到」，确认金额后即标记为已收' },
  { question: '怎么上传合同收据?', answer: '在房间详情点击「合同收据」，点击右上角 + 号上传文件' },
];

export default function My() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const user = useAuthStore((s) => s.user);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      await useAuthStore.getState().login();
    } catch {
      Taro.showToast({ title: '登录失败，请检查网络', icon: 'none' });
    } finally {
      setLoginLoading(false);
    }
  };

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '我的' });
  });

  const handleMenuItem = (item: MenuItem) => {
    if (item.url) {
      Taro.navigateTo({ url: item.url });
    } else if (item.toast) {
      Taro.showToast({ title: item.toast, icon: 'none', duration: 2000 });
    }
  };

  const handleLogout = useCallback(() => {
    Taro.showModal({
      title: '退出登录',
      content: '退出后需要重新登录才能使用，确定退出？',
      confirmText: '退出',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          useAuthStore.getState().logout();
          Taro.reLaunch({ url: '/pages/home/index' });
        }
      },
    });
  }, []);

  const displayName = user?.name || '';
  const displayPhone = user?.phone || '';

  return (
    <ScrollView className="page-my" scrollY>
      {!isLoggedIn ? (
        <View className="login-state">
          <Image className="login-state-avatar" src={avatarImg} mode="aspectFit" />
          <Text className="login-state-title">欢迎使用本地房东</Text>
          <Text className="login-state-desc">登录后可管理房间和收租</Text>
          <View className="login-state-btn" onClick={handleLogin}>
            <Text className="login-state-btn-text">{loginLoading ? '登录中...' : '微信一键登录'}</Text>
          </View>
        </View>
      ) : (
        <>
          {/* Profile Hero */}
          <View className="profile-hero">
            <Image className="profile-avatar-img" src={avatarImg} mode="aspectFit" />
            <View className="profile-info">
              <Text className="profile-name">{displayName || '房东'}</Text>
              <Text className="profile-phone">{displayPhone || '未绑定手机'}</Text>
            </View>
            <Image className="profile-ill" src={heroIll} mode="aspectFit" />
          </View>

          {/* Menu List */}
          <View className="menu-panel menu-main">
            {menuItems.map((item, idx) => (
              <View key={idx} className="menu-item" onClick={() => handleMenuItem(item)}>
                <Image className="menu-icon-img" src={item.icon} mode="aspectFit" />
                <Text className="menu-text">{item.label}</Text>
                <Text className="menu-arrow">›</Text>
              </View>
            ))}
          </View>

          {/* FAQ */}
          <Text className="faq-title">常见问题</Text>
          <View className="menu-panel faq-panel">
            {faqItems.map((faq, idx) => (
              <View key={idx}>
                <View className="menu-item faq-item" onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}>
                  <Image className="menu-icon-img" src={iconFaq} mode="aspectFit" />
                  <Text className="menu-text">{faq.question}</Text>
                  <Text className="menu-arrow" style={{ transform: expandedFaq === idx ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>›</Text>
                </View>
                {expandedFaq === idx && (
                  <View className="faq-answer">
                    <Text className="faq-answer-text">{faq.answer}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Logout */}
          <View className="logout-section">
            <View className="logout-btn" onClick={handleLogout}>
              <Text className="logout-btn-text">退出登录</Text>
            </View>
          </View>
        </>
      )}

      <View style={{ height: '120px' }} />
    </ScrollView>
  );
}
