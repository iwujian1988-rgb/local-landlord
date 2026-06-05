import { useState, useEffect, useCallback } from 'react';
import { Box, Card, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField, Chip, MenuItem } from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { propertyApi, landlordApi } from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';

export default function PropertyList() {
  const { role } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [editData, setEditData] = useState<any>({ name: '', address: '', landlordName: '', notes: '' });
  const [data, setData] = useState<any[]>([]);
  const [landlords, setLandlords] = useState<any[]>([]);
  const [keyword, setKeyword] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const fetchList = useCallback(async () => {
    try {
      const res = await propertyApi.list(keyword ? { keyword } : undefined);
      setData((res as any)?.data?.data ?? (res as any)?.data ?? []);
    } catch (e) {
      console.error('获取房源列表失败', e);
    }
  }, [keyword]);

  const fetchLandlords = async () => {
    try {
      const res = await landlordApi.list();
      setLandlords((res as any)?.data?.data ?? (res as any)?.data ?? []);
    } catch (e) {
      console.error('获取房东列表失败', e);
    }
  };

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleOpenDialog = (row?: any) => {
    fetchLandlords();
    if (row) {
      setEditData(row);
    } else {
      setEditData({ name: '', address: '', landlordName: '', notes: '' });
    }
    setOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editData.id) {
        await propertyApi.update(editData.id, editData);
      } else {
        await propertyApi.create(editData);
      }
      setOpen(false);
      setEditData({ name: '', address: '', landlordName: '', notes: '' });
      fetchList();
    } catch (e) {
      console.error('保存房源失败', e);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await propertyApi.remove(deleteTarget.id);
      setDeleteOpen(false);
      setDeleteTarget(null);
      fetchList();
    } catch (e) {
      console.error('删除房源失败', e);
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
                    {role === 0 && (
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
          <TextField fullWidth label="房源名称" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} sx={{ mt: 1, mb: 2 }} />
          <TextField fullWidth label="地址" value={editData.address || ''} onChange={(e) => setEditData({ ...editData, address: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth select label="所属房东" value={editData.landlordName || ''} onChange={(e) => setEditData({ ...editData, landlordName: e.target.value })} sx={{ mb: 2 }}>
            {landlords.map((l: any) => (
              <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>
            ))}
          </TextField>
          <TextField fullWidth label="备注" value={editData.notes || ''} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} multiline rows={2} />
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
    </Box>
  );
}
