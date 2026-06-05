import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import ConfirmModal from '../../components/ConfirmModal';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import { useState, useCallback } from 'react';
import { get, put, del } from '../../services/request';
import './index.scss';

interface RoomData {
  id: number;
  name: string;
  rent: number;
  area?: string;
  floor?: string;
  orientation?: string;
  facilities?: string[];
  images?: string[];
  status: number;
  propertyId: number;
}

interface TenantData {
  id: number;
  name: string;
  phone: string;
  rentDay?: number;
  contractEndDate?: string;
}

interface PropertyData {
  id: number;
  name: string;
}

export default function RoomDetail() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const roomId = Number(routerParams.roomId) || 0;
  const urlPropertyId = Number(routerParams.propertyId) || 0;

  const [room, setRoom] = useState<RoomData | null>(null);
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [roomStatus, setRoomStatus] = useState('空着');
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await get<any>(`/rooms/${roomId}`);
      if (res.code === 0 && res.data) {
        const data = res.data;
        setRoom(data.room || data);
        setTenant(data.tenant || null);
        setProperty(data.property || null);
        setRoomStatus(data.room?.status === 1 ? '已租' : '空着');
        if (data.tenant) {
          setTenantId(data.tenant.id);
        }
      }
    } catch (err) {
      console.error('[RoomDetail] 加载房间失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useDidShow(() => {
    loadData();
  });

  const goBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  const showToast = useCallback((msg: string) => {
    Taro.showToast({ title: msg, icon: 'none', duration: 2000 });
  }, []);

  const handleCheckout = useCallback(async () => {
    setCheckoutVisible(false);
    try {
      await put(`/rooms/${roomId}`, { status: 0, action: 'checkout' });
      setTenant(null);
      setRoomStatus('空着');
      Taro.showToast({ title: '退租成功', icon: 'none', duration: 1500 });
    } catch (err) {
      console.error('[RoomDetail] 退租失败:', err);
      Taro.showToast({ title: '退租失败', icon: 'none' });
    }
  }, [roomId]);

  const handleDeleteRoom = useCallback(async () => {
    setDeleteVisible(false);
    try {
      await del(`/rooms/${roomId}`);
      Taro.showToast({ title: '已删除，页面即将返回', icon: 'none', duration: 1500 });
      setTimeout(() => {
        Taro.navigateBack();
      }, 800);
    } catch (err) {
      console.error('[RoomDetail] 删除房间失败:', err);
      Taro.showToast({ title: '删除失败', icon: 'none' });
    }
  }, [roomId]);

  const getStatusLabel = () => {
    if (room?.status === 1) return '已租';
    return '空着';
  };

  const getStatusClass = () => {
    const s = room?.status;
    if (s === 1) return 'green';
    return 'gray';
  };

  const rentDayText = tenant?.rentDay !== undefined
    ? (tenant.rentDay === 0 ? '月底' : `每月 ${tenant.rentDay} 号`)
    : '-';

  const placeholderImage = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" fill="#f0ebe3"><rect width="800" height="500"/><text x="400" y="250" text-anchor="middle" fill="#c4b8a8" font-size="32" font-family="sans-serif">暂无图片</text></svg>');

  return (
    <View className="page-room-detail">
      <NavBar
        title={room?.name || '房间详情'}
        onBack={goBack}
        rightActions={[
          {
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" stroke="var(--text-secondary)" strokeWidth="1.8" fill="none">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
            ),
            onClick: () => showToast('已生成分享图片，可以发给租客了'),
          },
        ]}
      />

      <ScrollView className="detail-scroll" scrollY>
        {loading && <Loading />}
        {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
        {!loading && !error && room && (
          <>
        {/* Breadcrumb */}
        <View className="breadcrumb">
          <svg width="14" height="14" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth="1.8" fill="none">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
          <Text className="breadcrumb-text">{property?.name || '房源'}</Text>
          <svg width="12" height="12" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth="1.8" fill="none">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <Text className="breadcrumb-current">{room?.name || ''}</Text>
        </View>

        {/* Room Image */}
        <View className="room-image">
          <Image
            className="room-image-img"
            src={room?.images?.[0] || placeholderImage}
            mode="aspectFill"
          />
        </View>

        {/* Room Info Card */}
        <View className="detail-card">
          <View className="detail-card-header">
            <Text className="detail-room-name">{room?.name || ''}</Text>
            <View className={`status-tag ${getStatusClass()}`}>
              <Text className="status-tag-text">{getStatusLabel()}</Text>
            </View>
          </View>
          <Text className="detail-room-rent">
            {room?.rent?.toLocaleString() ?? '-'} 元
            <Text className="rent-unit"> /月</Text>
          </Text>
          <View className="detail-divider" />
          <View className="detail-info-grid">
            <View className="info-item">
              <Text className="info-label">租客</Text>
              {tenant ? (
                <Text className="info-value">{tenant.name}</Text>
              ) : (
                <View className="info-value-row">
                  <Text className="info-value hint">暂未登记租客</Text>
                  <Text className="info-action-link" onClick={() => Taro.navigateTo({ url: `/pages/add-tenant/index?roomId=${roomId}` })}>去登记</Text>
                </View>
              )}
            </View>
            <View className="info-item">
              <Text className="info-label">电话</Text>
              <Text className="info-value">{tenant?.phone ?? '-'}</Text>
            </View>
            <View className="info-item">
              <Text className="info-label">收租日</Text>
              <Text className="info-value">{rentDayText}</Text>
            </View>
            <View className="info-item">
              <Text className="info-label">合同到期</Text>
              <Text className="info-value">{tenant?.contractEndDate || '-'}</Text>
            </View>
          </View>
        </View>

        {/* Monthly Amount Card */}
        <View
          className="detail-card card-glow monthly-card"
          onClick={() => {
            Taro.navigateTo({ url: `/pages/bill/index?roomId=${roomId}${tenantId ? `&tenantId=${tenantId}` : ''}` });
          }}
        >
          <View className="monthly-row">
            <View className="monthly-left">
              <Text className="monthly-label">每月应收</Text>
              <Text className="monthly-value">
                {room?.rent?.toLocaleString() ?? '-'} 元
              </Text>
            </View>
            <View className="monthly-right">
              <Text className="monthly-breakdown">
                房租 {room?.rent?.toLocaleString() ?? '-'}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="section-header">
          <Text className="section-title">常用操作</Text>
        </View>
        <View className="quick-actions">
          {[
            {
              label: '发给租客',
              icon: (<svg viewBox="0 0 24 24" stroke="var(--accent-hover)" strokeWidth="1.8" fill="none"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>),
              action: () => showToast('已生成分享图片，可以发给租客了'),
            },
            {
              label: '登记租客',
              icon: (<svg viewBox="0 0 24 24" stroke="var(--accent-hover)" strokeWidth="1.8" fill="none"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>),
              action: () => Taro.navigateTo({ url: `/pages/add-tenant/index?roomId=${roomId}` }),
            },
            {
              label: '发账单',
              icon: (<svg viewBox="0 0 24 24" stroke="var(--accent-hover)" strokeWidth="1.8" fill="none"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>),
              action: () => Taro.navigateTo({ url: `/pages/bill/index?roomId=${roomId}${tenantId ? `&tenantId=${tenantId}` : ''}` }),
            },
            {
              label: '收款码',
              icon: (<svg viewBox="0 0 24 24" stroke="var(--accent-hover)" strokeWidth="1.8" fill="none"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><line x1="21" y1="14" x2="21" y2="14.01"/><line x1="21" y1="21" x2="21" y2="21.01"/></svg>),
              action: () => Taro.navigateTo({ url: '/pages/qr-code/index' }),
            },
            {
              label: '收租记录',
              icon: (<svg viewBox="0 0 24 24" stroke="var(--accent-hover)" strokeWidth="1.8" fill="none"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>),
              action: () => Taro.navigateTo({ url: `/pages/records/index?roomId=${roomId}` }),
            },
            {
              label: showMoreActions ? '收起' : '更多',
              icon: showMoreActions ? (
                <svg viewBox="0 0 24 24" stroke="var(--text-secondary)" strokeWidth="1.8" fill="none"><polyline points="6 15 12 9 18 15"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" stroke="var(--text-secondary)" strokeWidth="1.8" fill="none"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              ),
              action: () => setShowMoreActions(!showMoreActions),
              isMore: true,
            },
          ].map((item, idx) => (
            <View key={idx} className={`quick-action-item${item.isMore ? ' more-action' : ''}`} onClick={item.action}>
              {item.icon}
              <Text className="quick-action-label">{item.label}</Text>
            </View>
          ))}
        </View>

        {showMoreActions && (
          <View className="quick-actions more-actions">
            {[
              {
                label: '单独收',
                icon: (<svg viewBox="0 0 24 24" stroke="var(--accent-hover)" strokeWidth="1.8" fill="none"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>),
                action: () => Taro.navigateTo({ url: `/pages/single-charge/index?roomId=${roomId}` }),
              },
              {
                label: '合同收据',
                icon: (<svg viewBox="0 0 24 24" stroke="var(--accent-hover)" strokeWidth="1.8" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>),
                action: () => Taro.navigateTo({ url: `/pages/contracts/index?roomId=${roomId}` }),
              },
              {
                label: '每月要收',
                icon: (<svg viewBox="0 0 24 24" stroke="var(--accent-hover)" strokeWidth="1.8" fill="none"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>),
                action: () => Taro.navigateTo({ url: `/pages/fee-setup/index?roomId=${roomId}` }),
              },
            ].map((item, idx) => (
              <View key={idx} className="quick-action-item" onClick={item.action}>
                {item.icon}
                <Text className="quick-action-label">{item.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Tenant Management */}
        {tenant && (
          <View className="section-header">
            <Text className="section-title">租客管理</Text>
          </View>
        )}
        {tenant && (
          <View className="more-list">
            <View
              className="more-item checkout-item"
              onClick={() => setCheckoutVisible(true)}
            >
              <View className="more-icon red-bg">
                <svg width="20" height="20" viewBox="0 0 24 24" stroke="var(--danger)" strokeWidth="1.8" fill="none">
                  <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1"/>
                </svg>
              </View>
              <Text className="more-text">退租</Text>
              <svg width="16" height="16" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth="1.8" fill="none">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </View>
          </View>
        )}

        {/* More Records */}
        <View className="section-header">
          <Text className="section-title">更多记录</Text>
        </View>
        <View className="more-list">
          {[
            {
              label: '押金',
              iconBg: 'orange-bg',
              icon: (<svg viewBox="0 0 24 24" stroke="var(--warning)" strokeWidth="1.8" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>),
              action: () => showToast('押金功能即将上线'),
            },
            {
              label: '水电',
              iconBg: 'blue-bg',
              icon: (<svg viewBox="0 0 24 24" stroke="var(--accent-hover)" strokeWidth="1.8" fill="none"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>),
              action: () => showToast('水电记录功能即将上线'),
            },
            {
              label: '维修',
              iconBg: 'red-bg',
              icon: (<svg viewBox="0 0 24 24" stroke="var(--danger)" strokeWidth="1.8" fill="none"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>),
              action: () => showToast('维修记录功能即将上线'),
            },
            {
              label: '备注',
              iconBg: 'gray-bg',
              icon: (<svg viewBox="0 0 24 24" stroke="var(--text-secondary)" strokeWidth="1.8" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
              action: () => showToast('备注功能即将上线'),
            },
            {
              label: '删除',
              iconBg: 'red-bg',
              icon: (<svg viewBox="0 0 24 24" stroke="var(--danger)" strokeWidth="1.8" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>),
              action: () => setDeleteVisible(true),
            },
          ].map((item, idx) => (
            <View key={idx} className="more-item" onClick={item.action}>
              <View className={`more-icon ${item.iconBg}`}>{item.icon}</View>
              <Text className="more-text">{item.label}</Text>
              <svg width="16" height="16" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth="1.8" fill="none">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </View>
          ))}
        </View>

        <View style={{ height: '40px' }} />
          </>
        )}
      </ScrollView>

      <ConfirmModal
        visible={checkoutVisible}
        title="确认退租"
        confirmText="确认退租"
        onConfirm={handleCheckout}
        onCancel={() => setCheckoutVisible(false)}
      />

      <ConfirmModal
        visible={deleteVisible}
        title="确认删除该房间？"
        confirmText="确认删除"
        onConfirm={handleDeleteRoom}
        onCancel={() => setDeleteVisible(false)}
      />
    </View>
  );
}
