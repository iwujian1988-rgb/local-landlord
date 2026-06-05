import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Hotel as HotelIcon,
} from '@mui/icons-material';
import { useAdminStore } from '../../store/adminStore';

// Mock data for room list
const mockRooms = [
  {
    id: '1',
    name: '301室',
    propertyName: '幸福小区 2号楼',
    rent: 350000, // 3500元 (fen)
    status: 1, // 0=空置 1=已租
    tenantName: '张三',
    rentDay: 5,
    contractEnd: '2026-12-31',
  },
  {
    id: '2',
    name: '302室',
    propertyName: '幸福小区 2号楼',
    rent: 320000,
    status: 1,
    tenantName: '李四',
    rentDay: 10,
    contractEnd: '2026-10-15',
  },
  {
    id: '3',
    name: '102室',
    propertyName: '阳光花园 A栋',
    rent: 280000,
    status: 0,
    tenantName: '-',
    rentDay: 1,
    contractEnd: '-',
  },
  {
    id: '4',
    name: '501室',
    propertyName: '幸福小区 2号楼',
    rent: 420000,
    status: 1,
    tenantName: '王五',
    rentDay: 8,
    contractEnd: '2026-08-20',
  },
];

const statusOptions = [
  { value: 0, label: '空置' },
  { value: 1, label: '已租' },
];

export default function RoomList() {
  const [rooms, setRooms] = useState(mockRooms);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | ''>('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', rent: '', status: 1, rentDay: '5' });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const handleOpenAdd = () => {
    setEditing(null);
    setForm({ name: '', rent: '', status: 1, rentDay: '5' });
    setOpenDialog(true);
  };

  const handleOpenEdit = (room: any) => {
    setEditing(room);
    setForm({
      name: room.name,
      rent: (room.rent / 100).toString(),
      status: room.status,
      rentDay: room.rentDay.toString(),
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditing(null);
    setForm({ name: '', rent: '', status: 1, rentDay: '5' });
  };

  const handleSave = () => {
    if (editing) {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === editing.id
            ? {
                ...r,
                name: form.name,
                rent: parseFloat(form.rent) * 100,
                status: form.status,
                rentDay: parseInt(form.rentDay),
              }
            : r
        )
      );
    } else {
      const newRoom = {
        id: Date.now().toString(),
        name: form.name,
        propertyName: '幸福小区 2号楼',
        rent: parseFloat(form.rent) * 100,
        status: form.status,
        tenantName: form.status === 0 ? '-' : '未分配',
        rentDay: parseInt(form.rentDay),
        contractEnd: form.status === 0 ? '-' : '2026-12-31',
      };
      setRooms((prev) => [newRoom, ...prev]);
    }
    handleCloseDialog();
  };

  const handleDelete = (room: any) => {
    setRooms((prev) => prev.filter((r) => r.id !== room.id));
    setDeleteTarget(null);
  };

  const filtered = rooms.filter(
    (r) =>
      r.name.includes(search) ||
      r.propertyName.includes(search) ||
      r.tenantName.includes(search)
  ).filter((r) => (statusFilter === '' ? true : r.status === statusFilter));

  const formatAmount = (fen: number) => `¥${(fen / 100).toFixed(0)}`;

  const getStatusStyle = (status: number) => {
    return status === 1
      ? { color: '#7BA37B', fontWeight: 'bold' as const }
      : { color: '#8B7E74' as const };
  };

  return (
    <Box className="space-y-6">
      <Typography variant="h4" className="font-bold" style={{ color: '#4A4038' }}>
        房间管理
      </Typography>

      {/* Search + Filter + Add */}
      <Card className="rounded-2xl shadow-card">
        <CardContent className="p-4">
          <Box className="flex flex-col sm:flex-row gap-4 items-center">
            <TextField
              fullWidth
              placeholder="搜索房间名称、房源、租客..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon fontSize="small" className="mr-2" />,
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>状态</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as number | '')}
                label="状态"
                sx={{ borderRadius: '16px' }}
              >
                <MenuItem value="">全部</MenuItem>
                <MenuItem value={0}>空置</MenuItem>
                <MenuItem value={1}>已租</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenAdd}
              className="rounded-full font-bold"
              style={{
                background: '#F5D78E',
                color: '#4A4038',
                boxShadow: '0 8px 32px rgba(245,215,142,0.4)',
                whiteSpace: 'nowrap',
              }}
            >
              新增房间
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="rounded-2xl shadow-card">
        <CardContent className="p-0">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell className="font-bold" style={{ color: '#4A4038' }}>房间名称</TableCell>
                  <TableCell className="font-bold" style={{ color: '#4A4038' }}>所属房源</TableCell>
                  <TableCell className="font-bold text-right" style={{ color: '#4A4038' }}>月租金</TableCell>
                  <TableCell className="font-bold text-center" style={{ color: '#4A4038' }}>状态</TableCell>
                  <TableCell className="font-bold" style={{ color: '#4A4038' }}>租客</TableCell>
                  <TableCell className="font-bold text-center" style={{ color: '#4A4038' }}>收租日</TableCell>
                  <TableCell className="font-bold" style={{ color: '#4A4038' }}>合同到期</TableCell>
                  <TableCell className="font-bold text-center" style={{ color: '#4A4038' }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((room) => (
                    <TableRow key={room.id} hover>
                      <TableCell style={{ fontSize: '17px' }}>{room.name}</TableCell>
                      <TableCell style={{ fontSize: '17px', color: '#8B7E74' }}>{room.propertyName}</TableCell>
                      <TableCell style={{ fontSize: '17px', textAlign: 'right', fontWeight: 'bold' }}>{formatAmount(room.rent)}</TableCell>
                      <TableCell style={{ ...getStatusStyle(room.status), fontSize: '17px', textAlign: 'center' }}>
                        {room.status === 1 ? '已租' : '空置'}
                      </TableCell>
                      <TableCell style={{ fontSize: '17px' }}>{room.tenantName}</TableCell>
                      <TableCell style={{ fontSize: '17px', textAlign: 'center' }}>每月{room.rentDay}日</TableCell>
                      <TableCell style={{ fontSize: '17px', color: room.contractEnd === '-' ? '#8B7E74' : '#4A4038' }}>{room.contractEnd}</TableCell>
                      <TableCell className="text-center">
                        <IconButton size="small" onClick={() => handleOpenEdit(room)} style={{ color: '#F5D78E' }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => setDeleteTarget(room)} style={{ color: '#C97B7B' }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filtered.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            labelRowsPerPage="每页行数："
            className="border-t"
            style={{ fontSize: '17px' }}
          />
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle className="font-bold" style={{ color: '#4A4038' }}>
          {editing ? '编辑房间' : '新增房间'}
        </DialogTitle>
        <DialogContent className="space-y-4 pt-4">
          <TextField
            fullWidth
            label="房间名称 *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
          />
          <TextField
            fullWidth
            label="月租金（元）*"
            type="number"
            value={form.rent}
            onChange={(e) => setForm({ ...form, rent: e.target.value })}
            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
          />
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>状态</InputLabel>
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as number })}
              label="状态"
              sx={{ borderRadius: '16px' }}
            >
              {statusOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="收租日（1-31）"
            type="number"
            value={form.rentDay}
            onChange={(e) => setForm({ ...form, rentDay: e.target.value })}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
          />
        </DialogContent>
        <DialogActions className="p-4">
          <Button onClick={handleCloseDialog} className="rounded-full">
            取消
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!form.name || !form.rent}
            className="rounded-full font-bold"
            style={{ background: '#F5D78E', color: '#4A4038' }}
          >
            {editing ? '保存' : '新增'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle className="font-bold" style={{ color: '#C97B7B' }}>
          确认删除
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" className="rounded-xl">
            确定要删除房间「{deleteTarget?.name}」吗？此操作不可恢复。
          </Alert>
        </DialogContent>
        <DialogActions className="p-4">
          <Button onClick={() => setDeleteTarget(null)} className="rounded-full">
            取消
          </Button>
          <Button
            variant="contained"
            onClick={() => handleDelete(deleteTarget)}
            className="rounded-full font-bold"
            style={{ background: '#C97B7B', color: '#fff' }}
          >
            确认删除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
