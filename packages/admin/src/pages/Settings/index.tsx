import { useState, useEffect } from 'react';
import { Box, Card, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, IconButton, Switch, Divider, Alert, CircularProgress } from '@mui/material';
import { Edit, Refresh } from '@mui/icons-material';
import { settingsApi, adminApi } from '../../services/api';

export default function Settings() {
  const [open, setOpen] = useState(false);
  const [editData, setEditData] = useState<any>({});

  // 管理员
  const [admins, setAdmins] = useState<any[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);

  // 通知配置
  const [notifications, setNotifications] = useState<Record<string, any>>({});
  const [notifSaving, setNotifSaving] = useState(false);

  // 系统参数
  const [params, setParams] = useState<Record<string, any>>({});
  const [paramsSaving, setParamsSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // 加载数据
  useEffect(() => {
    loadAdmins();
    loadNotifications();
    loadParams();
  }, []);

  const loadAdmins = async () => {
    setAdminsLoading(true);
    try {
      const res = await adminApi.list();
      setAdmins(res.list || []);
    } catch {
      setError('加载管理员列表失败');
    } finally {
      setAdminsLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const res = await settingsApi.getNotifications();
      setNotifications(res.data || {});
    } catch {
      setError('加载通知配置失败');
    }
  };

  const loadParams = async () => {
    try {
      const res = await settingsApi.getParams();
      setParams(res.data || {});
    } catch {
      setError('加载系统参数失败');
    }
  };

  const handleSaveAdmin = async () => {
    try {
      if (editData.id) {
        await adminApi.update(editData.id, { name: editData.name, role: editData.role } as any);
        // B14 fix: password field previously had no `value` binding, so
        // editData.password stayed empty and this branch was unreachable.
        if (editData.password) {
          await adminApi.resetPassword(editData.id, editData.password);
        }
      } else {
        await adminApi.create(editData);
      }
      setOpen(false);
      loadAdmins();
    } catch {
      setError('保存管理员失败');
    }
  };

  const handleToggleNotification = async (key: string, enabled: boolean) => {
    const updated = { ...notifications, [key]: { ...notifications[key], enabled } };
    setNotifications(updated);
  };

  const handleSaveNotifications = async () => {
    setNotifSaving(true);
    try {
      await settingsApi.updateNotifications(notifications);
    } catch {
      setError('保存通知配置失败');
    } finally {
      setNotifSaving(false);
    }
  };

  const handleSaveParams = async () => {
    setParamsSaving(true);
    try {
      await settingsApi.updateParams(params);
    } catch {
      setError('保存系统参数失败');
    } finally {
      setParamsSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>系统设置</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 3, flexDirection: 'column' }}>
        {/* 管理员管理 */}
        <Card sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>管理员用户</Typography>
            <Button variant="contained" size="small"
              onClick={() => { setEditData({}); setOpen(true); }}
              sx={{ bgcolor: '#F5D78E', color: '#4A4038' }}>
              新增管理员
            </Button>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>用户名</TableCell><TableCell>姓名</TableCell><TableCell>角色</TableCell>
                  <TableCell>状态</TableCell><TableCell>最后登录</TableCell><TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {adminsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <CircularProgress size={24} />
                    </TableCell>
                  </TableRow>
                ) : admins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary">暂无管理员</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  admins.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.username}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell><Chip label={row.role === 0 ? '超级管理员' : '运营人员'} size="small" /></TableCell>
                      <TableCell><Chip label={row.status === 1 ? '启用' : '禁用'} size="small" color={row.status === 1 ? 'success' : 'default'} /></TableCell>
                      <TableCell>{row.lastLogin || '-'}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => { setEditData(row); setOpen(true); }}>
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={loadAdmins}><Refresh fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        {/* 通知配置 */}
        <Card sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>通知配置</Typography>
            <Button variant="contained" size="small"
              onClick={handleSaveNotifications} disabled={notifSaving}
              sx={{ bgcolor: '#F5D78E', color: '#4A4038' }}>
              {notifSaving ? '保存中...' : '保存通知'}
            </Button>
          </Box>
          {Object.keys(notifications).length === 0 ? (
            <Typography color="text.secondary">暂无通知配置</Typography>
          ) : (
            Object.entries(notifications).map(([key, value]) => (
              <Box key={key}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                  <Typography>{key}</Typography>
                  <Switch
                    checked={value?.enabled === true}
                    onChange={(e) => handleToggleNotification(key, e.target.checked)}
                  />
                </Box>
                <Divider />
              </Box>
            ))
          )}
        </Card>

        {/* 系统参数 */}
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={2}>系统参数</Typography>
          {Object.entries(params).map(([key, value]) => {
            // B13 fix: previously every param was rendered as a free-text field
            // and onChange coerced everything to string. Saving then sent
            // `{ enableAutoRemind: "true", remindDays: "3", ... }` which the
            // backend rejected because enableAutoRemind must be a real boolean.
            const isBoolean = typeof value === 'boolean';
            const isNumber = typeof value === 'number';
            return (
              <Box key={key} sx={{ mb: 2 }}>
                {isBoolean ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography>{key}</Typography>
                    <Switch
                      checked={value === true}
                      onChange={(e) => setParams({ ...params, [key]: e.target.checked })}
                    />
                  </Box>
                ) : (
                  <TextField
                    fullWidth
                    label={key}
                    type={isNumber ? 'number' : 'text'}
                    value={value ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const next = isNumber ? (raw === '' ? '' : Number(raw)) : raw;
                      setParams({ ...params, [key]: next });
                    }}
                  />
                )}
              </Box>
            );
          })}
          <Button variant="contained" onClick={handleSaveParams} disabled={paramsSaving}
            sx={{ bgcolor: '#F5D78E', color: '#4A4038' }}>
            {paramsSaving ? '保存中...' : '保存参数'}
          </Button>
        </Card>
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editData.id ? '编辑管理员' : '新增管理员'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="用户名" value={editData.username || ''}
            onChange={(e) => setEditData({ ...editData, username: e.target.value })} sx={{ mt: 1, mb: 2 }} />
          <TextField fullWidth label="姓名" value={editData.name || ''}
            onChange={(e) => setEditData({ ...editData, name: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="密码" type="password"
            value={editData.password || ''}
            onChange={(e) => setEditData({ ...editData, password: e.target.value })} sx={{ mb: 2 }}
            helperText={editData.id ? '留空则不修改密码' : ''} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSaveAdmin} sx={{ bgcolor: '#F5D78E', color: '#4A4038' }}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
