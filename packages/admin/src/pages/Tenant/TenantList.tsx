import { useState, useEffect } from 'react';
import { Box, Card, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField, Chip, Tabs, Tab, Snackbar, Alert } from '@mui/material';
import { Add, Edit, Delete, Logout } from '@mui/icons-material';
import { tenantApi } from '../../services/api';
import type { Tenant, CreateAdminTenantDTO, UpdateTenantDTO } from '@local-landlord/shared';
import { TenantStatus } from '@local-landlord/shared';

/** Extended Tenant with joined fields returned by the admin API */
interface TenantRow extends Tenant {
  room?: { id: number; name: string };
  roomName?: string;
}

const STATUS_MAP: Record<number, string> = { 0: '已退租', 1: '在租' };
const STATUS_COLOR: Record<number, 'default' | 'success'> = { 0: 'default', 1: 'success' };

export default function TenantList() {
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<Tenant>>({});
  const [data, setData] = useState<TenantRow[]>([]);
  const [moveOutOpen, setMoveOutOpen] = useState(false);
  const [moveOutTarget, setMoveOutTarget] = useState<TenantRow | null>(null);
  const [moveOutDate, setMoveOutDate] = useState(new Date().toISOString().slice(0, 10));
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const fetchList = async () => {
    try {
      const result = await tenantApi.list();
      setData(result.list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      setToast({ message: '获取租客列表失败：' + msg, severity: 'error' });
    }
  };

  useEffect(() => { fetchList(); }, []);

  const handleSave = async () => {
    try {
      if (editData.id) {
        const dto: UpdateTenantDTO = {
          name: editData.name,
          phone: editData.phone,
          contractEndDate: editData.contractEndDate,
          rentDay: editData.rentDay,
          note: editData.note,
        };
        await tenantApi.update(editData.id, dto);
        setToast({ message: '租客信息已更新', severity: 'success' });
      } else {
        if (!editData.roomId) {
          setToast({ message: '请填写房间ID', severity: 'error' });
          return;
        }
        // B11 fix: roomId was collected in the form but dropped from the POST
        // body, so admin "登记租客" always 400'd with `roomId required`.
        const dto: CreateAdminTenantDTO = {
          name: editData.name || '',
          phone: editData.phone || '',
          roomId: Number(editData.roomId),
          moveInDate: editData.moveInDate || '',
          contractEndDate: editData.contractEndDate || '',
          rentDay: editData.rentDay ?? 1,
          deposit: editData.deposit,
          note: editData.note,
        };
        await tenantApi.create(dto);
        setToast({ message: '租客登记成功', severity: 'success' });
      }
      setOpen(false);
      setEditData({});
      fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      setToast({ message: '操作失败：' + msg, severity: 'error' });
    }
  };

  const handleMoveOut = async () => {
    if (!moveOutTarget) return;
    try {
      await tenantApi.moveOut(moveOutTarget.id, { moveOutDate });
      setToast({ message: `${moveOutTarget.name} 已退租`, severity: 'success' });
      setMoveOutOpen(false);
      setMoveOutTarget(null);
      fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      setToast({ message: '退租失败：' + msg, severity: 'error' });
    }
  };

  const handleDelete = async (row: Tenant) => {
    try {
      await tenantApi.remove(row.id);
      setToast({ message: '租客已删除', severity: 'success' });
      fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      setToast({ message: '删除租客失败：' + msg, severity: 'error' });
    }
  };

  // Filter: tab=0 all, tab=1 active (status=1), tab=2 moved out (status=0)
  const filtered = data.filter((d) => tab === 0 || (tab === 1 ? d.status === TenantStatus.ACTIVE : d.status === TenantStatus.MOVED_OUT));

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
                  <TableCell>{row.room?.name || row.roomName || '-'}</TableCell>
                  <TableCell>{row.moveInDate || '-'}</TableCell>
                  <TableCell>{row.contractEndDate || '-'}</TableCell>
                  <TableCell>每月 {row.rentDay || '-'} 号</TableCell>
                  <TableCell>{row.deposit ? `${row.deposit} 元` : '-'}</TableCell>
                  <TableCell>
                    <Chip label={STATUS_MAP[row.status] ?? '未知'} size="small" color={STATUS_COLOR[row.status] ?? 'default'} />
                  </TableCell>
                  <TableCell>
                    <IconButton onClick={() => { setEditData(row); setOpen(true); }}><Edit fontSize="small" /></IconButton>
                    {row.status === TenantStatus.ACTIVE && (
                      <IconButton onClick={() => { setMoveOutTarget(row); setMoveOutDate(new Date().toISOString().slice(0, 10)); setMoveOutOpen(true); }}>
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

      {/* Register/Edit tenant dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editData.id ? '编辑租客' : '登记租客'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="姓名" value={editData.name || ''} onChange={(e) => setEditData({ ...editData, name: e.target.value })} sx={{ mt: 1, mb: 2 }} />
          <TextField fullWidth label="电话" value={editData.phone || ''} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="房间ID" type="number" value={editData.roomId || ''} onChange={(e) => setEditData({ ...editData, roomId: Number(e.target.value) })} sx={{ mb: 2 }} placeholder="请输入房间ID" />
          <TextField fullWidth label="入住日期" type="date" InputLabelProps={{ shrink: true }} value={editData.moveInDate || ''} onChange={(e) => setEditData({ ...editData, moveInDate: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="合同到期" type="date" InputLabelProps={{ shrink: true }} value={editData.contractEndDate || ''} onChange={(e) => setEditData({ ...editData, contractEndDate: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="收租日" type="number" value={editData.rentDay || ''} onChange={(e) => setEditData({ ...editData, rentDay: Number(e.target.value) })} sx={{ mb: 2 }} inputProps={{ min: 1, max: 31 }} />
          <TextField fullWidth label="押金" type="number" value={editData.deposit || ''} onChange={(e) => setEditData({ ...editData, deposit: Number(e.target.value) })} inputProps={{ min: 0 }} sx={{ mb: 2 }} />
          <TextField fullWidth label="备注" value={editData.note || ''} onChange={(e) => setEditData({ ...editData, note: e.target.value })} multiline rows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} sx={{ bgcolor: '#F5D78E', color: '#4A4038' }}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* Move-out confirmation dialog */}
      <Dialog open={moveOutOpen} onClose={() => { setMoveOutOpen(false); setMoveOutTarget(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>确认退租</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要为租客 <strong>{moveOutTarget?.name}</strong>（{moveOutTarget?.room?.name || moveOutTarget?.roomName}）办理退租吗？退租后该租客状态将变为"已退租"。
          </DialogContentText>
          <TextField
            fullWidth
            label="退租日期"
            type="date"
            value={moveOutDate}
            onChange={(e) => setMoveOutDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setMoveOutOpen(false); setMoveOutTarget(null); }}>取消</Button>
          <Button variant="contained" onClick={handleMoveOut} sx={{ bgcolor: '#C97B7B', color: '#fff' }}>
            确认退租
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast */}
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert onClose={() => setToast(null)} severity={toast?.severity} sx={{ width: '100%' }}>{toast?.message}</Alert>
      </Snackbar>
    </Box>
  );
}
