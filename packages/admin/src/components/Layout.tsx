import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Dasboard as DashboardIcon,
  People as PeopleIcon,
  Home as HomeIcon,
  Hotel as HotelIcon,
  Receipt as ReceiptIcon,
  Description as DescriptionIcon,
  BarChart as BarChartIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
} from '@mui/icons-material';

const drawerWidth = 240;

interface MenuItemConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  allowedRoles: ('super' | 'operator')[];
}

const menuItems: MenuItemConfig[] = [
  { key: 'dashboard', label: '仪表盘', icon: <DashboardIcon />, path: '/dashboard', allowedRoles: ['super', 'operator'] },
  { key: 'properties', label: '房源管理', icon: <HomeIcon />, path: '/properties', allowedRoles: ['super'] },
  { key: 'rooms', label: '房间管理', icon: <HotelIcon />, path: '/rooms', allowedRoles: ['super'] },
  { key: 'tenants', label: '租客管理', icon: <PeopleIcon />, path: '/tenants', allowedRoles: ['super', 'operator'] },
  { key: 'rent', label: '收租管理', icon: <ReceiptIcon />, path: '/rent', allowedRoles: ['super', 'operator'] },
  { key: 'contracts', label: '合同管理', icon: <DescriptionIcon />, path: '/contracts', allowedRoles: ['super', 'operator'] },
  { key: 'statistics', label: '数据统计', icon: <BarChartIcon />, path: '/statistics', allowedRoles: ['super', 'operator'] },
  { key: 'settings', label: '系统设置', icon: <SettingsIcon />, path: '/settings', allowedRoles: ['super'] },
];

function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { adminUser, logout } = useAdminStore();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
    navigate('/login');
  };

  const role = adminUser?.role || 'operator';

  const drawer = (
    <div className="h-full flex flex-col" style={{ background: '#FFFDF9' }}>
      <div className="p-6 pb-4">
        <Typography variant="h6" className="font-bold" style={{ color: '#4A4038' }}>
          本地房东
        </Typography>
        <Typography variant="caption" style={{ color: '#8B7E74' }}>
          管理后台
        </Typography>
      </div>
      <Divider />
      <List className="flex-1 overflow-auto p-2">
        {menuItems
          .filter((item) => item.allowedRoles.includes(role as 'super' | 'operator'))
          .map((item) => (
            <ListItem
              button
              key={item.key}
              component={Link}
              to={item.path}
              selected={location.pathname === item.path}
              className={`mb-1 rounded-xl ${location.pathname === item.path ? 'bg-accent-soft' : ''}`}
              style={{
                borderRadius: '12px',
                ...(location.pathname === item.path ? { background: '#FDF2E0' } : {}),
              }}
            >
              <ListItemIcon style={{ color: location.pathname === item.path ? '#F5D78E' : '#8B7E74' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                style={{ color: location.pathname === item.path ? '#4A4038' : '#8B7E74' }}
              />
            </ListItem>
          ))}
      </List>
    </div>
  );

  return (
    <Box className="flex h-screen">
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth } }}
      >
        {drawer}
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth } }}
        open
      >
        {drawer}
      </Drawer>

      {/* Main content */}
      <Box className="flex-1 flex flex-col overflow-hidden">
        {/* Top AppBar */}
        <AppBar
          position="static"
          className="shadow-soft"
          style={{ background: '#FFFDF9' }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              className="mr-2"
              sx={{ display: { sm: 'none' } }}
            >
              <MenuIcon style={{ color: '#4A4038' }} />
            </IconButton>
            <Typography variant="h6" className="flex-1 font-bold" style={{ color: '#4A4038' }}>
              {menuItems.find((item) => item.path === location.pathname)?.label || '管理后台'}
            </Typography>
            <div className="flex items-center gap-4">
              <Typography variant="body2" style={{ color: '#8B7E74' }}>
                {adminUser?.username || '管理员'}
              </Typography>
              <IconButton onClick={handleMenuOpen} size="small">
                <Avatar style={{ width: 32, height: 32, background: '#F5D78E', color: '#4A4038' }}>
                  {(adminUser?.username || 'A')[0].toUpperCase()}
                </Avatar>
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
              >
                <MenuItem onClick={handleLogout}>
                  <LogoutIcon className="mr-2" fontSize="small" />
                  退出登录
                </MenuItem>
              </Menu>
            </div>
          </Toolbar>
        </AppBar>

        {/* Page content */}
        <Box className="flex-1 overflow-auto p-6" style={{ background: '#FDF8F3' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

export default Layout;
