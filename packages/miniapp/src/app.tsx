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
  });
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

export default App;
