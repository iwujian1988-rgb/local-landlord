import { View, WebView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useMemo, useState } from 'react';
import { H5_BASE_URL } from '../../config';
import Loading from '../../components/Loading';
import './index.scss';

export default function ShareWebview() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const token = params.token || '';
  const [loaded, setLoaded] = useState(false);

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '账单详情' });
  });

  const url = useMemo(() => {
    if (!token) return '';
    return `${H5_BASE_URL}/?token=${encodeURIComponent(token)}`;
  }, [token]);

  if (!url) {
    return null;
  }

  return (
    <View style={{ position: 'relative', height: '100vh' }}>
      {!loaded && <Loading text="正在加载账单..." />}
      <WebView src={url} onLoad={() => setLoaded(true)} />
    </View>
  );
}
