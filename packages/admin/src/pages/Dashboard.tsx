import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Button,
} from '@mui/material';
import {
  People as PeopleIcon,
  Home as HomeIcon,
  Receipt as ReceiptIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  Add as AddIcon,
  List as ListIcon,
} from '@mui/icons-material';

// Mock data for dashboard
const mockStats = {
  totalLandlords: 128,
  newToday: 3,
  totalProperties: 456,
  totalRooms: 892,
  monthlyExpected: 12500000, // 12.5万元 (fen)
  monthlyCollected: 9870000, // 9.87万元
  collectionRate: 78.96,
  overdueBills: 23,
};

const mockPendingBills = [
  { id: '1', tenantName: '张三', roomName: '301室', propertyName: '幸福小区', amount: 350000, daysOverdue: 5 },
  { id: '2', tenantName: '李四', roomName: '102室', propertyName: '阳光花园', amount: 280000, daysOverdue: 2 },
  { id: '3', tenantName: '王五', roomName: '501室', propertyName: '幸福小区', amount: 420000, daysOverdue: 12 },
];

const mockRecentActivities = [
  { id: '1', action: '房东 张三 添加了新房源「阳光花园」', time: '5分钟前' },
  { id: '2', action: '租客 李四 缴费 ¥2800', time: '1小时前' },
  { id: '3', action: '系统 自动生成7月账单', time: '2小时前' },
];

export default function Dashboard() {
  const stats = mockStats;

  const formatAmount = (fen: number) => `¥${(fen / 100).toFixed(2)}`;

  return (
    <Box className="space-y-6">
      {/* Page title */}
      <Typography variant="h4" className="font-bold" style={{ color: '#4A4038' }}>
        仪表盘
      </Typography>

      {/* Stats cards */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="rounded-2xl shadow-card">
            <CardContent className="p-6">
              <Box className="flex items-center gap-4">
                <Box className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#FDF2E0' }}>
                  <PeopleIcon style={{ color: '#F5D78E' }} />
                </Box>
                <Box>
                  <Typography variant="caption" style={{ color: '#8B7E74' }}>总房东数</Typography>
                  <Typography variant="h5" className="font-bold" style={{ color: '#4A4038' }}>
                    {stats.totalLandlords}
                  </Typography>
                  <Typography variant="caption" style={{ color: '#7BA37B' }}>+{stats.newToday} 今日新增</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className="rounded-2xl shadow-card">
            <CardContent className="p-6">
              <Box className="flex items-center gap-4">
                <Box className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#FDF2E0' }}>
                  <HomeIcon style={{ color: '#F5D78E' }} />
                </Box>
                <Box>
                  <Typography variant="caption" style={{ color: '#8B7E74' }}>房源/房间</Typography>
                  <Typography variant="h5" className="font-bold" style={{ color: '#4A4038' }}>
                    {stats.totalProperties}/{stats.totalRooms}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className="rounded-2xl shadow-card">
            <CardContent className="p-6">
              <Box className="flex items-center gap-4">
                <Box className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#FDF2E0' }}>
                  <ReceiptIcon style={{ color: '#F5D78E' }} />
                </Box>
                <Box>
                  <Typography variant="caption" style={{ color: '#8B7E74' }}>本月收款率</Typography>
                  <Typography variant="h5" className="font-bold" style={{ color: '#7BA37B' }}>
                    {stats.collectionRate}%
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className="rounded-2xl shadow-card">
            <CardContent className="p-6">
              <Box className="flex items-center gap-4">
                <Box className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#FDE8E0' }}>
                  <WarningIcon style={{ color: '#C97B7B' }} />
                </Box>
                <Box>
                  <Typography variant="caption" style={{ color: '#8B7E74' }}>逾期账单</Typography>
                  <Typography variant="h5" className="font-bold" style={{ color: '#C97B7B' }}>
                    {stats.overdueBills}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Bottom section: pending bills + recent activity */}
      <Grid container spacing={3}>
        {/* Pending bills */}
        <Grid item xs={12} md={7}>
          <Card className="rounded-2xl shadow-card">
            <CardContent className="p-6">
              <Box className="flex items-center justify-between mb-4">
                <Typography variant="h6" className="font-bold" style={{ color: '#4A4038' }}>
                  今日待办（逾期账单）
                </Typography>
                <Button
                  variant="text"
                  size="small"
                  style={{ color: '#F5D78E' }}
                  onClick={() => window.location.href = '/rent'}
                >
                  查看全部
                </Button>
              </Box>
              <List>
                {mockPendingBills.map((bill, idx) => (
                  <React.Fragment key={bill.id}>
                    {idx > 0 && <Divider />}
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar style={{ background: bill.daysOverdue > 7 ? '#FDE8E0' : '#FDF2E0' }}>
                          <WarningIcon style={{ color: bill.daysOverdue > 7 ? '#C97B7B' : '#E8B87D' }} />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={`${bill.tenantName} - ${bill.roomName}`}
                        secondary={`${bill.propertyName} | 逾期${bill.daysOverdue}天`}
                      />
                      <Typography variant="body2" className="font-bold" style={{ color: '#C97B7B' }}>
                        {formatAmount(bill.amount)}
                      </Typography>
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent activity */}
        <Grid item xs={12} md={5}>
          <Card className="rounded-2xl shadow-card">
            <CardContent className="p-6">
              <Typography variant="h6" className="font-bold mb-4" style={{ color: '#4A4038' }}>
                最近动态
              </Typography>
              <List>
                {mockRecentActivities.map((activity, idx) => (
                  <React.Fragment key={activity.id}>
                    {idx > 0 && <Divider />}
                    <ListItem alignItems="flex-start">
                      <ListItemAvatar>
                        <Avatar style={{ background: '#FDF2E0' }}>
                          <TrendingUpIcon style={{ color: '#F5D78E' }} />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={activity.action}
                        secondary={activity.time}
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick actions */}
      <Card className="rounded-2xl shadow-card">
        <CardContent className="p-6">
          <Typography variant="h6" className="font-bold mb-4" style={{ color: '#4A4038' }}>
            快捷入口
          </Typography>
          <Grid container spacing={2}>
            {[
              { label: '房源管理', path: '/properties', icon: <HomeIcon /> },
              { label: '房间管理', path: '/rooms', icon: <ListIcon /> },
              { label: '租客管理', path: '/tenants', icon: <PeopleIcon /> },
              { label: '收租管理', path: '/rent', icon: <ReceiptIcon /> },
            ].map((item) => (
              <Grid item xs={6} sm={3} key={item.path}>
                <Button
                  fullWidth
                  variant="outlined"
                  className="p-4 rounded-2xl"
                  style={{ borderColor: '#F5D78E', color: '#4A4038' }}
                  onClick={() => window.location.href = item.path}
                >
                  <Box className="text-center">
                    {item.icon}
                    <Typography variant="body2" className="mt-2 block">
                      {item.label}
                    </Typography>
                  </Box>
                </Button>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
