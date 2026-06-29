import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import Icon from '../../components/Icon';
import ConfirmModal from '../../components/ConfirmModal';
import DepositModal from '../../components/DepositModal';
import { resolveAsset } from '../../config';
import NoteEditModal from '../../components/NoteEditModal';
import ContractRenewModal from '../../components/ContractRenewModal';
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
  note?: string;
}

interface TenantData {
  id: number;
  name: string;
  phone: string;
  rentDay?: number;
  contractEndDate?: string;
  moveInDate?: string;
  deposit?: number;
  moveInReading?: string;
  moveOutReading?: string;
  initialPaymentMethod?: string | null;
  initialPaymentDate?: string | null;
  initialPaymentAmount?: number | null;
}

interface MoveOutPreview {
  prepaidRefund: number;
  latestPaidPeriodEnd: string | null;
}

interface ActivePartialPayment {
  count: number;
  totalPaid: number;
}

interface PropertyData {
  id: number;
  name: string;
}

interface HistoryTenant {
  id: number;
  name: string;
  phone: string;
  moveInDate: string;
  moveOutDate: string;
}

interface PageData {
  room: RoomData | null;
  tenant: TenantData | null;
  property: PropertyData | null;
  historyTenants: HistoryTenant[];
  roomStatus: string;
  tenantId: number | null;
  loading: boolean;
  error: boolean;
  checkoutVisible: boolean;
  depositVisible: boolean;
  deleteVisible: boolean;
  showMoreActions: boolean;
  noteModalVisible: boolean;
  renewModalVisible: boolean;
  moveOutPreview: MoveOutPreview | null;
  activePartialPayment: ActivePartialPayment | null;
}

const emptyPageData: PageData = {
  room: null,
  tenant: null,
  property: null,
  historyTenants: [],
  roomStatus: '空着',
  tenantId: null,
  loading: false,
  error: false,
  checkoutVisible: false,
  depositVisible: false,
  deleteVisible: false,
  showMoreActions: false,
  noteModalVisible: false,
  renewModalVisible: false,
  moveOutPreview: null,
  activePartialPayment: null,
};

export default function RoomDetail() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const roomId = Number(routerParams.roomId) || 0;
  const urlPropertyId = Number(routerParams.propertyId) || 0;

  const [data, setData] = useState<PageData>(emptyPageData);

  const loadData = useCallback(async () => {
    if (!roomId) return;
    setData(prev => ({ ...prev, loading: true, error: false }));
    try {
      const res = await get<any>(`/rooms/${roomId}`);
      if (res.code === 0 && res.data) {
        const d = res.data;
        setData(prev => ({
          ...prev,
          room: d,
          tenant: d.tenant || null,
          property: d.property || null,
          historyTenants: d.historyTenants || [],
          roomStatus: d.status === 1 ? '已租' : '空着',
          tenantId: d.tenant ? d.tenant.id : null,
          moveOutPreview: d.moveOutPreview || null,
          activePartialPayment: d.activePartialPayment || null,
        }));
        Taro.setNavigationBarTitle({ title: d.name || '房间详情' });
      }
    } catch (err) {
      console.error('[RoomDetail] 加载房间失败:', err);
      setData(prev => ({ ...prev, error: true }));
    } finally {
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [roomId]);

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: data.room?.name || '房间详情' });
    loadData();
  });

  const showToast = useCallback((msg: string) => {
    Taro.showToast({ title: msg, icon: 'none', duration: 2000 });
  }, []);

  const handleCheckout = useCallback(() => {
    // Close confirm modal, open deposit modal
    setData(prev => ({ ...prev, checkoutVisible: false, depositVisible: true }));
  }, []);

  const handleCheckoutSubmit = useCallback(async (depositData?: {
    depositStatus: number;
    refundAmount: number;
    deductReason: string;
    moveOutReading?: string;
  }) => {
    setData(prev => ({ ...prev, depositVisible: false }));
    try {
      await put(`/rooms/${roomId}`, {
        status: 0,
        action: 'checkout',
        ...(depositData || { depositStatus: 0 }),
      });
      setData(prev => ({ ...prev, tenant: null, roomStatus: '空着', moveOutPreview: null }));
      Taro.showModal({
        title: '退租成功',
        content: '房间已变为空置状态，是否立即登记新租客？',
        confirmText: '登记新租客',
        cancelText: '稍后再说',
        success: (res) => {
          if (res.confirm) {
            Taro.navigateTo({ url: `/pages/add-tenant/index?roomId=${roomId}` });
          }
        },
      });
    } catch (err) {
      console.error('[RoomDetail] 退租失败:', err);
      Taro.showToast({ title: '退租失败', icon: 'none' });
    }
  }, [roomId]);

  const handleDeleteRoom = useCallback(async () => {
    setData(prev => ({ ...prev, deleteVisible: false }));
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

  const handleNoteSave = useCallback(async (note: string) => {
    try {
      await put(`/rooms/${roomId}`, { note });
      setData(prev => ({ ...prev, noteModalVisible: false, room: prev.room ? { ...prev.room, note } : null }));
      Taro.showToast({ title: '备注已保存', icon: 'success', duration: 1500 });
    } catch (err) {
      console.error('[RoomDetail] 保存备注失败:', err);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    }
  }, [roomId]);

  const handleRenew = useCallback(async (newEndDate: string) => {
    if (!data.tenantId) {
      Taro.showToast({ title: '租客信息缺失', icon: 'none' });
      return;
    }
    try {
      await put(`/tenants/${data.tenantId}`, { contractEndDate: newEndDate });
      setData(prev => ({
        ...prev,
        renewModalVisible: false,
        tenant: prev.tenant ? { ...prev.tenant, contractEndDate: newEndDate } : null,
      }));
      Taro.showToast({ title: '续签成功', icon: 'success', duration: 1500 });
    } catch (err) {
      console.error('[RoomDetail] 续签失败:', err);
      Taro.showToast({ title: '续签失败', icon: 'none' });
    }
  }, [data.tenantId]);

  const getStatusLabel = () => {
    if (data.room?.status === 1) return '已租';
    return '空着';
  };

  const getStatusClass = () => {
    const s = data.room?.status;
    if (s === 1) return 'green';
    return 'gray';
  };

  const rentDayText = data.tenant?.rentDay !== undefined
    ? (() => {
        const dayLabel = data.tenant.rentDay === 0 ? '月底' : `${data.tenant.rentDay} 号`;
        const payMonths = (data.tenant as any).payMonths ?? 1;
        return payMonths > 1 ? `每 ${payMonths} 个月的 ${dayLabel}` : `每月 ${dayLabel}`;
      })()
    : '-';

  const contractExpiryDays = (() => {
    if (!data.tenant?.contractEndDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(data.tenant.contractEndDate);
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  })();

  const placeholderImage = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" fill="#f0ebe3"><rect width="800" height="500"/><text x="400" y="250" text-anchor="middle" fill="#c4b8a8" font-size="32" font-family="sans-serif">暂无图片</text></svg>');

  return (
    <View className="page-room-detail">
      <ScrollView className="detail-scroll" scrollY>
        {data.loading && <Loading />}
        {data.error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
        {!data.loading && !data.error && data.room && (
          <>
        <View className="room-image">
          <Image
            className="room-image-img"
            src={data.room?.images?.[0] ? resolveAsset(data.room.images[0]) : placeholderImage}
            mode="aspectFill"
          />
        </View>

        <View className="detail-card">
          <View className="detail-card-header">
            <Text className="detail-room-name">{data.room?.name || ''}</Text>
            <View style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <View className={`status-tag ${getStatusClass()}`}>
                <Text className="status-tag-text">{getStatusLabel()}</Text>
              </View>
              <Text className="edit-link" onClick={() => Taro.navigateTo({ url: `/pages/add-room-info/index?roomId=${roomId}&propertyId=${data.room?.propertyId || urlPropertyId}` })}>编辑</Text>
            </View>
          </View>
          <Text className="detail-room-rent">
            {data.room?.rent?.toLocaleString() ?? '-'} 元
            <Text className="rent-unit"> /月</Text>
          </Text>
          <View className="detail-divider" />
          {data.tenant ? (
            <View className="tenant-contact-card">
              <View className="tenant-contact-header">
                <View className="tenant-avatar">
                  <Text style={{ fontSize: '40px', lineHeight: 1, color: '#fff' }}>{data.tenant.name.charAt(0)}</Text>
                </View>
                <View className="tenant-contact-info">
                  <View className="tenant-name-row">
                    <Text className="tenant-contact-name">{data.tenant.name}</Text>
                    <Text className="edit-link" onClick={() => Taro.navigateTo({ url: `/pages/add-tenant/index?roomId=${roomId}&tenantId=${data.tenantId}` })}>编辑</Text>
                  </View>
                  <Text className="tenant-contact-rent">{rentDayText}</Text>
                </View>
              </View>
              <View className="tenant-contact-actions">
                <View className="tenant-action-btn call-btn" onClick={() => {
                  if (data.tenant!.phone) {
                    Taro.makePhoneCall({ phoneNumber: data.tenant!.phone }).catch(() => {
                      Taro.setClipboardData({ data: data.tenant!.phone });
                    });
                  }
                }}>
                  <Icon name="phone" size={28} />
                  <Text className="tenant-action-label">{data.tenant.phone || '未填写'}</Text>
                </View>
                <View className="tenant-action-btn" onClick={() => Taro.navigateTo({ url: `/pages/add-tenant/index?roomId=${roomId}&tenantId=${data.tenantId}` })}>
                  <Icon name="pencil" size={28} />
                  <Text className="tenant-action-label">编辑信息</Text>
                </View>
              </View>
              <View className="tenant-contact-meta">
                <View className="meta-item">
                  <Text className="meta-label">合同到期</Text>
                  <Text className={`meta-value${data.tenant.contractEndDate && contractExpiryDays !== null && contractExpiryDays <= 30 ? ' warning' : ''}`}>
                    {data.tenant.contractEndDate || '未设置'}
                  </Text>
                </View>
                <View className="meta-divider" />
                <View className="meta-item">
                  <Text className="meta-label">入住时间</Text>
                  <Text className="meta-value">{data.tenant.moveInDate || '未设置'}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View className="detail-info-grid">
              <View className="info-item">
                <Text className="info-label">租客</Text>
                <View className="info-value-row">
                  <Text className="info-value hint">暂未登记租客</Text>
                  <Text className="info-action-link" onClick={() => Taro.navigateTo({ url: `/pages/add-tenant/index?roomId=${roomId}` })}>去登记</Text>
                </View>
              </View>
              <View className="info-item">
                <Text className="info-label">电话</Text>
                <Text className="info-value">-</Text>
              </View>
              <View className="info-item">
                <Text className="info-label">收租日</Text>
                <Text className="info-value">-</Text>
              </View>
              <View className="info-item">
                <Text className="info-label">合同到期</Text>
                <Text className="info-value">-</Text>
              </View>
            </View>
          )}
        </View>

        {data.tenant && contractExpiryDays !== null && contractExpiryDays <= 30 && (
          <View className="detail-card warning-card">
            <View className="warning-content">
              <Icon name="warning" size={28} />
              <View className="warning-text-wrap">
                <Text className="warning-title">
                  {contractExpiryDays <= 0
                    ? '合同已到期'
                    : `合同将在 ${contractExpiryDays} 天后到期`}
                </Text>
                <Text className="warning-desc">
                  {contractExpiryDays <= 0
                    ? '合同已过期，建议尽快续签或安排退租'
                    : '提前联系租客确认续租意向，避免空置'}
                </Text>
              </View>
            </View>
            {contractExpiryDays <= 7 && (
              <View className="warning-actions">
                <View
                  className="warning-btn"
                  onClick={() => setData(prev => ({ ...prev, renewModalVisible: true }))}
                >
                  <Text className="warning-btn-text">续签（修改到期日）</Text>
                </View>
                <View
                  className="warning-btn warning-btn-secondary"
                  onClick={() => setData(prev => ({ ...prev, checkoutVisible: true }))}
                >
                  <Text className="warning-btn-text secondary-text">安排退租</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {data.room?.status === 1 && !data.tenant && (
          <View
            className="detail-card prompt-card"
            onClick={() => Taro.navigateTo({ url: `/pages/add-tenant/index?roomId=${roomId}` })}
          >
            <View className="prompt-content">
              <Icon name="user" size={28} />
              <View className="prompt-text-wrap">
                <Text className="prompt-title">登记租客信息</Text>
                <Text className="prompt-desc">房间已租出，请登记租客姓名、电话等信息</Text>
              </View>
              <Text style={{ fontSize: '28px', color: 'var(--accent-dk)', lineHeight: 1 }}>›</Text>
            </View>
          </View>
        )}

        <View
          className="detail-card card-glow monthly-card"
          onClick={() => {
            Taro.navigateTo({ url: `/pages/bill/index?roomId=${roomId}${data.tenantId ? `&tenantId=${data.tenantId}` : ''}` });
          }}
        >
          <View className="monthly-row">
            <View className="monthly-left">
              <Text className="monthly-label">每月应收</Text>
              <Text className="monthly-value">
                {data.room?.rent?.toLocaleString() ?? '-'} 元
              </Text>
            </View>
            <View className="monthly-right">
              <Text className="monthly-breakdown">
                房租 {data.room?.rent?.toLocaleString() ?? '-'}
              </Text>
            </View>
          </View>
        </View>

        <View className="section-header">
          <Text className="section-title">常用操作</Text>
        </View>
        <View className="quick-actions">
          {[
            {
              label: '发账单',
              icon: (<Icon name="credit-card" size={28} color="var(--accent-hover)" />),
              action: () => Taro.navigateTo({ url: `/pages/bill/index?roomId=${roomId}${data.tenantId ? `&tenantId=${data.tenantId}` : ''}` }),
            },
            {
              label: '收款码',
              icon: (<Icon name="smartphone" size={28} color="var(--accent-hover)" />),
              action: () => Taro.navigateTo({ url: '/pages/qr-code/index' }),
            },
            {
              label: '收租记录',
              icon: (<Icon name="clock" size={28} color="var(--accent-hover)" />),
              action: () => Taro.navigateTo({ url: `/pages/records/index?roomId=${roomId}` }),
            },
            {
              label: data.tenant ? '编辑租客' : '登记租客',
              icon: (<Icon name="user-plus" size={28} color="var(--accent-hover)" />),
              action: () => Taro.navigateTo({ url: `/pages/add-tenant/index?roomId=${roomId}` }),
            },
            {
              label: data.showMoreActions ? '收起' : '更多',
              icon: data.showMoreActions ? (
                <Text style={{ fontSize: '24px', color: 'var(--text-secondary)', lineHeight: 1 }}>▴</Text>
              ) : (
                <Icon name="more" size={28} color="var(--text-secondary)" />
              ),
              action: () => setData(prev => ({ ...prev, showMoreActions: !prev.showMoreActions })),
              isMore: true,
            },
          ].map((item, idx) => (
            <View key={idx} className={`quick-action-item${item.isMore ? ' more-action' : ''}`} onClick={item.action}>
              {item.icon}
              <Text className="quick-action-label">{item.label}</Text>
            </View>
          ))}
        </View>

        {data.showMoreActions && (
          <View className="quick-actions more-actions">
            {[
              {
                label: '单独收',
                icon: (<Icon name="dollar" size={28} color="var(--accent-hover)" />),
                action: () => Taro.navigateTo({ url: `/pages/single-charge/index?roomId=${roomId}` }),
              },
              {
                label: '合同收据',
                icon: (<Icon name="file-text" size={28} color="var(--accent-hover)" />),
                action: () => Taro.navigateTo({ url: `/pages/contracts/index?roomId=${roomId}` }),
              },
              {
                label: '每月收费项目',
                icon: (<Icon name="settings" size={28} color="var(--accent-hover)" />),
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

        {data.tenant && (
          <View className="section-header">
            <Text className="section-title">租客管理</Text>
          </View>
        )}
        {data.tenant && (
          <View className="more-list">
            <View
              className="more-item checkout-item"
              onClick={() => setData(prev => ({ ...prev, checkoutVisible: true }))}
            >
              <View className="more-icon red-bg">
                <Icon name="door" size={28} color="var(--danger)" />
              </View>
              <Text className="more-text">退租</Text>
              <Text style={{ fontSize: '24px', color: 'var(--text-muted)', lineHeight: 1 }}>›</Text>
            </View>
          </View>
        )}

        {data.historyTenants.length > 0 && (
          <>
            <View className="section-header">
              <Text className="section-title">历史租客</Text>
            </View>
            <View className="detail-card">
              {data.historyTenants.map((t) => (
                <View key={t.id} className="history-tenant-row">
                  <View className="history-tenant-info">
                    <Text className="history-tenant-name">{t.name}</Text>
                    <Text className="history-tenant-date">
                      {t.moveInDate || '未知'} ~ {t.moveOutDate || '未知'}
                    </Text>
                  </View>
                  {t.phone && <Text className="history-tenant-phone">{t.phone}</Text>}
                </View>
              ))}
            </View>
          </>
        )}

        <View className="section-header">
          <Text className="section-title">更多记录</Text>
        </View>
        <View className="more-list">
          {[
            {
              label: '备注',
              iconBg: 'gray-bg',
              icon: (<Icon name="pencil" size={28} color="var(--text-secondary)" />),
              action: () => {
                setData(prev => ({ ...prev, noteModalVisible: true }));
              },
            },
            {
              label: '删除',
              iconBg: 'red-bg',
              icon: (<Icon name="trash" size={28} color="var(--danger)" />),
              action: () => setData(prev => ({ ...prev, deleteVisible: true })),
            },
          ].map((item, idx) => (
            <View key={idx} className="more-item" onClick={item.action}>
              <View className={`more-icon ${item.iconBg}`}>{item.icon}</View>
              <Text className="more-text">{item.label}</Text>
              <Text style={{ fontSize: '24px', color: 'var(--text-muted)', lineHeight: 1 }}>›</Text>
            </View>
          ))}
        </View>

        <View style={{ height: '40px' }} />
          </>
        )}
      </ScrollView>

      <ConfirmModal
        visible={data.checkoutVisible}
        title={`确认${data.tenant?.name || '租客'}退租？`}
        description={
          data.activePartialPayment
            ? `⚠ 该租客已付 ¥${data.activePartialPayment.totalPaid.toLocaleString()}（${data.activePartialPayment.count} 笔部分付款），退租后未付清的账单将作废。建议先确认收齐尾款，或与租客协商退还已付款。`
            : '退租后房间将变为空置状态'
        }
        confirmText="下一步"
        onConfirm={handleCheckout}
        onCancel={() => setData(prev => ({ ...prev, checkoutVisible: false }))}
      />

      <DepositModal
        visible={data.depositVisible}
        deposit={Number(data.tenant?.deposit) || 0}
        prepaidRefund={Number(data.moveOutPreview?.prepaidRefund) || 0}
        moveInReading={data.tenant?.moveInReading || ''}
        onCancel={() => setData(prev => ({ ...prev, depositVisible: false }))}
        onSkip={() => handleCheckoutSubmit()}
        onConfirm={handleCheckoutSubmit}
      />

      <ConfirmModal
        visible={data.deleteVisible}
        title="确认删除该房间？"
        description="删除后不可恢复"
        confirmText="确认删除"
        onConfirm={handleDeleteRoom}
        onCancel={() => setData(prev => ({ ...prev, deleteVisible: false }))}
      />

      <NoteEditModal
        visible={data.noteModalVisible}
        initialNote={data.room?.note || ''}
        onCancel={() => setData(prev => ({ ...prev, noteModalVisible: false }))}
        onConfirm={handleNoteSave}
      />

      <ContractRenewModal
        visible={data.renewModalVisible}
        tenantName={data.tenant?.name}
        currentEndDate={data.tenant?.contractEndDate}
        onCancel={() => setData(prev => ({ ...prev, renewModalVisible: false }))}
        onConfirm={handleRenew}
      />
    </View>
  );
}
