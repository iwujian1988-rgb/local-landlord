import { View, Text, ScrollView, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState, useCallback } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { readPhoneAuthorization } from '../../utils/phone-authorization';
import Icon from '../../components/Icon';
import { APP_NAME, APP_VERSION } from '../../constants/app';
import './index.scss';

interface MenuItem {
  icon: string;
  label: string;
  url?: string;
  action?: 'about';
}

const menuItems: MenuItem[] = [
  { icon: 'qr-code', label: '默认收款码', url: '/pages/qr-code/index' },
  { icon: 'receipt', label: '每月收费项目', url: '/pages/fee-setup/index' },
  { icon: 'building', label: '房源管理', url: '/pages/property-manage/index' },
  { icon: 'shield', label: '隐私政策', url: '/pages/privacy/index' },
  { icon: 'file-text', label: '用户协议', url: '/pages/terms/index' },
  { icon: 'settings', label: '账户管理', url: '/pages/account/index' },
];

const faqItems = [
  { question: '怎么添加房间?', answer: '在房间列表页点击右上角 + 号，拍照后填写房间信息保存即可' },
  { question: '怎么发给租客?', answer: '在房间详情点击「发账单」，确认金额后点击「发微信给租客」' },
  { question: '怎么设置收款码?', answer: '在房间详情或「我的」页面点击「收款码」，上传微信或支付宝收款码' },
  { question: '收到房租后怎么记?', answer: '打开「收租」，找到对应房间，点击「记录收款」，再填写这次收到的金额' },
  { question: '怎么上传合同收据?', answer: '在房间详情点击「合同收据」，点击右上角 + 号上传文件' },
];

export default function My() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const user = useAuthStore((s) => s.user);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async (phoneCode?: string) => {
    if (loginLoading) return;
    setLoginLoading(true);
    try {
      await useAuthStore.getState().login(phoneCode);
    } catch (err: any) {
      Taro.showModal({
        title: '登录失败',
        content: '请检查网络后再试一次。房间和账目不会丢失。',
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

  const handlePhoneLogin = (event: any) => {
    const phoneCode = event?.detail?.code || '';
    void handleLogin(phoneCode);
  };

  const handleBindPhone = async (event: any) => {
    if (loginLoading) return;
    const result = readPhoneAuthorization(event?.detail);
    if (!result.code) {
      if (result.cancelled) {
        Taro.showToast({ title: '已取消，手机号未绑定', icon: 'none' });
        return;
      }
      Taro.showModal({
        title: '暂时不能绑定手机号',
        content: '请稍后再试。你的登录、房间和账目不受影响。',
        showCancel: false,
        confirmText: '知道了',
      });
      return;
    }
    setLoginLoading(true);
    try {
      await useAuthStore.getState().bindPhone(result.code);
      Taro.showToast({ title: '手机号绑定成功', icon: 'success', duration: 1800 });
    } catch (err: any) {
      Taro.showModal({
        title: '没有绑定成功',
        content: '请检查网络后再试一次。你的房间和账目不受影响。',
        showCancel: false,
        confirmText: '知道了',
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
          Taro.reLaunch({ url: '/pages/onboarding/index' });
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
          <Text className="login-state-title">欢迎使用{APP_NAME}</Text>
          <Text className="login-state-desc">登录后可管理房间和收租</Text>
          <Button
            className="login-state-btn"
            openType="getPhoneNumber"
            disabled={loginLoading}
            onGetPhoneNumber={handlePhoneLogin}
          >
            <Text className="login-state-btn-text">{loginLoading ? '正在登录...' : '用微信手机号登录'}</Text>
          </Button>
        </View>
      ) : (
        <>
          <View className="profile-hero">
            <View className="profile-info">
              <Text className="profile-kicker">{APP_NAME} · 我的账号</Text>
              <Text className="profile-name">{displayName || '房东'}</Text>
              <Text className="profile-caption">房间和账目，都记在这里</Text>
            </View>
            <View className="profile-mark"><Icon name="home" size={30} color="#b4552c" /></View>
          </View>
          <View className="phone-panel">
            <View className="phone-symbol"><Icon name="smartphone" size={22} color="#b4552c" /></View>
            <View className="phone-copy">
              <Text className="phone-label">手机号</Text>
              <Text className="profile-phone">{displayPhone || '尚未绑定'}</Text>
            </View>
              {displayPhone ? (
                <Text className="phone-bound">已绑定</Text>
              ) : (
                <Button
                  className="profile-bind-phone"
                  openType="getPhoneNumber"
                  disabled={loginLoading}
                  onGetPhoneNumber={handleBindPhone}
                >
                  {loginLoading ? '正在绑定...' : '绑定手机号'}
                </Button>
              )}
          </View>

          <Text className="faq-title">常用设置</Text>
          <View className="menu-panel menu-main">
            {menuItems.slice(0, 3).map((item, idx) => (
              <View key={idx} className="menu-item" onClick={() => handleMenuItem(item)}>
                <View className={`my-menu-symbol tone-${idx}`}><Icon name={item.icon} size={22} color={idx === 1 ? '#52715b' : '#b4552c'} /></View>
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

          <Text className="faq-title">账号与服务</Text>
          <View className="menu-panel menu-secondary">
            {menuItems.slice(3).map(item => <View key={item.label} className="menu-item" onClick={() => handleMenuItem(item)}>
              <View className="my-menu-symbol quiet"><Icon name={item.icon} size={20} color="#7a6b5e" /></View>
              <Text className="menu-text">{item.label}</Text><Text className="menu-arrow">›</Text>
            </View>)}
            <View className="menu-item" onClick={() => handleMenuItem({ action: 'about', label: `关于${APP_NAME}`, icon: 'help' })}>
              <View className="my-menu-symbol quiet"><Icon name="help" size={20} color="#7a6b5e" /></View>
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
