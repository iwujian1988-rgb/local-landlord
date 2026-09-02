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

    const guestMode = !!Taro.getStorageSync('guest_mode');
    const savedToken = guestMode ? '' : Taro.getStorageSync('auth_token');
    if (guestMode) {
      useAuthStore.getState().enterGuestMode();
    } else if (savedToken) {
      useAuthStore.setState({ token: savedToken, isLoggedIn: true });
    }

    // New users must land on the home page in guest mode. Login is an explicit
    // user action from the visible banner, never a launch-time requirement.
    if (!guestMode && !savedToken) {
      useAuthStore.getState().enterGuestMode();
    }
  });
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

export default App;
