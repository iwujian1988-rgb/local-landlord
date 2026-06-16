import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { del } from '../../services/request';
import { APP_VERSION } from '../../constants/app';
import './index.scss';

export default function Account() {
  const [deleting, setDeleting] = useState(false);
  const user = useAuthStore((s) => s.user);

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '账户管理' });
  });

  const handleDelete = () => {
    if (deleting) return;
    Taro.showModal({
      title: '确认注销账户？',
      content: '注销后您的数据将保留 30 天，期间无法登录；超期后数据将被清除。',
      confirmText: '确认注销',
      confirmColor: '#d9534f',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return;
        // second confirmation
        Taro.showModal({
          title: '最后一步',
          content: '此操作无法自助恢复，确认要注销吗？',
          confirmText: '确认注销',
          confirmColor: '#d9534f',
          cancelText: '再想想',
          success: async (r2) => {
            if (!r2.confirm) return;
            setDeleting(true);
            try {
              await del('/auth/account');
              Taro.showToast({ title: '账户已注销', icon: 'none', duration: 1500 });
              useAuthStore.getState().logout();
              Taro.removeStorageSync('has_onboarded');
              Taro.removeStorageSync('guest_mode');
              setTimeout(() => {
                Taro.reLaunch({ url: '/pages/onboarding/index' });
              }, 1200);
            } catch (err: any) {
              console.error('[Account] 注销失败:', err);
              Taro.showToast({ title: err?.message || '注销失败，请稍后重试', icon: 'none' });
            } finally {
              setDeleting(false);
            }
          },
        });
      },
    });
  };

  return (
    <View className="page-account">
      <ScrollView className="content-scroll" scrollY>
        <View className="account-section">
          <Text className="section-title">当前账户</Text>
          <View className="account-card">
            <View className="account-row">
              <Text className="account-label">用户名</Text>
              <Text className="account-value">{user?.name || '房东'}</Text>
            </View>
            {user?.phone && (
              <View className="account-row">
                <Text className="account-label">手机号</Text>
                <Text className="account-value">{user.phone}</Text>
              </View>
            )}
            <View className="account-row">
              <Text className="account-label">版本</Text>
              <Text className="account-value">v{APP_VERSION}</Text>
            </View>
          </View>
        </View>

        <View className="account-section">
          <Text className="section-title">数据与隐私</Text>
          <View className="info-card">
            <Text className="info-text">
              您的所有数据（房源、房间、租客、账单等）通过加密通道传输，存储在云端。我们不会未经您同意访问或使用您的数据。
            </Text>
          </View>
        </View>

        <View className="account-section">
          <Text className="section-title danger">危险操作</Text>
          <View className="danger-card">
            <View className="danger-info">
              <Text className="danger-title">注销账户</Text>
              <Text className="danger-desc">注销后：</Text>
              <View className="danger-bullet">
                <Text className="danger-bullet-item">① 立即无法登录小程序</Text>
                <Text className="danger-bullet-item">② 30 天内联系客服可恢复</Text>
                <Text className="danger-bullet-item">③ 30 天后所有数据彻底删除</Text>
              </View>
            </View>
            <View
              className={`danger-btn${deleting ? ' disabled' : ''}`}
              onClick={deleting ? undefined : handleDelete}
            >
              <Text className="danger-btn-text">{deleting ? '处理中...' : '注销账户'}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: '80px' }} />
      </ScrollView>
    </View>
  );
}
