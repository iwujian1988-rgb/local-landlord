import './app.scss';
import Taro, { useLaunch } from '@tarojs/taro';
import { type ReactNode } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuthStore } from './store/useAuthStore';

function App({ children }: { children: ReactNode }) {
  useLaunch(async () => {
    const hasOnboarded = Taro.getStorageSync('hasOnboarded');
    if (!hasOnboarded) {
      Taro.reLaunch({ url: '/pages/onboarding/index' });
      return;
    }

    try {
      const token = await useAuthStore.getState().loginSilently();
      if (!token) {
        await useAuthStore.getState().login();
      }
    } catch (err) {
      console.error('[App] 自动登录失败:', err);
    }
  });
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

export default App;
