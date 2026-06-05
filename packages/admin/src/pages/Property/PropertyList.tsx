import { useState, useEffect, useCallback } from 'react';
import { Box, Card, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField, Chip, MenuItem, Snackbar, Alert } from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { propertyApi, landlordApi } from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import type { Property, CreatePropertyDTO, Landlord } from '@local-landlord/shared';
import { AdminRole } from '@local-landlord/shared';

/** Extended Property with joined fields returned by the admin API */
interface PropertyRow extends Property {
  landlordName?: string;
}

export default function PropertyList() {
  const { role } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [editData, setEditData] = useState<{ id?: number; name?: string; address?: string; landlordId?: string; note?: string; coverImage?: string }>({ name: '', address: '', landlordId: '', note: '', coverImage: '' });
  const [data, setData] = useState<PropertyRow[]>([]);
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [keyword, setKeyword] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PropertyRow | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const fetchList = useCallback(async () => {
    try {
      const result = await propertyApi.list(keyword ? { keyword } : undefined);
      setData(result.list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      setToast({ message: '获取房源列表失败：' + msg, severity: 'error' });
    }
  }, [keyword]);

  const fetchLandlords = async () => {
    try {
      const result = await landlordApi.list();
      setLandlords(result.list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      setToast({ message: '获取房东列表失败：' + msg, severity: 'error' });
    }
  };

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleOpenDialog = (row?: PropertyRow) => {
    fetchLandlords();
    if (row) {
      setEditData({
        id: row.id,
        name: row.name,
        address: row.address || '',
        landlordId: String(row.landlordId),
        note: row.note || '',
        coverImage: row.coverImage || '',
      });
    } else {
      setEditData({ name: '', address: '', landlordId: '', note: '', coverImage: '' });
    }
    setOpen(true);
  };

  const handleSave = async () => {
    if (!editData.name?.trim()) {
      setToast({ message: '房源名称不能为空', severity: 'error' });
      return;
    }
    try {
      const payload: CreatePropertyDTO = {
        name: editData.name,
        address: editData.address || undefined,
        coverImage: editData.coverImage || undefined,
        note: editData.note || undefined,
      };
      if (editData.id) {
        await propertyApi.update(editData.id, payload);
      } else {
        await propertyApi.create(payload);
      }
      setOpen(false);
      setEditData({ name: '', address: '', landlordId: '', note: '', coverImage: '' });
      fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      setToast({ message: '保存房源失败：' + msg, severity: 'error' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await propertyApi.remove(deleteTarget.id);
      setDeleteOpen(false);
      setDeleteTarget(null);
      fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      setToast({ message: '删除房源失败：' + msg, severity: 'error' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>房源管理</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            placeholder="搜索房源名称"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            sx={{ width: 200 }}
          />
          <Button variant="contained" startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            sx={{ bgcolor: '#F5D78E', color: '#4A4038', fontWeight: 600 }}>
            新增房源
          </Button>
        </Box>
      </Box>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>房源名称</TableCell>
                <TableCell>地址</TableCell>
                <TableCell>房间数</TableCell>
                <TableCell>所属房东</TableCell>
                <TableCell>已租</TableCell>
                <TableCell>空置</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary">暂无房源，点击新增</Typography>
                  </TableCell>
                </TableRow>
              ) : data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell><Typography fontWeight={600}>{row.name}</Typography></TableCell>
                  <TableCell>{row.address || '-'}</TableCell>
                  <TableCell>{row.roomCount ?? 0}</TableCell>
                  <TableCell>{row.landlordName || '-'}</TableCell>
                  <TableCell><Chip label={row.rentedCount ?? 0} size="small" color="success" /></TableCell>
                  <TableCell>{row.vacantCount ?? 0}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleOpenDialog(row)}><Edit fontSize="small" /></IconButton>
                    {role === AdminRole.SUPER_ADMIN && (
                      <IconButton onClick={() => { setDeleteTarget(row); setDeleteOpen(true); }}><Delete fontSize="small" color="error" /></IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editData.id ? '编辑房源' : '新增房源'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth required label="房源名称" value={editData.name || ''} onChange={(e) => setEditData({ ...editData, name: e.target.value })} sx={{ mt: 1, mb: 2 }} />
          <TextField fullWidth label="地址" value={editData.address || ''} onChange={(e) => setEditData({ ...editData, address: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth select label="所属房东" value={editData.landlordId ?? ''} onChange={(e) => setEditData({ ...editData, landlordId: e.target.value })} sx={{ mb: 2 }}>
            {landlords.map((l) => (
              <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
            ))}
          </TextField>
          <TextField fullWidth label="封面图URL" value={editData.coverImage || ''} onChange={(e) => setEditData({ ...editData, coverImage: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="备注" value={editData.note || ''} onChange={(e) => setEditData({ ...editData, note: e.target.value })} multiline rows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} sx={{ bgcolor: '#F5D78E', color: '#4A4038' }}>保存</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => { setDeleteOpen(false); setDeleteTarget(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要删除房源 <strong>{deleteTarget?.name}</strong> 吗？此操作不可撤销。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteOpen(false); setDeleteTarget(null); }}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm}>确认删除</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert onClose={() => setToast(null)} severity={toast?.severity} sx={{ width: '100%' }}>{toast?.message}</Alert>
      </Snackbar>
    </Box>
  );
}
