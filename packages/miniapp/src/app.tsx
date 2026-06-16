import './app.scss';
import Taro, { useLaunch } from '@tarojs/taro';
import { type ReactNode } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuthStore } from './store/useAuthStore';
import { USE_CLOUD, CLOUD_ENV_ID } from './config';

function App({ children }: { children: ReactNode }) {
  useLaunch(() => {
    // Initialize WeChat Cloud in production
    if (USE_CLOUD && CLOUD_ENV_ID) {
      try {
        (Taro as any).cloud.init({ env: CLOUD_ENV_ID });
      } catch (e) {
        console.error('[App] cloud.init failed:', e);
      }
    }

    const savedToken = Taro.getStorageSync('auth_token');
    if (savedToken) {
      useAuthStore.setState({ token: savedToken, isLoggedIn: true });
    }

    const hasOnboarded = Taro.getStorageSync('has_onboarded');
    const launchPage = Taro.getCurrentInstance().router?.path || '';
    const isInsideTab = launchPage.startsWith('pages/home') ||
      launchPage.startsWith('pages/rooms') ||
      launchPage.startsWith('pages/rent-list') ||
      launchPage.startsWith('pages/my');

    // Cold launch into a tab page and user hasn't onboarded → route to onboarding
    if (!hasOnboarded && isInsideTab) {
      Taro.reLaunch({ url: '/pages/onboarding/index' });
    }
  });
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

export default App;
