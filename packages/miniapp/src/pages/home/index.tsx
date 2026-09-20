import { View, Text, ScrollView, Image, Button } from '@tarojs/components';
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro';
import { useState, useCallback, useRef } from 'react';
import { get, post, put } from '../../services/request';
import { useAuthStore } from '../../store/useAuthStore';
import { useGuideStore } from '../../store/useGuideStore';
// requestNotification re-added — tied to tap gestures below (receipt cards,
// 去收租 CTA), never to useDidShow (page-load calls fail without a TAP stack).
import { requestNotification } from '../../services/notification';
import { APP_NAME, RENT_LIST_TAB_INDEX } from '../../constants/app';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import { promptDemoLogin } from '../../utils/demo-data';
import heroImg from '../../assets/home/home-hero-illustration.png';
import bellImg from '../../assets/home/home-reminder-bell.png';
import billIcon from '../../assets/home/home-icon-checkin.png';
import rentIcon from '../../assets/home/home-icon-room.png';
import addIcon from '../../assets/home/home-icon-source.png';
import statsIcon from '../../assets/home/home-icon-stats.png';
import shareCardImg from '../../assets/home/home-share-card.jpg';
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

// Filter out legacy dirty data like "房东OP11N23A" / "房东op11n3a-" — these
// came from an old auto-name scheme that appended openId prefixes (possibly
// with trailing punctuation). Detect "房东 + purely ASCII suffix" → collapse
// to just "房东" (keep the role label, drop the noise). Legit names like
// "房东小明" / "张三" are preserved as-is.
const cleanProfileName = (name: string): string => {
  if (!name) return '';
  if (/^房东[a-zA-Z0-9\-_.]+$/.test(name)) return '房东';
  return name;
};

interface VacantRoom {
  roomId: number;
  roomName: string;
  propertyName: string;
}

interface ReceiptConfirmation {
  kind: 'bill' | 'single_charge';
  id: number;
  roomName: string;
  tenantName: string;
  label: string;
  amount: number;
  sharedAt: string;
}

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
  vacantRooms: VacantRoom[];
  receiptConfirmations: ReceiptConfirmation[];
  receiptConfirmationCount: number;
}

interface DiscoveryAlert {
  roomId?: number;
  message?: string;
}

const emptyData: PageData = {
  greeting: '', pendingCount: 0, pendingDesc: '', pendingHouseholds: 0,
  monthlyCollected: 0, showRoomGuide: false, showTenantGuide: false,
  showQrGuide: false, profileName: '', expiringContracts: [], discoveryAlerts: [],
  vacantRooms: [], receiptConfirmations: [], receiptConfirmationCount: 0,
};

export default function Home() {
  const [data, setData] = useState<PageData>(emptyData);
  const [loading, setLoading] = useState(() => useAuthStore.getState().isLoggedIn);
  const [error, setError] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const loadedUserIdRef = useRef<number | null>(null);
  const loadSequenceRef = useRef(0);

  const handleLogin = async (phoneCode?: string) => {
    if (loginLoading) return;
    setLoginLoading(true);
    try {
      await useAuthStore.getState().login(phoneCode);
      setLoginLoading(false);
      loadData();
      // Note: requestSubscribeMessage cannot be called here — it must run
      // inside the user TAP gesture's sync stack, but we're now past an await.
      // Subscription requests are made from action buttons (confirm payment,
      // save tenant) where the sync chain is preserved.
    } catch (err: any) {
      setLoginLoading(false);
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
    }
  };

  const handlePhoneLogin = (event: any) => {
    const phoneCode = event?.detail?.code || '';
    void handleLogin(phoneCode);
  };

  const loadData = useCallback(async () => {
    const authState = useAuthStore.getState();
    const activeUserId = authState.user?.id || null;
    const sequence = ++loadSequenceRef.current;
    if (!authState.isLoggedIn || !activeUserId) {
      loadedUserIdRef.current = null;
      setLoading(false);
      setError(false);
      setData({ ...emptyData, greeting: getGreeting() });
      return;
    }
    const isInitialLoad = loadedUserIdRef.current !== activeUserId;
    if (isInitialLoad) {
      setLoading(true);
      setError(false);
    }
    try {
      const statsRes = await get<any>('/stats/home');
      const latestAuthState = useAuthStore.getState();
      if (sequence !== loadSequenceRef.current || latestAuthState.user?.id !== activeUserId) return;
      const s = statsRes.data || {};
      const todoCount = Number(s.todoCount || 0);
      setData({
        greeting: getGreeting(),
        pendingCount: todoCount,
        pendingDesc: s.pendingDesc || '',
        pendingHouseholds: s.pendingHouseholds || 0,
        monthlyCollected: s.monthlyCollected || 0,
        showRoomGuide: s.showRoomGuide || false,
        showTenantGuide: s.showTenantGuide || false,
        showQrGuide: s.showQrGuide || false,
        profileName: s.profileName || '',
        expiringContracts: s.expiringContracts || [],
        discoveryAlerts: s.discoveryAlerts || [],
        vacantRooms: s.vacantRooms || [],
        receiptConfirmations: Array.isArray(s.receiptConfirmations) ? s.receiptConfirmations : [],
        receiptConfirmationCount: Number(s.receiptConfirmationCount || 0),
      });
      loadedUserIdRef.current = activeUserId;
      setError(false);
      useGuideStore.getState().setFromStats({
        showRoomGuide: s.showRoomGuide,
        showTenantGuide: s.showTenantGuide,
        showQrGuide: s.showQrGuide,
        firstVacantRoomId: s.firstVacantRoomId,
      });
      // Sync rent-list tab badge with pending count
      try {
        if (todoCount > 0) {
          Taro.setTabBarBadge({ index: RENT_LIST_TAB_INDEX, text: String(Math.min(todoCount, 99)) });
        } else {
          Taro.removeTabBarBadge({ index: RENT_LIST_TAB_INDEX });
        }
      } catch (e) {
        // setTabBarBadge may fail on first render; ignore
      }
    } catch (err) {
      console.error('[Home] 加载数据失败:', err);
      if (sequence === loadSequenceRef.current && isInitialLoad) {
        setError(true);
      }
    } finally {
      if (sequence === loadSequenceRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: APP_NAME });
    // Taro 3.6 typings do not include `menus`, but the WeChat runtime does.
    (Taro.showShareMenu as any)({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    });
    // Do not silently log in on page show. New users must browse first and
    // choose login themselves from the visible banner (WeChat review rule).
    void loadData();
    // Note: requestSubscribeMessage is NOT called here — it requires a user
    // TAP gesture's sync stack. Page-load prompts would fail. Subscription
    // requests are tied to user-initiated actions (confirm/save buttons).
  });

  useShareAppMessage(() => ({
    title: `${APP_NAME}｜房间·租客·收租，轻松管理`,
    path: '/pages/home/index',
    imageUrl: shareCardImg,
  }));

  useShareTimeline(() => ({
    title: `${APP_NAME}｜房间·租客·收租，轻松管理`,
    query: '',
    imageUrl: shareCardImg,
  }));

  const currentReceipt = data.receiptConfirmations[0];
  const hasPendingActions = !!currentReceipt || data.pendingCount > 0 || data.expiringContracts.length > 0;

  const hideReceiptCardsForVisit = useCallback(() => {
    setData(prev => ({
      ...prev,
      // Do not turn the home page into a questionnaire. At most one prompt is
      // shown per visit; other eligible records can appear on a later visit.
      receiptConfirmations: [],
      receiptConfirmationCount: Math.max(0, prev.receiptConfirmationCount - 1),
    }));
  }, []);

  const handleReceiptConfirmed = useCallback(async () => {
    requestNotification();
    if (!currentReceipt || receiptLoading) return;
    setReceiptLoading(true);
    try {
      if (currentReceipt.kind === 'bill') {
        await put(`/bills/${currentReceipt.id}/confirm`, { actualAmount: currentReceipt.amount });
      } else {
        await put(`/single-charges/${currentReceipt.id}/confirm`, {});
      }
      await loadData();
      hideReceiptCardsForVisit();
      Taro.showToast({ title: '已记为收到', icon: 'success' });
    } catch (err) {
      console.error('[Home] 确认收款失败:', err);
      Taro.showToast({ title: '确认失败，请重试', icon: 'none' });
    } finally {
      setReceiptLoading(false);
    }
  }, [currentReceipt, receiptLoading, loadData, hideReceiptCardsForVisit]);

  const handleReceiptNotYet = useCallback(async () => {
    requestNotification();
    if (!currentReceipt || receiptLoading) return;
    setReceiptLoading(true);
    try {
      await post('/share/receipt-prompt/dismiss', {
        kind: currentReceipt.kind,
        id: currentReceipt.id,
      });
      hideReceiptCardsForVisit();
      Taro.showToast({ title: '本次不再提醒', icon: 'none' });
    } catch (err) {
      console.error('[Home] 关闭收款提醒失败:', err);
      Taro.showToast({ title: '操作失败，请重试', icon: 'none' });
    } finally {
      setReceiptLoading(false);
    }
  }, [currentReceipt, receiptLoading, hideReceiptCardsForVisit]);

  const handleDiscoveryAlert = useCallback((alert?: DiscoveryAlert) => {
    if (!alert) return;
    if (Number(alert.roomId) > 0) {
      Taro.navigateTo({ url: `/pages/room-detail/index?roomId=${alert.roomId}` });
      return;
    }
    // Summary alerts (such as several rooms sharing one rent day) do not have
    // a single room target. The rent list is still the actionable destination.
    Taro.switchTab({ url: '/pages/rent-list/index' });
  }, []);

  const handleStatsTap = () => {
    if (!useAuthStore.getState().isLoggedIn) {
      Taro.showModal({
        title: '登录后看统计',
        content: '收租统计需要登录后查看，微信一键登录很快',
        confirmText: '去登录',
        cancelText: '先逛逛',
        success: (res) => {
          if (res.confirm) handleLogin();
        },
      });
      return;
    }
    Taro.navigateTo({ url: '/pages/rent-stats/index' });
  };

  return (
    <ScrollView className="page-home" scrollY>
      {!isLoggedIn && (
        <>
          <View className="greeting">
            <View className="greeting-name-wrap">
              <Text className="greeting-name">房东你好</Text>
            </View>
            <View className="greeting-subtitle-wrap">
              <Text className="greeting-subtitle">看看它怎么帮你收租</Text>
            </View>
          </View>

          <View className="action-hero">
            <View className="home-action-card action-rent" onClick={() => Taro.switchTab({ url: '/pages/rent-list/index' })}>
              <View className="home-action-card-left">
                <Text className="action-badge">3笔</Text>
                <Text className="action-title">待收租</Text>
                <Text className="action-desc">张先生的房租拖欠6天了</Text>
              </View>
              <View className="action-go">
                <Text className="action-go-text">去看看</Text>
              </View>
            </View>

            <View className="home-action-card action-contract">
              <View className="action-contract-row" onClick={promptDemoLogin}>
                <View className="action-contract-info">
                  <Text className="action-contract-name">3栋-202 · 张先生</Text>
                  <Text className="action-contract-date">合同还有30天到期</Text>
                </View>
                <Text style={{ fontSize: '24px', color: 'var(--text-hint)', lineHeight: 1 }}>›</Text>
              </View>
            </View>
          </View>

          <View className="guest-banner">
            <Text className="guest-banner-title">管理我的房间</Text>
            <Button
              className="guest-banner-btn"
              openType="getPhoneNumber"
              disabled={loginLoading}
              onGetPhoneNumber={handlePhoneLogin}
            >
              <Text className="guest-banner-btn-text">{loginLoading ? '登录中…' : '登录'}</Text>
            </Button>
          </View>

          <View className="monthly-card" onClick={handleStatsTap}>
            <View className="monthly-row">
              <View className="monthly-left">
                <Text className="monthly-title">本月已收到</Text>
                <Text className="monthly-desc">点了"已收到"后金额会加到这里</Text>
              </View>
              <View className="monthly-right">
                <Text className="monthly-number success">1,500</Text>
                <Text className="monthly-label">元</Text>
              </View>
            </View>
          </View>

          <View className="guest-intro">
            <View className="guest-intro-card">
              <Text className="guest-intro-icon">🏠</Text>
              <View className="guest-intro-body">
                <Text className="guest-intro-title">管住房间</Text>
                <Text className="guest-intro-desc">几处房子、几十间房，一眼看清谁住着、谁空着</Text>
              </View>
            </View>
            <View className="guest-intro-card">
              <Text className="guest-intro-icon">💰</Text>
              <View className="guest-intro-body">
                <Text className="guest-intro-title">算清每笔账</Text>
                <Text className="guest-intro-desc">房租水电一键生成账单，发给租客不费劲</Text>
              </View>
            </View>
            <View className="guest-intro-card">
              <Text className="guest-intro-icon">🔔</Text>
              <View className="guest-intro-body">
                <Text className="guest-intro-title">到日子提醒</Text>
                <Text className="guest-intro-desc">收租日、合同到期、逾期，微信主动提醒你</Text>
              </View>
            </View>
          </View>
        </>
      )}
      {loading && <Loading />}
      {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
      {!loading && !error && isLoggedIn && (
        <>
          {/* Greeting */}
          <View className="greeting">
            <View className="greeting-name-wrap">
              <Text className="greeting-name">{cleanProfileName(data.profileName) ? `${cleanProfileName(data.profileName)}，` : ''}{data.greeting}</Text>
            </View>
            <View className="greeting-subtitle-wrap">
              <Text className="greeting-subtitle">{hasPendingActions ? '有事情需要你处理' : '今天要做的事'}</Text>
            </View>
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
              {currentReceipt && (
                <View className="receipt-check-card">
                  <Text className="receipt-check-kicker">刚刚发出的账单</Text>
                  <Text className="receipt-check-question">这笔钱收到了吗？</Text>
                  <Text className="receipt-check-person">
                    {currentReceipt.roomName}{currentReceipt.tenantName ? ` · ${currentReceipt.tenantName}` : ''}
                  </Text>
                  <View className="receipt-check-money-row">
                    <Text className="receipt-check-label">{currentReceipt.label}</Text>
                    <Text className="receipt-check-money">{currentReceipt.amount.toLocaleString()} 元</Text>
                  </View>
                  <View className="receipt-check-actions">
                    <View
                      className={`receipt-check-btn secondary${receiptLoading ? ' disabled' : ''}`}
                      onClick={receiptLoading ? undefined : handleReceiptNotYet}
                    >
                      <Text>还没收到</Text>
                    </View>
                    <View
                      className={`receipt-check-btn primary${receiptLoading ? ' disabled' : ''}`}
                      onClick={receiptLoading ? undefined : handleReceiptConfirmed}
                    >
                      <Text>{receiptLoading ? '处理中…' : '已经收到'}</Text>
                    </View>
                  </View>
                  {data.receiptConfirmationCount > 1 && (
                    <Text className="receipt-check-more">其余 {data.receiptConfirmationCount - 1} 笔将在以后进入首页时提醒</Text>
                  )}
                </View>
              )}

              {data.pendingCount > 0 && (
                <View className="home-action-card action-rent" onClick={() => { requestNotification(); Taro.switchTab({ url: '/pages/rent-list/index' }); }}>
                  <View className="home-action-card-left">
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
                <View className="home-action-card action-contract">
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
            <View className="reminder-card" onClick={() => handleDiscoveryAlert(data.discoveryAlerts[0])}>
              <View className="reminder-icon"><Image src={bellImg} mode="aspectFit" /></View>
              <View className="reminder-body">
                <Text className="reminder-title">你可能漏了</Text>
                {data.discoveryAlerts.slice(0, 2).map((alert: any, idx: number) => (
                  <View
                    key={idx}
                    className="reminder-item"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDiscoveryAlert(alert);
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
            <View
              className="monthly-card"
              onClick={() => Taro.navigateTo({ url: '/pages/rent-stats/index' })}
            >
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

          {/* Guide Cards */}
          {data.showRoomGuide && (
            <View className="guide-card">
              <Text className="guide-card-title">还没有房间</Text>
              <Text className="guide-card-desc">你还没有添加房间，收租需要先有房间哦</Text>
              <View className="guide-card-btn" onClick={() => Taro.navigateTo({ url: '/pages/add-property/index' })}>
                <Text className="guide-card-btn-text">添加房源</Text>
              </View>
            </View>
          )}

          {data.showTenantGuide && (
            <View className="guide-card">
              <Text className="guide-card-title">房间空着呢</Text>
              <Text className="guide-card-desc">房间还是空的，去登记租客信息吧</Text>
              <View
                className="guide-card-btn"
                onClick={() => {
                  const rooms = data.vacantRooms || [];
                  if (rooms.length === 0) {
                    Taro.switchTab({ url: '/pages/rooms/index' });
                    return;
                  }
                  if (rooms.length === 1) {
                    Taro.navigateTo({ url: `/pages/add-tenant/index?roomId=${rooms[0].roomId}` });
                    return;
                  }
                  // Multiple vacant rooms — let the user pick
                  Taro.showActionSheet({
                    itemList: rooms.map(r => r.propertyName ? `${r.roomName}（${r.propertyName}）` : r.roomName),
                    success: (res) => {
                      const picked = rooms[res.tapIndex];
                      if (picked) {
                        Taro.navigateTo({ url: `/pages/add-tenant/index?roomId=${picked.roomId}` });
                      }
                    },
                  });
                }}
              >
                <Text className="guide-card-btn-text">去登记</Text>
              </View>
            </View>
          )}

          {data.showQrGuide && (
            <View className="guide-card">
              <Text className="guide-card-title">设置收款码</Text>
              <Text className="guide-card-desc">设置收款码后租客可以直接扫码付款</Text>
              <View className="guide-card-btn" onClick={() => Taro.navigateTo({ url: '/pages/qr-code/index' })}>
                <Text className="guide-card-btn-text">去设置</Text>
              </View>
            </View>
          )}

          <View style={{ height: '40px' }} />
        </>
      )}

      {/* Function Section — visible pre-login so the app is browsable
          (review requirement: browse first, login on demand) */}
      <View className="function-section">
        <View className="function-header">
          <Text className="function-title">常用功能</Text>
          <Text className="function-desc">高频操作一键直达</Text>
        </View>
        <View className="function-grid">
          <View className="feature-card" onClick={() => Taro.switchTab({ url: '/pages/rooms/index' })}>
            <View className="feature-icon room"><Image src={billIcon} mode="aspectFit" /></View>
            <Text className="feature-label">我的房间</Text>
            <Text className="feature-arrow">›</Text>
          </View>
          <View className="feature-card" onClick={() => Taro.switchTab({ url: '/pages/rent-list/index' })}>
            <View className="feature-icon stats"><Image src={rentIcon} mode="aspectFit" /></View>
            <Text className="feature-label">收租列表</Text>
            <Text className="feature-arrow">›</Text>
          </View>
          <View
            className="feature-card"
            onClick={() => {
              if (!useAuthStore.getState().isLoggedIn) {
                promptDemoLogin();
                return;
              }
              Taro.navigateTo({ url: '/pages/add-room-photo/index' });
            }}
          >
            <View className="feature-icon checkin"><Image src={addIcon} mode="aspectFit" /></View>
            <Text className="feature-label">添加房间</Text>
            <Text className="feature-arrow">›</Text>
          </View>
          <View className="feature-card" onClick={handleStatsTap}>
            <View className="feature-icon source"><Image src={statsIcon} mode="aspectFit" /></View>
            <Text className="feature-label">收租统计</Text>
            <Text className="feature-arrow">›</Text>
          </View>
        </View>
      </View>

      <View style={{ height: '120px' }} />
    </ScrollView>
  );
}
