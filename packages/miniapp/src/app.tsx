import './app.scss';
import Taro, { useLaunch } from '@tarojs/taro';
import { type ReactNode } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { CLOUD_CONFIG } from './config';
import { useAuthStore } from './store/useAuthStore';
import { useAppStore } from './store/useAppStore';
import { flushOfflineQueue } from './services/cloudDb';
import { syncFromCloud, migrateFromLocalStorage } from './utils/storage';

function App({ children }: { children: ReactNode }) {
  useLaunch(() => {
    // 初始化微信云开发
    if (wx.cloud) {
      wx.cloud.init(CLOUD_CONFIG);
    }

    // 云数据异步初始化（非阻塞，不阻止启动）
    if (wx.cloud) {
      Promise.allSettled([
        useAuthStore.getState().loginSilently()
          .then(() => migrateFromLocalStorage())
          .then(() => syncFromCloud())
          .then(() => flushOfflineQueue())
          .catch((err: any) => {
            console.warn('[App] 云数据同步失败（启动继续）:', err);
          })
          .finally(() => {
            useAppStore.getState().setDataReady(true);
          }),
      ]);
    }

    const hasOnboarded = Taro.getStorageSync('hasOnboarded');
    if (!hasOnboarded) {
      Taro.reLaunch({ url: '/pages/onboarding/index' });
    }
  });
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

export default App;
