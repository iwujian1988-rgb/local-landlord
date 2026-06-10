import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState, useCallback } from 'react';
import { get } from '../../services/request';
import { useAuthStore } from '../../store/useAuthStore';
import { requestNotification } from '../../services/notification';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import heroImg from '../../assets/home/home-hero-illustration.png';
import loginHeroImg from '../../assets/home/login-hero-illustration.png';
import bellImg from '../../assets/home/home-reminder-bell.png';
import roomIcon from '../../assets/home/home-icon-room.png';
import statsIcon from '../../assets/home/home-icon-stats.png';
import checkinIcon from '../../assets/home/home-icon-checkin.png';
import sourceIcon from '../../assets/home/home-icon-source.png';
import './index.scss';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 6) return '凌晨好';
  if (h < 9) return '早上好';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
};

interface PageData {
  greeting: string;
  pendingCount: number;
  pendingDesc: string;
  pendingHouseholds: number;
  monthlyCollected: number;
  showRoomGuide: boolean;
  showTenantGuide: boolean;
  showQrGuide: boolean;
  profileName: string;
  expiringContracts: any[];
  discoveryAlerts: any[];
}

const emptyData: PageData = {
  greeting: '', pendingCount: 0, pendingDesc: '', pendingHouseholds: 0,
  monthlyCollected: 0, showRoomGuide: false, showTenantGuide: false,
  showQrGuide: false, profileName: '', expiringContracts: [], discoveryAlerts: [],
};

export default function Home() {
  const [data, setData] = useState<PageData>(emptyData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      await useAuthStore.getState().login();
    } catch {
      Taro.showToast({ title: '登录失败，请检查网络', icon: 'none' });
    } finally {
      setLoginLoading(false);
      loadData();
      // Accumulate notification credits after login
      setTimeout(() => requestNotification(), 500);
    }
  };

  const loadData = useCallback(async () => {
    if (!useAuthStore.getState().isLoggedIn) {
      setData(prev => ({ ...prev, greeting: getGreeting() }));
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const statsRes = await get<any>('/stats/home');
      const s = statsRes.data || {};
      setData({
        greeting: getGreeting(),
        pendingCount: s.todoCount || 0,
        pendingDesc: s.pendingDesc || '',
        pendingHouseholds: s.pendingHouseholds || 0,
        monthlyCollected: s.monthlyCollected || 0,
        showRoomGuide: s.showRoomGuide || false,
        showTenantGuide: s.showTenantGuide || false,
        showQrGuide: s.showQrGuide || false,
        profileName: s.profileName || '',
        expiringContracts: s.expiringContracts || [],
        discoveryAlerts: s.discoveryAlerts || [],
      });
    } catch (err) {
      console.error('[Home] 加载数据失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '本地房东' });
    setTimeout(loadData, 100);
    // Accumulate notification credits on each home page visit
    if (useAuthStore.getState().isLoggedIn) {
      setTimeout(() => requestNotification(), 2000);
    }
  });

  const hasPendingActions = data.pendingCount > 0 || data.expiringContracts.length > 0;

  return (
    <ScrollView className="page-home" scrollY>
      {!isLoggedIn && (
        <View className="login-section">
          <View className="login-card">
            <View className="login-brand">
              <Text className="login-brand-text">五联人家 · 轻松管房收租</Text>
            </View>
            <Text className="login-title">欢迎使用五联人家</Text>
            <View className="login-subtitle">
              <View className="login-line" />
              <Text className="login-subtitle-text">请先登录以使用全部功能</Text>
              <View className="login-line" />
            </View>
            <Image className="login-hero-img" src={loginHeroImg} mode="aspectFit" />
            <View className="login-btn" onClick={handleLogin}>
              <Text className="login-btn-text">{loginLoading ? '登录中...' : '微信一键登录'}</Text>
            </View>
            <View className="login-security">
              <Text className="login-security-text">安全登录 · 保护隐私</Text>
            </View>
          </View>
        </View>
      )}
      {loading && <Loading />}
      {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
      {!loading && !error && isLoggedIn && (
        <>
          {/* Greeting */}
          <View className="greeting">
            <Text className="greeting-name">{data.profileName}{data.profileName ? '，' : ''}{data.greeting}</Text>
            <Text className="greeting-subtitle">{hasPendingActions ? '有事情需要你处理' : '今天要做的事'}</Text>
          </View>

          {/* Hero or Action cards */}
          {!hasPendingActions && (
            <View className="hero-card">
              <View className="hero-copy">
                <Text className="hero-title">一切正常，{'\n'}去喝杯茶吧</Text>
                <Text className="hero-desc">没有逾期，没有到期，继续保持。</Text>
              </View>
              <Image className="hero-asset" src={heroImg} mode="aspectFit" />
            </View>
          )}

          {hasPendingActions && (
            <View className="action-hero">
              {data.pendingCount > 0 && (
                <View className="action-item action-rent" onClick={() => Taro.switchTab({ url: '/pages/rent-list/index' })}>
                  <View className="action-item-left">
                    <Text className="action-badge">{data.pendingHouseholds}笔</Text>
                    <Text className="action-title">待收租</Text>
                    <Text className="action-desc">{data.pendingDesc}</Text>
                  </View>
                  <View className="action-go">
                    <Text className="action-go-text">去处理</Text>
                  </View>
                </View>
              )}

              {data.expiringContracts.length > 0 && (
                <View className="action-item action-contract">
                  {data.expiringContracts.slice(0, 3).map((c: any, idx: number) => (
                    <View
                      key={idx}
                      className="action-contract-row"
                      onClick={() => Taro.navigateTo({ url: `/pages/room-detail/index?roomId=${c.roomId}` })}
                    >
                      <View className="action-contract-info">
                        <Text className="action-contract-name">{c.roomName} · {c.tenantName}</Text>
                        <Text className="action-contract-date">
                          {c.daysLeft <= 0 ? '合同已过期' : `合同${c.daysLeft}天后到期`}
                        </Text>
                      </View>
                      <Text style={{ fontSize: '24px', color: 'var(--text-hint)', lineHeight: 1 }}>›</Text>
                    </View>
                  ))}
                  {data.expiringContracts.length > 3 && (
                    <Text className="action-more">还有 {data.expiringContracts.length - 3} 份...</Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Discovery / Reminder */}
          {data.discoveryAlerts.length > 0 && (
            <View className="reminder-card">
              <View className="reminder-icon"><Image src={bellImg} mode="aspectFit" /></View>
              <View className="reminder-body">
                <Text className="reminder-title">你可能漏了</Text>
                {data.discoveryAlerts.slice(0, 2).map((alert: any, idx: number) => (
                  <View
                    key={idx}
                    className="reminder-item"
                    onClick={() => {
                      if (alert.roomId > 0) {
                        Taro.navigateTo({ url: `/pages/room-detail/index?roomId=${alert.roomId}` });
                      }
                    }}
                  >
                    <Text className="reminder-dot" />
                    <Text>{alert.message}</Text>
                  </View>
                ))}
              </View>
              <Text className="chevron">›</Text>
            </View>
          )}

          {/* Monthly Collected */}
          {data.monthlyCollected > 0 && (
            <View className="monthly-card">
              <View className="monthly-row">
                <View className="monthly-left">
                  <Text className="monthly-title">本月已收到</Text>
                  <Text className="monthly-desc">点了"已收到"后金额会加到这里</Text>
                </View>
                <View className="monthly-right">
                  <Text className="monthly-number success">{data.monthlyCollected.toLocaleString()}</Text>
                  <Text className="monthly-label">元</Text>
                </View>
              </View>
            </View>
          )}

          {/* Function Section */}
          <View className="function-section">
            <View className="function-header">
              <Text className="function-title">常用功能</Text>
              <Text className="function-desc">快速管理房间、租客和收款码</Text>
            </View>
            <View className="function-grid">
              <View className="feature-card" onClick={() => Taro.switchTab({ url: '/pages/rooms/index' })}>
                <View className="feature-icon room"><Image src={roomIcon} mode="aspectFit" /></View>
                <Text className="feature-label">房间资料</Text>
                <Text className="feature-arrow">›</Text>
              </View>
              <View className="feature-card" onClick={() => Taro.navigateTo({ url: '/pages/rent-stats/index' })}>
                <View className="feature-icon stats"><Image src={statsIcon} mode="aspectFit" /></View>
                <Text className="feature-label">简单统计</Text>
                <Text className="feature-arrow">›</Text>
              </View>
              <View className="feature-card" onClick={() => Taro.navigateTo({ url: '/pages/fee-setup/index' })}>
                <View className="feature-icon checkin"><Image src={checkinIcon} mode="aspectFit" /></View>
                <Text className="feature-label">收费项目</Text>
                <Text className="feature-arrow">›</Text>
              </View>
              <View className="feature-card" onClick={() => Taro.navigateTo({ url: '/pages/property-manage/index' })}>
                <View className="feature-icon source"><Image src={sourceIcon} mode="aspectFit" /></View>
                <Text className="feature-label">房源管理</Text>
                <Text className="feature-arrow">›</Text>
              </View>
            </View>
          </View>

          {/* Guide Cards */}
          {data.showRoomGuide && (
            <View className="guide-card">
              <Text className="guide-card-title">还没有房间</Text>
              <Text className="guide-card-desc">你还没有添加房间，收租需要先有房间哦</Text>
              <View className="guide-card-btn" onClick={() => Taro.switchTab({ url: '/pages/rooms/index' })}>
                <Text className="guide-card-btn-text">添加房间</Text>
              </View>
            </View>
          )}

          {data.showTenantGuide && (
            <View className="guide-card">
              <Text className="guide-card-title">房间空着呢</Text>
              <Text className="guide-card-desc">房间还是空的，去登记租客信息吧</Text>
              <View className="guide-card-btn" onClick={() => Taro.switchTab({ url: '/pages/rooms/index' })}>
                <Text className="guide-card-btn-text">去登记</Text>
              </View>
            </View>
          )}

          {data.showQrGuide && (
            <View className="guide-card">
              <Text className="guide-card-title">设置收款码</Text>
              <Text className="guide-card-desc">设置收款码后租客可以直接扫码付款</Text>
              <View className="guide-card-btn" onClick={() => Taro.switchTab({ url: '/pages/my/index' })}>
                <Text className="guide-card-btn-text">去设置</Text>
              </View>
            </View>
          )}

          <View style={{ height: '160px' }} />
        </>
      )}
    </ScrollView>
  );
}
