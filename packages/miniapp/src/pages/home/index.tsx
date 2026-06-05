import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { get } from '../../services/request';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
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

export default function Home() {
  const [greeting, setGreeting] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingDesc, setPendingDesc] = useState('');
  const [pendingHouseholds, setPendingHouseholds] = useState(0);
  const [monthlyCollected, setMonthlyCollected] = useState(0);
  const [showRoomGuide, setShowRoomGuide] = useState(false);
  const [showTenantGuide, setShowTenantGuide] = useState(false);
  const [showQrGuide, setShowQrGuide] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const [statsRes, pendingRes] = await Promise.all([
        get<any>('/stats/home'),
        get<any>('/rent/pending'),
      ]);

      const stats = statsRes.data || {};
      const pending = pendingRes.data || {};

      setPendingCount(pending.pendingCount || 0);
      setPendingDesc(pending.pendingDesc || '');
      setPendingHouseholds(pending.pendingHouseholds || 0);
      setMonthlyCollected(stats.monthlyCollected || 0);
      setShowRoomGuide(stats.showRoomGuide || false);
      setShowTenantGuide(stats.showTenantGuide || false);
      setShowQrGuide(stats.showQrGuide || false);
      setProfileName(stats.profileName || '');
      setGreeting(getGreeting());
    } catch (err) {
      console.error('[Home] 加载数据失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    loadData();
  });

  const switchToRent = () => {
    Taro.switchTab({ url: '/pages/rent-list/index' });
  };

  const switchToRooms = () => {
    Taro.switchTab({ url: '/pages/rooms/index' });
  };

  const switchToMy = () => {
    Taro.switchTab({ url: '/pages/my/index' });
  };

  const goToRentStats = () => {
    Taro.navigateTo({ url: '/pages/rent-stats/index' });
  };

  const goToAddTenant = () => {
    Taro.navigateTo({ url: '/pages/add-tenant/index?roomId=0' });
  };

  const goToAddProperty = () => {
    Taro.navigateTo({ url: '/pages/add-property/index' });
  };

  return (
    <ScrollView className="page-home" scrollY>
      {loading && <Loading />}
      {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
      {!loading && !error && (
        <>
          {/* Greeting */}
          <View className="greeting">
            <View className="greeting-text">
              <Text className="greeting-name">{profileName}{profileName ? '，' : ''}{greeting}</Text>
              <Text className="greeting-subtitle">今天要做的事</Text>
            </View>
          </View>

          {/* Hero Card */}
          <View className="hero-card">
            {pendingCount === 0 ? (
              <>
                <Text className="hero-title">今天都收完了，去喝杯茶吧 </Text>
                <Text className="hero-desc">今天没有要收的房租，继续保持。</Text>
              </>
            ) : (
              <>
                <Text className="hero-title">今天有 {pendingCount} 笔租要收</Text>
                <Text className="hero-desc">按收租日排序，重要的放前面。</Text>
                <View className="hero-btn" onClick={switchToRent}>
                  <Text className="hero-btn-text">去看看收租</Text>
                </View>
              </>
            )}
          </View>

          {/* Guidance Cards */}
          {showRoomGuide && (
            <View className="elder-card guide-card">
              <Text className="elder-card-title">还没有房间</Text>
              <Text className="elder-card-desc">你还没有添加房间，收租需要先有房间哦</Text>
              <View className="guide-card-btn" onClick={switchToRooms}>
                <Text className="guide-card-btn-text">添加房间</Text>
              </View>
            </View>
          )}

          {showTenantGuide && (
            <View className="elder-card guide-card">
              <Text className="elder-card-title">房间空着呢</Text>
              <Text className="elder-card-desc">房间还是空的，去登记租客信息吧</Text>
              <View className="guide-card-btn" onClick={goToAddTenant}>
                <Text className="guide-card-btn-text">去登记</Text>
              </View>
            </View>
          )}

          {showQrGuide && (
            <View className="elder-card guide-card">
              <Text className="elder-card-title">设置收款码</Text>
              <Text className="elder-card-desc">设置收款码后租客可以直接扫码付款</Text>
              <View className="guide-card-btn" onClick={switchToMy}>
                <Text className="guide-card-btn-text">去设置</Text>
              </View>
            </View>
          )}

          {/* Pending Alert */}
          <View className="elder-card" onClick={switchToRent}>
            <View className="elder-card-row">
              <View className="elder-card-left">
                <Text className="elder-card-title">待收租</Text>
                <Text className="elder-card-desc">{pendingDesc || '暂无待收租'}</Text>
              </View>
              <View className="elder-card-right">
                <Text className="elder-number danger">{pendingHouseholds}</Text>
                <Text className="elder-number-label danger">户</Text>
              </View>
            </View>
            <View className="elder-card-btn danger-btn" onClick={(e) => { e.stopPropagation(); switchToRent(); }}>
              <Text className="danger-btn-text">去提醒</Text>
            </View>
          </View>

          {/* Monthly Stats */}
          <View className="elder-card">
            <View className="elder-card-row">
              <View className="elder-card-left">
                <Text className="elder-card-title">本月已收到</Text>
                <Text className="elder-card-desc">点了&ldquo;已收到&rdquo;后，金额会加到这里</Text>
              </View>
              <View className="elder-card-right">
                <Text className="elder-number success">{monthlyCollected.toLocaleString()}</Text>
                <Text className="elder-number-label">元</Text>
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View className="elder-card">
            <Text className="elder-card-title" style={{ marginBottom: '16px' }}>常用功能</Text>
            <Text className="elder-card-desc" style={{ marginBottom: '20px' }}>快速管理房间、租客和收款码</Text>
            <View className="quick-actions-grid">
              <View className="quick-action-btn" onClick={switchToRooms}>
                <Text className="quick-action-btn-text">房间资料</Text>
              </View>
              <View className="quick-action-btn" onClick={goToRentStats}>
                <Text className="quick-action-btn-text">简单统计</Text>
              </View>
              <View className="quick-action-btn" onClick={goToAddTenant}>
                <Text className="quick-action-btn-text">入住信息</Text>
              </View>
              <View className="quick-action-btn" onClick={switchToMy}>
                <Text className="quick-action-btn-text">我的设置</Text>
              </View>
            </View>
          </View>

          <View style={{ height: '160px' }} />
        </>
      )}
    </ScrollView>
  );
}
