import { useState, useEffect, useCallback } from 'react';
import { Box, Card, Typography, CircularProgress, Alert, ToggleButtonGroup, ToggleButton } from '@mui/material';
import Grid2 from '@mui/material/Grid2';
import { Apartment, MeetingRoom, People, TrendingUp, AccountBox } from '@mui/icons-material';
import { dashboardApi, statsApi } from '../../services/api';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}

const StatCard = ({ icon, label, value, color }: StatCardProps) => (
  <Card sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
    <Box sx={{ width: 48, height: 48, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: color + '22' }}>
      <Box sx={{ color }}>{icon}</Box>
    </Box>
    <Box>
      <Typography variant="h4" fontWeight={700}>{value}</Typography>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
    </Box>
  </Card>
);

interface DashboardSummary {
  totalLandlords: number;
  totalProperties: number;
  totalRooms: number;
  totalTenants: number;
  collectionRate: number;
  overdueBillCount: number;
  upcomingDueCount: number;
  todayCollectionCount: number;
}

interface RentStatItem {
  period: string;
  expectedAmount: number;
  collectedAmount: number;
  collectionRate: number;
  collectedCount: number;
  billCount: number;
}

interface RentStatsData {
  list: RentStatItem[];
}

interface OccupancyPropertyStat {
  propertyId: number;
  propertyName: string;
  totalRooms: number;
  rentedRooms: number;
  vacancyRate: number;
}

interface OccupancyStatsData {
  totalRooms: number;
  rentedRooms: number;
  vacantRooms: number;
  occupancyRate: number;
  propertyStats: OccupancyPropertyStat[];
}

export default function Dashboard() {
  // Dashboard summary state
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Statistics state
  const [periodKind, setPeriodKind] = useState('month');
  const [statsLoading, setStatsLoading] = useState(true);
  const [rentStats, setRentStats] = useState<RentStatsData | null>(null);
  const [occupancyStats, setOccupancyStats] = useState<OccupancyStatsData | null>(null);
  const [rentSummary, setRentSummary] = useState({ expected: 0, collected: 0, uncollected: 0, rate: 0 });

  // Fetch dashboard summary
  useEffect(() => {
    dashboardApi.getSummary().then((res) => {
      setSummary(res as unknown as DashboardSummary);
    }).catch(() => {
      setError('加载仪表盘数据失败，请稍后重试');
    }).finally(() => setLoading(false));
  }, []);

  // Fetch statistics data
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      let period: string | undefined;
      if (periodKind === 'month') {
        const now = new Date();
        period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }

      const [rentRes, occupancyRes] = await Promise.all([
        statsApi.getRentStats(period ? { period } : undefined),
        statsApi.getOccupancyStats(),
      ]);

      const rentData = rentRes as unknown as RentStatsData;
      const occupancyData = occupancyRes as unknown as OccupancyStatsData;

      setRentStats(rentData);
      setOccupancyStats(occupancyData);

      const list = rentData?.list || [];
      if (list.length > 0) {
        const latest = period ? list[0] : list[list.length - 1];
        const collected = latest.collectedAmount || 0;
        const expected = latest.expectedAmount || 0;
        setRentSummary({
          expected,
          collected,
          uncollected: expected - collected,
          rate: latest.collectionRate || 0,
        });
      }
    } catch (e) {
      console.error('获取统计数据失败', e);
    }
    setStatsLoading(false);
  }, [periodKind]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const s = summary || ({} as Partial<DashboardSummary>);
  const formatCurrency = (v: number) => `¥${v.toLocaleString()}`;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>数据看板</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      ) : (<>
      {/* 1. Dashboard 5 StatCards */}
      <Grid2 container spacing={3} mb={4}>
        <Grid2 size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard icon={<AccountBox />} label="总房东数" value={loading ? '-' : (s.totalLandlords ?? 0)} color="#D4A574" />
        </Grid2>
        <Grid2 size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard icon={<Apartment />} label="总房源数" value={loading ? '-' : (s.totalProperties ?? 0)} color="#F5D78E" />
        </Grid2>
        <Grid2 size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard icon={<MeetingRoom />} label="总房间数" value={loading ? '-' : (s.totalRooms ?? 0)} color="#7BA37B" />
        </Grid2>
        <Grid2 size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard icon={<People />} label="在租租客" value={loading ? '-' : (s.totalTenants ?? 0)} color="#6B8FBF" />
        </Grid2>
        <Grid2 size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard icon={<TrendingUp />} label="本月收租率" value={loading ? '-' : `${s.collectionRate ?? 0}%`} color="#C97B7B" />
        </Grid2>
      </Grid2>

      {/* 2. ToggleButtonGroup */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, mt: 2 }}>
        <Typography variant="h6" fontWeight={600}>收租统计</Typography>
        <ToggleButtonGroup value={periodKind} exclusive onChange={(_, v) => v && setPeriodKind(v)} size="small">
          <ToggleButton value="month">本月</ToggleButton>
          <ToggleButton value="quarter">本季</ToggleButton>
          <ToggleButton value="year">本年</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* 3. Rent stats 4 cards */}
      {statsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Grid2 container spacing={3} mb={4}>
          {[
            { label: '预计收入', value: formatCurrency(rentSummary.expected), color: '#F5D78E' },
            { label: '已收', value: formatCurrency(rentSummary.collected), color: '#7BA37B' },
            { label: '未收', value: formatCurrency(rentSummary.uncollected), color: '#C97B7B' },
            { label: '收租率', value: `${rentSummary.rate}%`, color: '#6B8FBF' },
          ].map((item) => (
            <Grid2 size={{ xs: 6, md: 3 }} key={item.label}>
              <Card sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h4" fontWeight={700} color={item.color}>{item.value}</Typography>
                <Typography variant="body2" color="text.secondary" mt={1}>{item.label}</Typography>
              </Card>
            </Grid2>
          ))}
        </Grid2>
      )}

      {/* 4. Trend chart + pending items + occupancy pie */}
      <Grid2 container spacing={3}>
        <Grid2 size={{ xs: 12, md: 8 }}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} mb={2}>近期收租趋势</Typography>
            <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#fafafa', borderRadius: 2 }}>
              <Typography color="text.secondary">ECharts 图表区域（安装 echarts 后激活）</Typography>
            </Box>
          </Card>
        </Grid2>
        <Grid2 size={{ xs: 12, md: 4 }}>
          <Card sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" fontWeight={600} mb={2}>待处理事项</Typography>
            {[
              { label: '逾期账单', count: s.overdueBillCount ?? 0, color: '#C97B7B' },
              { label: '即将到期', count: s.upcomingDueCount ?? 0, color: '#E8B87D' },
              { label: '今日待收', count: s.todayCollectionCount ?? 0, color: '#F5D78E' },
            ].map((item) => (
              <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid #f0f0f0' }}>
                <Typography variant="body1">{item.label}</Typography>
                <Typography variant="h6" fontWeight={700} color={item.color}>{loading ? '-' : item.count}</Typography>
              </Box>
            ))}
          </Card>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} mb={2}>入住率</Typography>
            <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#fafafa', borderRadius: 2 }}>
              <Typography color="text.secondary">饼图（安装 echarts 后激活）</Typography>
            </Box>
          </Card>
        </Grid2>
      </Grid2>

      {/* 5. Monthly trend table + occupancy overview + property ranking */}
      {!statsLoading && (
        <Grid2 container spacing={3} mt={3}>
          <Grid2 size={{ xs: 12, md: 8 }}>
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} mb={2}>月度收租趋势</Typography>
              <Box>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 13, color: '#666' }}>月份</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 13, color: '#666' }}>应收</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 13, color: '#666' }}>实收</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 13, color: '#666' }}>收租率</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 13, color: '#666' }}>已收/总笔数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rentStats?.list || []).map((item) => (
                      <tr key={item.period} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{item.period}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{item.expectedAmount.toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{item.collectedAmount.toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <span style={{ color: item.collectionRate >= 80 ? '#7BA37B' : item.collectionRate >= 50 ? '#F5D78E' : '#C97B7B', fontWeight: 600 }}>
                            {item.collectionRate}%
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#888' }}>
                          {item.collectedCount}/{item.billCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!rentStats?.list || rentStats.list.length === 0) && (
                  <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>暂无数据</Typography>
                )}
              </Box>
            </Card>
          </Grid2>

          <Grid2 size={{ xs: 12, md: 4 }}>
            <Card sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" fontWeight={600} mb={2}>入住率概览</Typography>
              {occupancyStats && (
                <Box sx={{ mb: 2 }}>
                  <Grid2 container spacing={2}>
                    {[
                      { label: '总房间', value: occupancyStats.totalRooms ?? 0 },
                      { label: '已出租', value: occupancyStats.rentedRooms ?? 0 },
                      { label: '空置', value: occupancyStats.vacantRooms ?? 0 },
                      { label: '入住率', value: `${occupancyStats.occupancyRate ?? 0}%` },
                    ].map((item) => (
                      <Grid2 size={6} key={item.label}>
                        <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: '#fafafa', borderRadius: 1 }}>
                          <Typography variant="h6" fontWeight={700}>{item.value}</Typography>
                          <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                        </Box>
                      </Grid2>
                    ))}
                  </Grid2>
                </Box>
              )}
            </Card>

            <Card sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} mb={2}>房源收租排行</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {(occupancyStats?.propertyStats || []).map((item, idx) => (
                  <Box key={item.propertyId || idx} sx={{ borderBottom: '1px solid #f0f0f0', py: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body1" fontWeight={500}>{item.propertyName}</Typography>
                      <Typography variant="body2" color="text.secondary">空置 {item.vacancyRate}%</Typography>
                    </Box>
                    <Box sx={{ mt: 0.5, bgcolor: '#f0f0f0', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                      <Box sx={{
                        width: `${100 - item.vacancyRate}%`,
                        height: '100%',
                        bgcolor: '#7BA37B',
                        borderRadius: 4,
                      }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      已租 {item.rentedRooms}/{item.totalRooms} 间
                    </Typography>
                  </Box>
                ))}
                {(!occupancyStats?.propertyStats || occupancyStats.propertyStats.length === 0) && (
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>暂无数据</Typography>
                )}
              </Box>
            </Card>
          </Grid2>
        </Grid2>
      )}
      </>)}
    </Box>
  );
}
