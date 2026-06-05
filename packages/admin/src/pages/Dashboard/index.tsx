import { useState, useEffect } from 'react';
import { Box, Card, Typography, Grid, CircularProgress, Alert } from '@mui/material';
import { Apartment, MeetingRoom, People, TrendingUp, AccountBox } from '@mui/icons-material';
import { dashboardApi } from '../../services/api';

const StatCard = ({ icon, label, value, color }: any) => (
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

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardApi.getSummary().then((res: any) => {
      setSummary(res.data);
    }).catch(() => {
      setError('加载仪表盘数据失败，请稍后重试');
    }).finally(() => setLoading(false));
  }, []);

  const s = summary || {};

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>仪表盘</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      ) : (<>
      <Grid container spacing={3} mb={4}>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard icon={<AccountBox />} label="总房东数" value={loading ? '-' : (s.totalLandlords ?? 0)} color="#D4A574" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard icon={<Apartment />} label="总房源数" value={loading ? '-' : (s.totalProperties ?? 0)} color="#F5D78E" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard icon={<MeetingRoom />} label="总房间数" value={loading ? '-' : (s.totalRooms ?? 0)} color="#7BA37B" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard icon={<People />} label="在租租客" value={loading ? '-' : (s.totalTenants ?? 0)} color="#6B8FBF" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard icon={<TrendingUp />} label="本月收租率" value={loading ? '-' : `${s.collectionRate ?? 0}%`} color="#C97B7B" />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} mb={2}>近期收租趋势</Typography>
            <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#fafafa', borderRadius: 2 }}>
              <Typography color="text.secondary">ECharts 图表区域（安装 echarts 后激活）</Typography>
            </Box>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
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
        </Grid>
      </Grid>
      </>)}
    </Box>
  );
}
