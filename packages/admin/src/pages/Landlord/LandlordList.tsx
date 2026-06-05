import { useState, useEffect } from 'react';
import { Box, Card, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, Switch, Snackbar, Alert } from '@mui/material';
import { Add, Edit } from '@mui/icons-material';
import { landlordApi } from '../../services/api';
import type { Landlord, UpdateLandlordDTO } from '@local-landlord/shared';

/** Extended Landlord with computed fields returned by the admin API */
interface LandlordRow extends Landlord {
  registerTime?: string;
  propertyCount?: number;
  roomCount?: number;
  rentedCount?: number;
}

interface LandlordFormData {
  name: string;
  phone: string;
  defaultPayeeName: string;
  paymentNote: string;
  avatar: string;
  maxProperties: number;
  status: number;
  id?: number;
}

const emptyForm: LandlordFormData = {
  name: '', phone: '', defaultPayeeName: '', paymentNote: '', avatar: '', maxProperties: 10, status: 1,
};

export default function LandlordList() {
  const [open, setOpen] = useState(false);
  const [editData, setEditData] = useState<LandlordFormData>(emptyForm);
  const [data, setData] = useState<LandlordRow[]>([]);
  const [keyword, setKeyword] = useState('');
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const fetchList = async () => {
    try {
      const result = await landlordApi.list(keyword ? { keyword } : undefined);
      setData(result.list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      setToast({ message: '获取房东列表失败：' + msg, severity: 'error' });
    }
  };

  useEffect(() => { fetchList(); }, [keyword]);

  const handleSave = async () => {
    try {
      if (editData.id) {
        const dto: UpdateLandlordDTO = {
          name: editData.name,
          phone: editData.phone,
          avatar: editData.avatar,
          defaultPayeeName: editData.defaultPayeeName,
          paymentNote: editData.paymentNote,
          maxProperties: editData.maxProperties,
          status: editData.status,
        };
        await landlordApi.update(editData.id, dto);
      } else {
        await landlordApi.create(editData);
      }
      setOpen(false);
      setEditData(emptyForm);
      fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      setToast({ message: '保存房东失败：' + msg, severity: 'error' });
    }
  };

  const toggleStatus = async (row: LandlordRow) => {
    try {
      const newStatus = row.status === 1 ? 0 : 1;
      await landlordApi.updateStatus(row.id, newStatus);
      fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      setToast({ message: '切换状态失败：' + msg, severity: 'error' });
    }
  };

  const openEditDialog = (row?: LandlordRow) => {
    if (row) {
      setEditData({
        id: row.id,
        name: row.name,
        phone: row.phone,
        defaultPayeeName: row.defaultPayeeName || '',
        paymentNote: row.paymentNote || '',
        avatar: row.avatar || '',
        maxProperties: row.maxProperties,
        status: row.status as number,
      });
    } else {
      setEditData(emptyForm);
    }
    setOpen(true);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>房东管理</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            placeholder="搜索姓名或手机号"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            sx={{ width: 200 }}
          />
          <Button variant="contained" startIcon={<Add />}
            onClick={() => openEditDialog()}
            sx={{ bgcolor: '#F5D78E', color: '#4A4038', fontWeight: 600 }}>
            新增房东
          </Button>
        </Box>
      </Box>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>姓名</TableCell>
                <TableCell>电话</TableCell>
                <TableCell>注册时间</TableCell>
                <TableCell>房源数</TableCell>
                <TableCell>房间数</TableCell>
                <TableCell>在租数</TableCell>
                <TableCell>房源/上限</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell><Typography fontWeight={600}>{row.name}</Typography></TableCell>
                  <TableCell>{row.phone}</TableCell>
                  <TableCell>{row.registerTime || row.createdAt || '-'}</TableCell>
                  <TableCell>{row.propertyCount ?? 0}</TableCell>
                  <TableCell>{row.roomCount ?? 0}</TableCell>
                  <TableCell><Chip label={row.rentedCount ?? 0} size="small" color="success" /></TableCell>
                  <TableCell>{row.propertyCount ?? 0}/{row.maxProperties ?? 10}</TableCell>
                  <TableCell>
                    <Chip
                      label={row.status === 1 ? '启用' : '禁用'}
                      size="small"
                      color={row.status === 1 ? 'success' : 'default'}
                      onClick={() => toggleStatus(row)}
                      sx={{ cursor: 'pointer' }}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton onClick={() => openEditDialog(row)}><Edit fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editData.id ? '编辑房东' : '新增房东'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="姓名" value={editData.name || ''} onChange={(e) => setEditData({ ...editData, name: e.target.value })} sx={{ mt: 1, mb: 2 }} />
          <TextField fullWidth label="电话" value={editData.phone || ''} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="默认收款人" value={editData.defaultPayeeName || ''} onChange={(e) => setEditData({ ...editData, defaultPayeeName: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="收款说明" value={editData.paymentNote || ''} onChange={(e) => setEditData({ ...editData, paymentNote: e.target.value })} multiline rows={2} />
          <TextField fullWidth label="头像URL" value={editData.avatar || ''} onChange={e => setEditData({...editData, avatar: e.target.value})} sx={{ mb: 2 }} />
          <TextField fullWidth label="最大房源数" type="number" value={editData.maxProperties ?? 10} onChange={e => setEditData({...editData, maxProperties: parseInt(e.target.value) || 0})} sx={{ mb: 2 }} helperText="0 表示不限制" />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography>启用状态</Typography>
            <Switch checked={editData.status !== 0} onChange={e => setEditData({...editData, status: e.target.checked ? 1 : 0})} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} sx={{ bgcolor: '#F5D78E', color: '#4A4038' }}>保存</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert onClose={() => setToast(null)} severity={toast?.severity} sx={{ width: '100%' }}>{toast?.message}</Alert>
      </Snackbar>
    </Box>
  );
}
