import { useState } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

// Mock data for tenant list
const mockTenants = [
  {
    id: '1',
    name: '张三',
    phone: '13800138000',
    roomName: '301室',
    propertyName: '幸福小区 2号楼',
    moveInDate: '2025-09-01',
    contractEnd: '2026-08-31',
    rentDay: 5,
    deposit: 350000, // 3500元 (fen)
    status: 1, // 0=已退租 1=在租
  },
  {
    id: '2',
    name: '李四',
    phone: '13900139000',
    roomName: '102室',
    propertyName: '阳光花园 A栋',
    moveInDate: '2025-11-15',
    contractEnd: '2026-11-14',
    rentDay: 10,
    deposit: 280000,
    status: 1,
  },
  {
    id: '3',
    name: '王五',
    phone: '13700137000',
    roomName: '501室',
    propertyName: '幸福小区 2号楼',
    moveInDate: '2026-01-10',
    contractEnd: '2026-07-31',
    rentDay: 8,
    deposit: 420000,
    status: 1,
  },
  {
    id: '4',
    name: '赵六',
    phone: '13600136000',
    roomName: '202室',
    propertyName: '温馨公寓 3单元',
    moveInDate: '2025-06-20',
    contractEnd: '2026-06-19',
    rentDay: 15,
    deposit: 300000,
    status: 0, // 已退租
  },
];

export default function TenantList() {
  const [tenants, setTenants] = useState(mockTenants);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | ''>('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    roomName: '',
    propertyName: '',
    moveInDate: '',
    contractEnd: '',
    rentDay: '5',
    deposit: '',
    status: 1,
  });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const handleOpenAdd = () => {
    setEditing(null);
    setForm({
      name: '',
      phone: '',
      roomName: '',
      propertyName: '',
      moveInDate: '',
      contractEnd: '',
      rentDay: '5',
      deposit: '',
      status: 1,
    });
    setOpenDialog(true);
  };

  const handleOpenEdit = (tenant: any) => {
    setEditing(tenant);
    setForm({
      name: tenant.name,
      phone: tenant.phone,
      roomName: tenant.roomName,
      propertyName: tenant.propertyName,
      moveInDate: tenant.moveInDate,
      contractEnd: tenant.contractEnd,
      rentDay: tenant.rentDay.toString(),
      deposit: (tenant.deposit / 100).toString(),
      status: tenant.status,
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (editing) {
      setTenants((prev) =>
        prev.map((t) =>
          t.id === editing.id
            ? {
                ...t,
                name: form.name,
                phone: form.phone,
                moveInDate: form.moveInDate,
                contractEnd: form.contractEnd,
                rentDay: parseInt(form.rentDay),
                deposit: parseFloat(form.deposit) * 100,
                status: form.status,
              }
            : t
        )
      );
    } else {
      const newTenant = {
        id: Date.now().toString(),
        name: form.name,
        phone: form.phone,
        roomName: form.roomName,
        propertyName: form.propertyName,
        moveInDate: form.moveInDate,
        contractEnd: form.contractEnd,
        rentDay: parseInt(form.rentDay),
        deposit: parseFloat(form.deposit) * 100,
        status: form.status,
      };
      setTenants((prev) => [newTenant, ...prev]);
    }
    handleCloseDialog();
  };

  const handleDelete = (tenant: any) => {
    setTenants((prev) => prev.filter((t) => t.id !== tenant.id));
    setDeleteTarget(null);
  };

  const filtered = tenants
    .filter(
      (t) =>
        t.name.includes(search) ||
        t.phone.includes(search) ||
        t.roomName.includes(search) ||
        t.propertyName.includes(search)
    )
    .filter((t) => (statusFilter === '' ? true : t.status === statusFilter));

  const formatAmount = (fen: number) => `¥${(fen / 100).toFixed(0)}`;

  const getStatusStyle = (status: number) => {
    return status === 1
      ? { color: '#7BA37B', fontWeight: 'bold' } as const
      : { color: '#8B7E74' } as const;
  };

  return (
    <Box className="space-y-6">
      <Typography variant="h4" className="font-bold" style={{ color: '#4A4038' }}>
        租客管理
      </Typography>

      {/* Search + Filter + Add */}
      <Card className="rounded-2xl shadow-card">
        <CardContent className="p-4">
          <Box className="flex flex-col sm:flex-row gap-4 items-center">
            <TextField
              fullWidth
              placeholder="搜索租客姓名、电话、房间..."
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
                <MenuItem value={0}>已退租</MenuItem>
                <MenuItem value={1}>在租</MenuItem>
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
              新增租客
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
                  <TableCell className="font-bold" style={{ color: '#4A4038' }}>姓名</TableCell>
                  <TableCell className="font-bold" style={{ color: '#4A4038' }}>电话</TableCell>
                  <TableCell className="font-bold" style={{ color: '#4A4038' }}>所住房间</TableCell>
                  <TableCell className="font-bold" style={{ color: '#4A4038' }}>所属房源</TableCell>
                  <TableCell className="font-bold" style={{ color: '#4A4038' }}>入住时间</TableCell>
                  <TableCell className="font-bold" style={{ color: '#4A4038' }}>合同到期</TableCell>
                  <TableCell className="font-bold text-center" style={{ color: '#4A4038' }}>收租日</TableCell>
                  <TableCell className="font-bold text-right" style={{ color: '#4A4038' }}>押金</TableCell>
                  <TableCell className="font-bold text-center" style={{ color: '#4A4038' }}>状态</TableCell>
                  <TableCell className="font-bold text-center" style={{ color: '#4A4038' }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((tenant) => (
                    <TableRow key={tenant.id} hover>
                      <TableCell style={{ fontSize: '17px' }}>{tenant.name}</TableCell>
                      <TableCell style={{ fontSize: '17px', color: '#8B7E74' }}>{tenant.phone}</TableCell>
                      <TableCell style={{ fontSize: '17px' }}>{tenant.roomName}</TableCell>
                      <TableCell style={{ fontSize: '17px', color: '#8B7E74' }}>{tenant.propertyName}</TableCell>
                      <TableCell style={{ fontSize: '17px' }}>{tenant.moveInDate}</TableCell>
                      <TableCell
                        style={{
                          fontSize: '17px',
                          color: tenant.contractEnd < '2026-07-01' ? '#E8B87D' : '#4A4038',
                        }}
                      >
                        {tenant.contractEnd}
                      </TableCell>
                      <TableCell style={{ fontSize: '17px', textAlign: 'center' }}>每月{tenant.rentDay}日</TableCell>
                      <TableCell style={{ fontSize: '17px', textAlign: 'right', fontWeight: 'bold' }}>
                        {formatAmount(tenant.deposit)}
                      </TableCell>
                      <TableCell style={{ ...getStatusStyle(tenant.status), fontSize: '17px', textAlign: 'center' }}>
                        {tenant.status === 1 ? '在租' : '已退租'}
                      </TableCell>
                      <TableCell className="text-center">
                        <IconButton size="small" onClick={() => handleOpenEdit(tenant)} style={{ color: '#F5D78E' }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => setDeleteTarget(tenant)} style={{ color: '#C97B7B' }}>
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
          {editing ? '编辑租客' : '新增租客'}
        </DialogTitle>
        <DialogContent className="space-y-4 pt-4">
          <TextField
            fullWidth
            label="租客姓名 *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
          />
          <TextField
            fullWidth
            label="联系电话 *"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
          />
          <TextField
            fullWidth
            label="所属房源 *"
            value={form.propertyName}
            onChange={(e) => setForm({ ...form, propertyName: e.target.value })}
            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
          />
          <TextField
            fullWidth
            label="所住房间 *"
            value={form.roomName}
            onChange={(e) => setForm({ ...form, roomName: e.target.value })}
            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
          />
          <TextField
            fullWidth
            label="入住时间 *"
            type="date"
            value={form.moveInDate}
            onChange={(e) => setForm({ ...form, moveInDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
          />
          <TextField
            fullWidth
            label="合同到期 *"
            type="date"
            value={form.contractEnd}
            onChange={(e) => setForm({ ...form, contractEnd: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
          />
          <TextField
            fullWidth
            label="收租日（1-31）*"
            type="number"
            value={form.rentDay}
            onChange={(e) => setForm({ ...form, rentDay: e.target.value })}
            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
          />
          <TextField
            fullWidth
            label="押金（元）*"
            type="number"
            value={form.deposit}
            onChange={(e) => setForm({ ...form, deposit: e.target.value })}
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
            disabled={!form.name || !form.phone || !form.deposit}
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
            确定要删除租客「{deleteTarget?.name}」吗？此操作不可恢复。
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
