import { useState, useEffect } from 'react';
import { Box, Card, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField, Chip, Tabs, Tab, Snackbar, Alert } from '@mui/material';
import { Add, Edit, Delete, Logout } from '@mui/icons-material';
import { tenantApi } from '../../services/api';

const STATUS_MAP: Record<number, string> = { 0: '已退租', 1: '在租' };
const STATUS_COLOR: Record<number, 'default' | 'success'> = { 0: 'default', 1: 'success' };

export default function TenantList() {
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [data, setData] = useState<any[]>([]);
  const [moveOutOpen, setMoveOutOpen] = useState(false);
  const [moveOutTarget, setMoveOutTarget] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const fetchList = async () => {
    try {
      const res = await tenantApi.list();
      setData((res as any)?.data?.data ?? (res as any)?.data ?? []);
    } catch (e) {
      console.error('获取租客列表失败', e);
    }
  };

  useEffect(() => { fetchList(); }, []);

  const handleSave = async () => {
    try {
      if (editData.id) {
        await tenantApi.update(editData.id, editData);
        setToast({ message: '租客信息已更新', severity: 'success' });
      } else {
        await tenantApi.create(editData);
        setToast({ message: '租客登记成功', severity: 'success' });
      }
      setOpen(false);
      setEditData({});
      fetchList();
    } catch (e) {
      console.error('保存租客失败', e);
      setToast({ message: '操作失败，请稍后重试', severity: 'error' });
    }
  };

  const handleMoveOut = async () => {
    if (!moveOutTarget) return;
    try {
      await tenantApi.moveOut(moveOutTarget.id, {});
      setToast({ message: `${moveOutTarget.name} 已退租`, severity: 'success' });
      setMoveOutOpen(false);
      setMoveOutTarget(null);
      fetchList();
    } catch (e) {
      console.error('退租失败', e);
    }
  };

  const handleDelete = async (row: any) => {
    try {
      await tenantApi.remove(row.id);
      setToast({ message: '租客已删除', severity: 'success' });
      fetchList();
    } catch (e) {
      console.error('删除租客失败', e);
    }
  };

  // 筛选：tab=0全部, tab=1在租(status=1), tab=2已退租(status=0)
  const filtered = data.filter((d) => tab === 0 || (tab === 1 ? d.status === 1 : d.status === 0));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>租客管理</Typography>
        <Button variant="contained" startIcon={<Add />}
          onClick={() => { setEditData({}); setOpen(true); }}
          sx={{ bgcolor: '#F5D78E', color: '#4A4038', fontWeight: 600 }}>登记租客</Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="全部" /> <Tab label="在租" /> <Tab label="已退租" />
      </Tabs>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>姓名</TableCell><TableCell>电话</TableCell><TableCell>房间</TableCell>
                <TableCell>入住时间</TableCell><TableCell>合同到期</TableCell>
                <TableCell>收租日</TableCell><TableCell>押金</TableCell>
                <TableCell>状态</TableCell><TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography color="text.secondary">暂无租客</Typography>
                  </TableCell>
                </TableRow>
              ) : filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell><Typography fontWeight={600}>{row.name}</Typography></TableCell>
                  <TableCell>{row.phone}</TableCell>
                  <TableCell>{row.room || row.roomName || '-'}</TableCell>
                  <TableCell>{row.moveInDate || '-'}</TableCell>
                  <TableCell>{row.contractEnd || '-'}</TableCell>
                  <TableCell>每月 {row.rentDay || '-'} 号</TableCell>
                  <TableCell>{row.deposit ? `${row.deposit} 元` : '-'}</TableCell>
                  <TableCell>
                    <Chip label={STATUS_MAP[row.status] ?? '未知'} size="small" color={STATUS_COLOR[row.status] ?? 'default'} />
                  </TableCell>
                  <TableCell>
                    <IconButton onClick={() => { setEditData(row); setOpen(true); }}><Edit fontSize="small" /></IconButton>
                    {row.status === 1 && (
                      <IconButton onClick={() => { setMoveOutTarget(row); setMoveOutOpen(true); }}>
                        <Logout fontSize="small" color="warning" />
                      </IconButton>
                    )}
                    <IconButton onClick={() => handleDelete(row)}><Delete fontSize="small" color="error" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* 登记/编辑租客弹窗 */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editData.id ? '编辑租客' : '登记租客'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="姓名" value={editData.name || ''} onChange={(e) => setEditData({ ...editData, name: e.target.value })} sx={{ mt: 1, mb: 2 }} />
          <TextField fullWidth label="电话" value={editData.phone || ''} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="所属房间（房间名或ID）" value={editData.room || ''} onChange={(e) => setEditData({ ...editData, room: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="入住日期" type="date" InputLabelProps={{ shrink: true }} value={editData.moveInDate || ''} onChange={(e) => setEditData({ ...editData, moveInDate: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="合同到期" type="date" InputLabelProps={{ shrink: true }} value={editData.contractEnd || ''} onChange={(e) => setEditData({ ...editData, contractEnd: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="收租日" type="number" value={editData.rentDay || ''} onChange={(e) => setEditData({ ...editData, rentDay: Number(e.target.value) })} sx={{ mb: 2 }} inputProps={{ min: 1, max: 31 }} />
          <TextField fullWidth label="押金" type="number" value={editData.deposit || ''} onChange={(e) => setEditData({ ...editData, deposit: Number(e.target.value) })} inputProps={{ min: 0 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} sx={{ bgcolor: '#F5D78E', color: '#4A4038' }}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* 退租确认弹窗 */}
      <Dialog open={moveOutOpen} onClose={() => { setMoveOutOpen(false); setMoveOutTarget(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>确认退租</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要为租客 <strong>{moveOutTarget?.name}</strong>（{moveOutTarget?.room || moveOutTarget?.roomName}）办理退租吗？退租后该租客状态将变为"已退租"。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setMoveOutOpen(false); setMoveOutTarget(null); }}>取消</Button>
          <Button variant="contained" onClick={handleMoveOut} sx={{ bgcolor: '#C97B7B', color: '#fff' }}>
            确认退租
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast 提示 */}
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert onClose={() => setToast(null)} severity={toast?.severity} sx={{ width: '100%' }}>{toast?.message}</Alert>
      </Snackbar>
    </Box>
  );
}
