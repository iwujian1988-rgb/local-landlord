import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import { useState, useCallback, useEffect } from 'react';
import { get } from '../../services/request';
import rentHeroImg from '../../assets/rent-stats/rent-hero-objects.png';
import './index.scss';

type Period = 'month' | 'lastMonth' | 'quarter' | 'year';

const periods: { key: Period; label: string }[] = [
  { key: 'month', label: '本月' },
  { key: 'lastMonth', label: '上月' },
  { key: 'quarter', label: '季度' },
  { key: 'year', label: '年度' },
];

const clampRate = (rate: number) => Math.max(0, Math.min(rate || 0, 100));

interface PropertyStat {
  name: string;
  rooms: number;
  received: number;
  overdue: number;
  expected: number;
  collected: number;
  pending: number;
  rate: number;
}

interface StatsData {
  propertyStats: PropertyStat[];
  totalExpected: number;
  totalCollected: number;
  totalPending: number;
  totalRate: number;
  monthLabel: string;
}

export default function RentStats() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const routePropertyId = Number(routerParams.propertyId) || 0;

  const [period, setPeriod] = useState<Period>('month');
  const [statsData, setStatsData] = useState<StatsData>({
    propertyStats: [],
    totalExpected: 0,
    totalCollected: 0,
    totalPending: 0,
    totalRate: 0,
    monthLabel: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadData = useCallback(async (p: Period) => {
    setLoading(true);
    setError(false);
    try {
      const res = await get<StatsData>('/stats/rent', {
        period: p,
        propertyId: routePropertyId || undefined,
      });
      if (res.code === 0 && res.data) {
        setStatsData(res.data);
      }
    } catch (err) {
      console.error('[RentStats] 加载统计数据失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [routePropertyId]);

  const handleCopySummary = useCallback(() => {
    const s = statsData;
    const lines: string[] = [];
    lines.push(`【${s.monthLabel}收租汇总】`);
    lines.push(`应收：${s.totalExpected.toLocaleString()} 元`);
    lines.push(`已收：${s.totalCollected.toLocaleString()} 元`);
    lines.push(`未收：${s.totalPending.toLocaleString()} 元`);
    lines.push(`收款率：${s.totalRate}%`);
    if (s.propertyStats.length > 0) {
      lines.push('');
      lines.push('按房源：');
      s.propertyStats.forEach((p) => {
        lines.push(`· ${p.name} ${p.collected.toLocaleString()}/${p.expected.toLocaleString()}元 (${p.rate}%)`);
      });
    }
    Taro.setClipboardData({
      data: lines.join('\n'),
      success: () => Taro.showToast({ title: '汇总已复制，可粘贴到微信', icon: 'none', duration: 2000 }),
    });
  }, [statsData]);

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: '收租统计' });
    loadData(period);
  }, [loadData, period]);

  return (
    <View className="page-rent-stats">
      <ScrollView className="stats-scroll" scrollY>
        <View className="filter-tabs">
          {periods.map((p) => (
            <View
              key={p.key}
              className={`filter-tab ${period === p.key ? 'active' : ''}`}
              onClick={() => setPeriod(p.key)}
            >
              <Text className="filter-tab-text">{p.label}</Text>
            </View>
          ))}
        </View>

        {loading && <Loading />}
        {error && <ErrorState description="加载失败，请稍后重试" onRetry={() => loadData(period)} />}
        {!loading && !error && (
          <>
            <View className="overview-wrap">
              <View className="overview-header">
                <Text className="overview-period">{statsData.monthLabel}</Text>
                <Text className="rate-tag">收款率 {statsData.totalRate}%</Text>
              </View>
              <View className="overview-card">
                <View className="overview-card-top">
                  <Text className="overview-title">本周期收租总览</Text>
                  <Image className="rent-hero-img" src={rentHeroImg} mode="aspectFit" />
                </View>
                <View className="stats-grid">
                  <View className="stats-item">
                    <Text><Text className="stats-icon" style={{ color: '#f0643e' }}>▣</Text><Text className="stats-label-text">应收</Text></Text>
                    <Text className="stats-value orange">{statsData.totalExpected.toLocaleString()}<Text className="stats-unit">元</Text></Text>
                  </View>
                  <View className="stats-item">
                    <Text><Text className="stats-icon" style={{ color: '#5fa264' }}>✓</Text><Text className="stats-label-text">已收</Text></Text>
                    <Text className="stats-value green">{statsData.totalCollected.toLocaleString()}<Text className="stats-unit">元</Text></Text>
                  </View>
                  <View className="stats-item">
                    <Text><Text className="stats-icon" style={{ color: '#f0a23f' }}>◷</Text><Text className="stats-label-text">未收</Text></Text>
                    <Text className="stats-value pending">{statsData.totalPending.toLocaleString()}<Text className="stats-unit">元</Text></Text>
                  </View>
                </View>
              </View>
            </View>

            <View className="section-header">
              <Text className="section-title">按房源统计</Text>
              <Text className="section-more" onClick={handleCopySummary}>复制汇总</Text>
            </View>

            {statsData.propertyStats.length === 0 && (
              <EmptyState title="暂无统计数据" description="添加房源和租客后，这里会显示收租统计" />
            )}

            {statsData.propertyStats.map((ps, idx) => (
              <View key={idx} className="property-stat-card">
                <View className="property-stat-header">
                  <View>
                    <Text className="property-stat-name">{ps.name}</Text>
                    <Text className="property-stat-info">
                      {ps.rooms} 间房 · {ps.received} 已收 · {ps.overdue} 逾期
                    </Text>
                  </View>
                  <View className="property-stat-amount">
                    <Text className="amount-value">{ps.expected.toLocaleString()}</Text>
                    <Text className="amount-unit">应收元</Text>
                  </View>
                </View>
                <View className="progress-bar">
                  <View className="progress-fill" style={{ width: `${clampRate(ps.rate)}%` }} />
                </View>
                <Text className="property-stat-footer">已收 {ps.collected.toLocaleString()} 元 · 未收 {ps.pending.toLocaleString()} 元</Text>
              </View>
            ))}

            <View className="bottom-actions">
              <View className="bottom-btn primary" onClick={handleCopySummary}>
                <Text>复制汇总到剪贴板</Text>
              </View>
            </View>
          </>
        )}

        <View style={{ height: '60px' }} />
      </ScrollView>
    </View>
  );
}
