import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  AppBar, Toolbar, Typography, IconButton,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Apartment as PropertyIcon,
  MeetingRoom as RoomIcon,
  People as PeopleIcon,
  Receipt as ReceiptIcon,
  Description as DescriptionIcon,
  BarChart as BarChartIcon,
  Settings as SettingsIcon,
  Logout,
} from '@mui/icons-material';
import { useAuthStore } from '../store/useAuthStore';

const drawerWidth = 240;

const menuItems = [
  { path: '/dashboard', label: '数据看板', icon: <DashboardIcon /> },
  { path: '/landlords', label: '房东管理', icon: <PeopleIcon /> },
  { path: '/properties', label: '房源管理', icon: <PropertyIcon /> },
  { path: '/rooms', label: '房间管理', icon: <RoomIcon /> },
  { path: '/tenants', label: '租客管理', icon: <PeopleIcon /> },
  { path: '/rent', label: '收租管理', icon: <ReceiptIcon /> },
  { path: '/contracts', label: '合同管理', icon: <DescriptionIcon /> },
  { path: '/statistics', label: '数据统计', icon: <BarChartIcon /> },
  { path: '/settings', label: '系统设置', icon: <SettingsIcon />, superAdminOnly: true },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, clearAuth, isSuperAdmin } = useAuthStore();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            bgcolor: '#1A1A2E',
            color: '#fff',
            borderRight: 'none',
          },
        }}
      >
        <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography variant="h6" fontWeight={700} color="#F5D78E">
            五联人家
          </Typography>
          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            管理后台
          </Typography>
        </Box>
        <List sx={{ px: 1, pt: 2 }}>
          {menuItems
            .filter((item) => !item.superAdminOnly || isSuperAdmin)
            .map((item) => (
            <ListItemButton
              key={item.path}
              onClick={() => navigate(item.path)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                color: location.pathname.startsWith(item.path) ? '#F5D78E' : 'rgba(255,255,255,0.7)',
                bgcolor: location.pathname.startsWith(item.path) ? 'rgba(245,215,142,0.1)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" elevation={0} sx={{ bgcolor: '#fff', color: '#333' }}>
          <Toolbar>
            <Box sx={{ flex: 1 }} />
            <Typography variant="body2" sx={{ mr: 2 }}>
              {admin?.name || '管理员'}
            </Typography>
            <IconButton color="inherit" onClick={clearAuth} size="small">
              <Logout />
            </IconButton>
          </Toolbar>
        </AppBar>
        <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
