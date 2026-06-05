import { useState, useEffect } from 'react';
import { Box, Card, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, Tabs, Tab } from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { roomApi } from '../../services/api';

const STATUS_MAP: Record<number, string> = { 0: '空着', 1: '已租' };
const STATUS_COLOR: Record<number, 'default' | 'success' | 'error'> = { 0: 'default', 1: 'success' };

export default function RoomList() {
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [editData, setEditData] = useState<any>({});

  const fetchList = async (status?: number) => {
    try {
      const params: any = {};
      if (status !== undefined && status !== null) {
        params.status = status;
      }
      const res = await roomApi.list(params);
      setData((res as any)?.data?.data ?? (res as any)?.data ?? []);
    } catch (e) {
      console.error('获取房间列表失败', e);
    }
  };

  useEffect(() => {
    // tab 0=全部, 1=空着(status=0), 2=已出租(status=1)
    const status = tab === 0 ? undefined : tab === 1 ? 0 : 1;
    fetchList(status);
  }, [tab]);

  const handleSave = async () => {
    try {
      if (editData.id) {
        await roomApi.update(editData.id, editData);
      } else {
        await roomApi.create(editData);
      }
      setOpen(false);
      setEditData({});
      fetchList();
    } catch (e) {
      console.error('保存房间失败', e);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await roomApi.remove(id);
      fetchList();
    } catch (e) {
      console.error('删除房间失败', e);
    }
  };

  const toggleStatus = async (row: any) => {
    try {
      const newStatus = row.status === 1 ? 0 : 1;
      await roomApi.updateStatus(row.id, newStatus);
      fetchList();
    } catch (e) {
      console.error('切换状态失败', e);
    }
  };

  const filtered = data;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>房间管理</Typography>
        <Button variant="contained" startIcon={<Add />}
          onClick={() => { setEditData({}); setOpen(true); }}
          sx={{ bgcolor: '#F5D78E', color: '#4A4038', fontWeight: 600 }}>
          新增房间
        </Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="全部" /> <Tab label="空着" /> <Tab label="已出租" />
      </Tabs>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>房间名</TableCell><TableCell>所属房源</TableCell><TableCell>租金</TableCell>
                <TableCell>状态</TableCell><TableCell>租客</TableCell><TableCell>收租日</TableCell><TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary">暂无房间</Typography>
                  </TableCell>
                </TableRow>
              ) : filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell><Typography fontWeight={600}>{row.name}</Typography></TableCell>
                  <TableCell>{row.property || row.propertyName || '-'}</TableCell>
                  <TableCell>{(row.rent ?? 0).toLocaleString()} 元</TableCell>
                  <TableCell>
                    <Chip label={STATUS_MAP[row.status] ?? '未知'}
                      size="small"
                      color={STATUS_COLOR[row.status] ?? 'default'}
                      onClick={() => toggleStatus(row)}
                      sx={{ cursor: 'pointer' }} />
                  </TableCell>
                  <TableCell>{row.tenant || row.tenantName || '-'}</TableCell>
                  <TableCell>{row.rentDay > 0 ? `每月${row.rentDay}号` : '-'}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => { setEditData(row); setOpen(true); }}><Edit fontSize="small" /></IconButton>
                    <IconButton onClick={() => handleDelete(row.id)}><Delete fontSize="small" color="error" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editData.id ? '编辑房间' : '新增房间'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="房间名称" value={editData.name || ''} onChange={(e) => setEditData({ ...editData, name: e.target.value })} sx={{ mt: 1, mb: 2 }} />
          <TextField fullWidth label="租金" type="number" value={editData.rent || ''} onChange={(e) => setEditData({ ...editData, rent: Number(e.target.value) })} sx={{ mb: 2 }} />
          <TextField fullWidth label="面积" value={editData.area || ''} onChange={(e) => setEditData({ ...editData, area: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} sx={{ bgcolor: '#F5D78E', color: '#4A4038' }}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
