import { useState, useEffect, useCallback } from 'react';
import { Box, Card, Typography, ToggleButtonGroup, ToggleButton, CircularProgress } from '@mui/material';
import Grid2 from '@mui/material/Grid2';
import { statsApi } from '../../services/api';

export default function Statistics() {
  const [periodKind, setPeriodKind] = useState('month');
  const [loading, setLoading] = useState(true);
  const [rentStats, setRentStats] = useState<any>(null);
  const [occupancyStats, setOccupancyStats] = useState<any>(null);
  const [summary, setSummary] = useState({ expected: 0, collected: 0, uncollected: 0, rate: 0 });

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      let period: string | undefined;
      if (periodKind === 'month') {
        const now = new Date();
        period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }
      // 季/年暂不传 period，使用默认最近6个月数据

      const [rentRes, occupancyRes] = await Promise.all([
        statsApi.getRentStats(period ? { period } : undefined),
        statsApi.getOccupancyStats(),
      ]);

      const rentData = (rentRes as any)?.data?.data ?? (rentRes as any)?.data ?? rentRes;
      const occupancyData = (occupancyRes as any)?.data?.data ?? (occupancyRes as any)?.data ?? occupancyRes;

      setRentStats(rentData);
      setOccupancyStats(occupancyData);

      const list = rentData?.list || [];
      if (list.length > 0) {
        const latest = period ? list[0] : list[list.length - 1]; // 有period取第一项，无period取最新月
        const collected = latest.collectedAmount || 0;
        const expected = latest.expectedAmount || 0;
        setSummary({
          expected,
          collected,
          uncollected: expected - collected,
          rate: latest.collectionRate || 0,
        });
      }
    } catch (e) {
      console.error('获取统计数据失败', e);
    }
    setLoading(false);
  }, [periodKind]);

  useEffect(() => { fetch(); }, [fetch]);

  const formatCurrency = (v: number) => `¥${v.toLocaleString()}`;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>数据统计</Typography>
        <ToggleButtonGroup value={periodKind} exclusive onChange={(_, v) => v && setPeriodKind(v)} size="small">
          <ToggleButton value="month">本月</ToggleButton>
          <ToggleButton value="quarter">本季</ToggleButton>
          <ToggleButton value="year">本年</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      ) : (<><Grid2 container spacing={3} mb={4}>
        {[
          { label: '预计收入', value: formatCurrency(summary.expected), color: '#F5D78E' },
          { label: '已收', value: formatCurrency(summary.collected), color: '#7BA37B' },
          { label: '未收', value: formatCurrency(summary.uncollected), color: '#C97B7B' },
          { label: '收租率', value: `${summary.rate}%`, color: '#6B8FBF' },
        ].map((item) => (
          <Grid2 size={{ xs: 6, md: 3 }} key={item.label}>
            <Card sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight={700} color={item.color}>{item.value}</Typography>
              <Typography variant="body2" color="text.secondary" mt={1}>{item.label}</Typography>
            </Card>
          </Grid2>
        ))}
      </Grid2>

      <Grid2 container spacing={3}>
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
                  {(rentStats?.list || []).map((item: any) => (
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
              {((occupancyStats?.propertyStats as any[]) || []).map((item: any, idx: number) => (
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
      </>)}
    </Box>
  );
}
