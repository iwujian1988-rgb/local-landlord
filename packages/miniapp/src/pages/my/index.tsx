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
import { APP_NAME, APP_VERSION, SUPPORT_EMAIL } from '../../constants/app';
import './index.scss';

interface MenuItem {
  icon: string;
  label: string;
  url?: string;
  action?: 'feedback' | 'about';
}

const menuItems: MenuItem[] = [
  { icon: iconPayment, label: '默认收款码', url: '/pages/qr-code/index' },
  { icon: iconFee, label: '每月收费项目', url: '/pages/fee-setup/index' },
  { icon: iconPrivacy, label: '隐私政策', url: '/pages/privacy/index' },
  { icon: iconAgreement, label: '用户协议', url: '/pages/terms/index' },
  { icon: iconAgreement, label: '账户管理', url: '/pages/account/index' },
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
    if (loginLoading) return;
    setLoginLoading(true);
    try {
      await useAuthStore.getState().login();
    } catch (err: any) {
      Taro.showModal({
        title: '登录失败',
        content: err?.message || '网络可能有点问题，请检查后重试',
        confirmText: '重试',
        cancelText: '稍后再说',
        success: (res) => {
          if (res.confirm) {
            setTimeout(() => handleLogin(), 100);
          }
        },
      });
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
      return;
    }
    if (item.action === 'feedback') {
      Taro.showModal({
        title: '客服反馈',
        content: `遇到问题或建议反馈，请发邮件到：\n${SUPPORT_EMAIL}\n（点「复制」可复制邮箱地址）`,
        confirmText: '复制邮箱',
        cancelText: '关闭',
        success: (r) => {
          if (r.confirm) {
            Taro.setClipboardData({
              data: SUPPORT_EMAIL,
              success: () => Taro.showToast({ title: '邮箱已复制', icon: 'none' }),
            });
          }
        },
      });
      return;
    }
    if (item.action === 'about') {
      Taro.showModal({
        title: `关于${APP_NAME}`,
        content: `版本 ${APP_VERSION}\n\n本应用是一个面向房东的免费房屋管理工具，提供房源、租客、账单和收租提醒。本应用不直接处理资金，收款通过您自己的收款码完成。`,
        showCancel: false,
        confirmText: '知道了',
      });
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
          <Text className="login-state-title">欢迎使用{APP_NAME}</Text>
          <Text className="login-state-desc">登录后可管理房间和收租</Text>
          <View className="login-state-btn" onClick={handleLogin}>
            <Text className="login-state-btn-text">{loginLoading ? '登录中...' : '微信一键登录'}</Text>
          </View>
        </View>
      ) : (
        <>
          <View className="profile-hero">
            <Image className="profile-avatar-img" src={avatarImg} mode="aspectFit" />
            <View className="profile-info">
              <Text className="profile-name">{displayName || '房东'}</Text>
              <Text className="profile-phone">{displayPhone || '未绑定手机'}</Text>
            </View>
            <Image className="profile-ill" src={heroIll} mode="aspectFit" />
          </View>

          <View className="menu-panel menu-main">
            {menuItems.map((item, idx) => (
              <View key={idx} className="menu-item" onClick={() => handleMenuItem(item)}>
                <Image className="menu-icon-img" src={item.icon} mode="aspectFit" />
                <Text className="menu-text">{item.label}</Text>
                <Text className="menu-arrow">›</Text>
              </View>
            ))}
          </View>

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

          <View className="menu-panel menu-secondary">
            <View className="menu-item" onClick={() => handleMenuItem({ action: 'feedback', label: '客服反馈', icon: iconFaq })}>
              <Image className="menu-icon-img" src={iconFaq} mode="aspectFit" />
              <Text className="menu-text">客服反馈</Text>
              <Text className="menu-arrow">›</Text>
            </View>
            <View className="menu-item" onClick={() => handleMenuItem({ action: 'about', label: `关于${APP_NAME}`, icon: iconPrivacy })}>
              <Image className="menu-icon-img" src={iconPrivacy} mode="aspectFit" />
              <Text className="menu-text">{`关于${APP_NAME}`}</Text>
              <Text className="menu-arrow">›</Text>
            </View>
          </View>

          <View className="logout-section">
            <View className="logout-btn" onClick={handleLogout}>
              <Text className="logout-btn-text">退出登录</Text>
            </View>
            <Text className="version-text">版本 {APP_VERSION}</Text>
          </View>
        </>
      )}

      <View style={{ height: '120px' }} />
    </ScrollView>
  );
}
