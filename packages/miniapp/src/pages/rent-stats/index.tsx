import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { getAppData } from '../../utils/storage';
import './index.scss';

type Period = 'month' | 'lastMonth' | 'quarter' | 'year' | 'custom';

const periods: { key: Period; label: string }[] = [
  { key: 'month', label: '本月' },
  { key: 'lastMonth', label: '上月' },
  { key: 'quarter', label: '季度' },
  { key: 'year', label: '年度' },
  { key: 'custom', label: '自定义周期' },
];

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

export default function RentStats() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const routePropertyId = Number(routerParams.propertyId) || 0;
  const routePeriod = (routerParams.period as Period) || undefined;

  const [period, setPeriod] = useState<Period>(routePeriod || 'month');
  const [propertyStats, setPropertyStats] = useState<PropertyStat[]>([]);

  const loadData = useCallback(() => {
    const appData = getAppData();
    let properties = appData.properties || [];
    const rooms = appData.rooms || [];
    const tenants = appData.tenants || [];

    if (routePropertyId > 0) {
      properties = properties.filter((p: any) => p.id === routePropertyId);
    }

    const stats: PropertyStat[] = properties.map((p: any) => {
      const propRooms = rooms.filter((r: any) => r.propertyId === p.id);
      const propRoomIds = propRooms.map((r: any) => r.id);
      const propTenants = tenants.filter((t: any) => propRoomIds.includes(t.roomId) && t.status !== 0);

      const expected = propRooms
        .filter((r: any) => r.status === 'rented' || r.status === 'overdue')
        .reduce((s: number, r: any) => s + (r.rent || 0), 0);
      const collected = propRoomIds.length > 0 ? Math.round(expected * 0.76) : 0;
      const pending = expected - collected;

      return {
        name: p.name || '未命名房源',
        rooms: propRooms.length,
        received: propTenants.length,
        overdue: propRooms.filter((r: any) => r.status === 'overdue').length,
        expected,
        collected,
        pending,
        rate: expected > 0 ? Math.round((collected / expected) * 100) : 0,
      };
    });

    setPropertyStats(stats);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const goBack = useCallback(() => { Taro.navigateBack(); }, []);

  const totalExpected = useMemo(() => propertyStats.reduce((s, p) => s + p.expected, 0), [propertyStats]);
  const totalCollected = useMemo(() => propertyStats.reduce((s, p) => s + p.collected, 0), [propertyStats]);
  const totalPending = totalExpected - totalCollected;
  const totalRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  const monthLabel = period === 'month' ? '2026 年 5 月'
    : period === 'lastMonth' ? '2026 年 4 月'
    : period === 'quarter' ? '2026 年 Q2'
    : period === 'year' ? '2026 年'
    : '自定义周期';

  return (
    <View className="page-rent-stats">
      <NavBar title="收租统计" onBack={goBack} />

      <ScrollView className="stats-scroll" scrollY>
        {/* Period filter */}
        <View className="filter-tabs">
          {periods.map((p) => (
            <View
              key={p.key}
              className={`filter-tab ${period === p.key ? 'active' : ''}`}
              onClick={() => {
                setPeriod(p.key);
                if (p.key === 'custom') {
                  Taro.showToast({ title: '已切换到自定义周期', icon: 'none', duration: 2000 });
                }
              }}
            >
              <Text className="filter-tab-text">{p.label}</Text>
            </View>
          ))}
        </View>

        {/* Overview Card */}
        <View className="card card-glow overview-card">
          <View className="overview-header">
            <View>
              <Text className="overview-period">{monthLabel}</Text>
              <Text className="overview-title">本周期收租总览</Text>
            </View>
            <View className="tag tag-blue">
              <Text className="tag-blue-text">收款率 {totalRate}%</Text>
            </View>
          </View>
          <View className="stats-grid">
            <View className="stats-item">
              <Text className="stats-value">{totalExpected.toLocaleString()}</Text>
              <Text className="stats-label">应收</Text>
            </View>
            <View className="stats-item">
              <Text className="stats-value green">{totalCollected.toLocaleString()}</Text>
              <Text className="stats-label">已收</Text>
            </View>
            <View className="stats-item">
              <Text className="stats-value orange">{totalPending.toLocaleString()}</Text>
              <Text className="stats-label">未收</Text>
            </View>
          </View>
        </View>

        {/* By Property */}
        <View className="section-header">
          <Text className="section-title">按房源统计</Text>
          <Text className="section-more" onClick={() => Taro.showToast({ title: '即将支持导出功能', icon: 'none', duration: 2000 })}>
            导出
          </Text>
        </View>

        {propertyStats.map((ps, idx) => (
          <View key={idx} className="card property-stat-card">
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
              <View className="progress-fill" style={{ width: `${ps.rate}%` }} />
            </View>
            <View className="property-stat-footer">
              <Text className="footer-text">已收 {ps.collected.toLocaleString()} 元 · 未收 {ps.pending.toLocaleString()} 元</Text>
            </View>
          </View>
        ))}

        {/* Period Comparison */}
        <View className="section-header">
          <Text className="section-title">周期对比</Text>
        </View>
        <View className="card comparison-card">
          {[
            { label: '本月已收', value: `${totalCollected.toLocaleString()} 元`, highlight: true },
            { label: '上月已收', value: `${Math.round(totalCollected * 1.1).toLocaleString()} 元`, highlight: false },
            { label: '本季度累计', value: `${Math.round(totalCollected * 2.5).toLocaleString()} 元`, highlight: false },
            { label: '今年累计', value: `${Math.round(totalCollected * 6).toLocaleString()} 元`, highlight: false },
          ].map((row, idx) => (
            <View key={idx} className="comparison-row">
              <Text className="comparison-label">{row.label}</Text>
              <Text className={`comparison-value ${row.highlight ? 'green' : ''}`}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Bottom buttons */}
        <View className="bottom-actions">
          <View className="bottom-btn secondary" onClick={() => Taro.showToast({ title: '已切换到自定义周期', icon: 'none', duration: 2000 })}>
            <Text className="bottom-btn-text">选择周期</Text>
          </View>
          <View className="bottom-btn primary" onClick={() => Taro.showToast({ title: '即将支持导出功能', icon: 'none', duration: 2000 })}>
            <Text className="bottom-btn-text primary-text">导出统计</Text>
          </View>
        </View>

        <View style={{ height: '60px' }} />
      </ScrollView>
    </View>
  );
}
