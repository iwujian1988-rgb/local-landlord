import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, Switch } from '@mui/material';
import { Add, Edit, Visibility } from '@mui/icons-material';
import { landlordApi } from '../../services/api';

export default function LandlordList() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editData, setEditData] = useState<any>({ name: '', phone: '', defaultPayee: '', payeeNote: '', avatar: '', maxProperties: 10, status: 1 });
  const [data, setData] = useState<any[]>([]);

  const fetchList = async () => {
    try {
      const res = await landlordApi.list();
      setData((res as any)?.data?.data ?? (res as any)?.data ?? []);
    } catch (e) {
      console.error('获取房东列表失败', e);
    }
  };

  useEffect(() => { fetchList(); }, []);

  const handleSave = async () => {
    try {
      if (editData.id) {
        await landlordApi.update(editData.id, editData);
      } else {
        await landlordApi.create(editData);
      }
      setOpen(false);
      setEditData({ name: '', phone: '', defaultPayee: '', payeeNote: '', avatar: '', maxProperties: 10, status: 1 });
      fetchList();
    } catch (e) {
      console.error('保存房东失败', e);
    }
  };

  const toggleStatus = async (row: any) => {
    try {
      const newStatus = row.status === 1 ? 0 : 1;
      await landlordApi.updateStatus(row.id, newStatus);
      fetchList();
    } catch (e) {
      console.error('切换状态失败', e);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>房东管理</Typography>
        <Button variant="contained" startIcon={<Add />}
          onClick={() => { setEditData({ name: '', phone: '', defaultPayee: '', payeeNote: '', avatar: '', maxProperties: 10, status: 1 }); setOpen(true); }}
          sx={{ bgcolor: '#F5D78E', color: '#4A4038', fontWeight: 600 }}>
          新增房东
        </Button>
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
                    <IconButton onClick={() => navigate(`/landlords/${row.id}`)}><Visibility fontSize="small" /></IconButton>
                    <IconButton onClick={() => { setEditData(row); setOpen(true); }}><Edit fontSize="small" /></IconButton>
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
          <TextField fullWidth label="姓名" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} sx={{ mt: 1, mb: 2 }} />
          <TextField fullWidth label="电话" value={editData.phone || ''} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="默认收款人" value={editData.defaultPayee || ''} onChange={(e) => setEditData({ ...editData, defaultPayee: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="收款说明" value={editData.payeeNote || ''} onChange={(e) => setEditData({ ...editData, payeeNote: e.target.value })} multiline rows={2} />
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
    </Box>
  );
}
