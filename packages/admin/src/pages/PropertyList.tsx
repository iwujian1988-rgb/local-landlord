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

// Mock data for property list
const mockProperties = [
  {
    id: '1',
    name: '幸福小区 2号楼',
    address: '朝阳区幸福南路 88号',
    landlordName: '张三',
    roomCount: 12,
    rentedCount: 8,
    vacantCount: 4,
    monthlyRent: 4500000, // 45000元 (fen)
    createdAt: '2026-03-15',
  },
  {
    id: '2',
    name: '阳光花园 A栋',
    address: '海淀区阳光路 66号',
    landlordName: '李四',
    roomCount: 24,
    rentedCount: 20,
    vacantCount: 4,
    monthlyRent: 7200000,
    createdAt: '2026-04-20',
  },
  {
    id: '3',
    name: '温馨公寓 3单元',
    address: '丰台区温馨路 12号',
    landlordName: '王五',
    roomCount: 18,
    rentedCount: 15,
    vacantCount: 3,
    monthlyRent: 5400000,
    createdAt: '2026-05-10',
  },
];

export default function PropertyList() {
  const [properties, setProperties] = useState(mockProperties);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', address: '', monthlyRent: '' });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const handleOpenAdd = () => {
    setEditing(null);
    setForm({ name: '', address: '', monthlyRent: '' });
    setOpenDialog(true);
  };

  const handleOpenEdit = (property: any) => {
    setEditing(property);
    setForm({
      name: property.name,
      address: property.address,
      monthlyRent: (property.monthlyRent / 100).toString(),
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditing(null);
    setForm({ name: '', address: '', monthlyRent: '' });
  };

  const handleSave = () => {
    if (editing) {
      setProperties((prev) =>
        prev.map((p) =>
          p.id === editing.id
            ? {
                ...p,
                name: form.name,
                address: form.address,
                monthlyRent: parseFloat(form.monthlyRent) * 100,
              }
            : p
        )
      );
    } else {
      const newProperty = {
        id: Date.now().toString(),
        name: form.name,
        address: form.address,
        landlordName: '当前管理员',
        roomCount: 0,
        rentedCount: 0,
        vacantCount: 0,
        monthlyRent: parseFloat(form.monthlyRent) * 100,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setProperties((prev) => [newProperty, ...prev]);
    }
    handleCloseDialog();
  };

  const handleDelete = (property: any) => {
    setProperties((prev) => prev.filter((p) => p.id !== property.id));
    setDeleteTarget(null);
  };

  const filtered = properties.filter(
    (p) =>
      p.name.includes(search) ||
      p.address.includes(search) ||
      p.landlordName.includes(search)
  );

  return (
    <Box className="space-y-6">
      <Typography variant="h4" className="font-bold" style={{ color: '#4A4038' }}>
        房源管理
      </Typography>

      {/* Search + Add */}
      <Card className="rounded-2xl shadow-card">
        <CardContent className="p-4">
          <Box className="flex flex-col sm:flex-row gap-4 items-center">
            <TextField
              fullWidth
              placeholder="搜索房源名称、地址、房东..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon fontSize="small" className="mr-2" />,
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
            />
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
              新增房源
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
                  <TableCell className="font-bold" style={{ color: '#4A4038' }}>房源名称</TableCell>
                  <TableCell className="font-bold" style={{ color: '#4A4038' }}>地址</TableCell>
                  <TableCell className="font-bold" style={{ color: '#4A4038' }}>所属房东</TableCell>
                  <TableCell className="font-bold text-center" style={{ color: '#4A4038' }}>房间数</TableCell>
                  <TableCell className="font-bold text-center" style={{ color: '#4A4038' }}>已租</TableCell>
                  <TableCell className="font-bold text-center" style={{ color: '#4A4038' }}>空闲</TableCell>
                  <TableCell className="font-bold text-right" style={{ color: '#4A4038' }}>月租金</TableCell>
                  <TableCell className="font-bold" style={{ color: '#4A4038' }}>创建时间</TableCell>
                  <TableCell className="font-bold text-center" style={{ color: '#4A4038' }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((property) => (
                    <TableRow key={property.id} hover>
                      <TableCell style={{ fontSize: '17px' }}>{property.name}</TableCell>
                      <TableCell style={{ fontSize: '17px', color: '#8B7E74' }}>{property.address}</TableCell>
                      <TableCell style={{ fontSize: '17px' }}>{property.landlordName}</TableCell>
                      <TableCell className="text-center" style={{ fontSize: '17px' }}>{property.roomCount}</TableCell>
                      <TableCell className="text-center" style={{ fontSize: '17px', color: '#7BA37B' }}>{property.rentedCount}</TableCell>
                      <TableCell className="text-center" style={{ fontSize: '17px', color: '#E8B87D' }}>{property.vacantCount}</TableCell>
                      <TableCell className="text-right font-bold" style={{ fontSize: '17px', color: '#4A4038' }}>
                        ¥{(property.monthlyRent / 100).toFixed(0)}
                      </TableCell>
                      <TableCell style={{ fontSize: '17px', color: '#8B7E74' }}>{property.createdAt}</TableCell>
                      <TableCell className="text-center">
                        <IconButton size="small" onClick={() => handleOpenEdit(property)} style={{ color: '#F5D78E' }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => setDeleteTarget(property)} style={{ color: '#C97B7B' }}>
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
          {editing ? '编辑房源' : '新增房源'}
        </DialogTitle>
        <DialogContent className="space-y-4 pt-4">
          <TextField
            fullWidth
            label="房源名称 *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
          />
          <TextField
            fullWidth
            label="详细地址 *"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
          />
          <TextField
            fullWidth
            label="月租金（元）*"
            type="number"
            value={form.monthlyRent}
            onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })}
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
            disabled={!form.name || !form.address || !form.monthlyRent}
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
            确定要删除房源「{deleteTarget?.name}」吗？此操作不可恢复。
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
