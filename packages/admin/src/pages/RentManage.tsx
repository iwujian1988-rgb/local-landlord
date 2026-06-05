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
  Tabs,
  Tab,
  Alert,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Send as SendIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

// Mock data for bills
const mockBills = [
  {
    id: '1',
    period: '2026-06',
    roomName: '301室',
    propertyName: '幸福小区 2号楼',
    tenantName: '张三',
    rent: 350000,
    water: 50000,
    electric: 30000,
    internet: 10000,
    total: 440000,
    status: 0, // 0=待缴 1=已缴 2=逾期
    sentAt: '2026-06-01 09:00',
    paidAt: '',
  },
  {
    id: '2',
    period: '2026-06',
    roomName: '102室',
    propertyName: '阳光花园 A栋',
    tenantName: '李四',
    rent: 280000,
    water: 0,
    electric: 0,
    internet: 0,
    total: 280000,
    status: 1,
    sentAt: '2026-06-01 09:00',
    paidAt: '2026-06-03 14:30',
  },
  {
    id: '3',
    period: '2026-05',
    roomName: '501室',
    propertyName: '幸福小区 2号楼',
    tenantName: '王五',
    rent: 420000,
    water: 60000,
    electric: 45000,
    internet: 10000,
    total: 535000,
    status: 2,
    sentAt: '2026-05-01 09:00',
    paidAt: '',
  },
];

const statusLabels = ['待缴', '已缴', '逾期'];

export default function RentManage() {
  const [tab, setTab] = useState(0); // 0=账单管理 1=催缴管理
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | ''>('');
  const [confirmTarget, setConfirmTarget] = useState<any>(null);
  const [remindTarget, setRemindTarget] = useState<any>(null);

  const filtered = mockBills
    .filter(
      (b) =>
        b.roomName.includes(search) ||
        b.tenantName.includes(search) ||
        b.propertyName.includes(search) ||
        b.period.includes(search)
    )
    .filter((b) => (statusFilter === '' ? true : b.status === statusFilter));

  const formatAmount = (fen: number) => `¥${(fen / 100).toFixed(0)}`;

  const getStatusStyle = (status: number) => {
    if (status === 1) return { color: '#7BA37B', fontWeight: 'bold' } as const;
    if (status === 2) return { color: '#C97B7B', fontWeight: 'bold' } as const;
    return { color: '#E8B87D', fontWeight: 'bold' } as const;
  };

  const handleConfirm = (bill: any) => {
    setConfirmTarget(null);
    // Mock: update status to 1 (paid)
    const idx = mockBills.findIndex((b) => b.id === bill.id);
    if (idx >= 0) {
      mockBills[idx].status = 1;
      mockBills[idx].paidAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
    }
    // Force re-render
    setPage((p) => p);
  };

  const handleRemind = (bill: any) => {
    setRemindTarget(null);
    alert(`已向 ${bill.tenantName} 发送催缴提醒`);
  };

  return (
    <Box className="space-y-6">
      <Typography variant="h4" className="font-bold" style={{ color: '#4A4038' }}>
        收租管理
      </Typography>

      {/* Tabs */}
      <Card className="rounded-2xl shadow-card">
        <CardContent className="p-0">
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              '& .MuiTab-root': { fontSize: '17px', minHeight: '48px' },
              '& .Mui-selected': { color: '#F5D78E !important' },
              '& .MuiTabs-indicator': { backgroundColor: '#F5D78E' },
            }}
          >
            <Tab label="账单管理" />
            <Tab label="催缴管理" />
          </Tabs>
        </CardContent>
      </Card>

      {tab === 0 && (
        <>
          {/* Search + Filter */}
          <Card className="rounded-2xl shadow-card">
            <CardContent className="p-4">
              <Box className="flex flex-col sm:flex-row gap-4 items-center">
                <TextField
                  fullWidth
                  placeholder="搜索房间、租客、账期..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon fontSize="small" className="mr-2" />,
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
                />
                <Box className="flex gap-2">
                  {['', 0, 1, 2].map((s) => (
                    <Button
                      key={s}
                      variant={statusFilter === s ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setStatusFilter(s as number | '')}
                      className="rounded-full"
                      style={
                        statusFilter === s
                          ? { background: '#F5D78E', color: '#4A4038' }
                          : { borderColor: '#F5D78E', color: '#4A4038' }
                      }
                    >
                      {s === '' ? '全部' : statusLabels[s as number]}
                    </Button>
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Bills Table */}
          <Card className="rounded-2xl shadow-card">
            <CardContent className="p-0">
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell className="font-bold" style={{ color: '#4A4038' }}>账期</TableCell>
                      <TableCell className="font-bold" style={{ color: '#4A4038' }}>房间</TableCell>
                      <TableCell className="font-bold" style={{ color: '#4A4038' }}>租客</TableCell>
                      <TableCell className="font-bold text-right" style={{ color: '#4A4038' }}>房租</TableCell>
                      <TableCell className="font-bold text-right" style={{ color: '#4A4038' }}>水费</TableCell>
                      <TableCell className="font-bold text-right" style={{ color: '#4A4038' }}>电费</TableCell>
                      <TableCell className="font-bold text-right" style={{ color: '#4A4038' }}>合计</TableCell>
                      <TableCell className="font-bold text-center" style={{ color: '#4A4038' }}>状态</TableCell>
                      <TableCell className="font-bold" style={{ color: '#4A4038' }}>发送时间</TableCell>
                      <TableCell className="font-bold" style={{ color: '#4A4038' }}>收款时间</TableCell>
                      <TableCell className="font-bold text-center" style={{ color: '#4A4038' }}>操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((bill) => (
                        <TableRow key={bill.id} hover>
                          <TableCell style={{ fontSize: '17px' }}>{bill.period}</TableCell>
                          <TableCell style={{ fontSize: '17px' }}>{bill.roomName}</TableCell>
                          <TableCell style={{ fontSize: '17px' }}>{bill.tenantName}</TableCell>
                          <TableCell style={{ fontSize: '17px', textAlign: 'right' }}>{formatAmount(bill.rent)}</TableCell>
                          <TableCell style={{ fontSize: '17px', textAlign: 'right', color: '#8B7E74' }}>{bill.water > 0 ? formatAmount(bill.water) : '-'}</TableCell>
                          <TableCell style={{ fontSize: '17px', textAlign: 'right', color: '#8B7E74' }}>{bill.electric > 0 ? formatAmount(bill.electric) : '-'}</TableCell>
                          <TableCell style={{ fontSize: '17px', textAlign: 'right', fontWeight: 'bold' }}>{formatAmount(bill.total)}</TableCell>
                          <TableCell style={{ ...getStatusStyle(bill.status), fontSize: '17px', textAlign: 'center' }}>
                            {statusLabels[bill.status]}
                          </TableCell>
                          <TableCell style={{ fontSize: '15px', color: '#8B7E74' }}>{bill.sentAt}</TableCell>
                          <TableCell style={{ fontSize: '15px', color: bill.paidAt ? '#7BA37B' : '#8B7E74' }}>{bill.paidAt || '-'}</TableCell>
                          <TableCell className="text-center">
                            {bill.status !== 1 && (
                              <IconButton size="small" onClick={() => setConfirmTarget(bill)} style={{ color: '#7BA37B' }}>
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            )}
                            {bill.status !== 1 && (
                              <IconButton size="small" onClick={() => setRemindTarget(bill)} style={{ color: '#F5D78E' }}>
                                <SendIcon fontSize="small" />
                              </IconButton>
                            )}
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
        </>
      )}

      {tab === 1 && (
        <>
          <Alert severity="info" className="rounded-xl mb-4">
            逾期账单共 {mockBills.filter((b) => b.status === 2).length} 笔，已发送提醒功能待对接云函数。
          </Alert>
          <Card className="rounded-2xl shadow-card">
            <CardContent className="p-0">
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell className="font-bold" style={{ color: '#4A4038' }}>租客</TableCell>
                      <TableCell className="font-bold" style={{ color: '#4A4038' }}>房间</TableCell>
                      <TableCell className="font-bold text-right" style={{ color: '#4A4038' }}>逾期金额</TableCell>
                      <TableCell className="font-bold" style={{ color: '#4A4038' }}>账期</TableCell>
                      <TableCell className="font-bold" style={{ color: '#4A4038' }}>逾期天数</TableCell>
                      <TableCell className="font-bold text-center" style={{ color: '#4A4038' }}>操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mockBills
                      .filter((b) => b.status === 2)
                      .map((bill) => {
                        const daysOverdue = 15; // Mock
                        return (
                          <TableRow key={bill.id} hover>
                            <TableCell style={{ fontSize: '17px' }}>{bill.tenantName}</TableCell>
                            <TableCell style={{ fontSize: '17px' }}>{bill.roomName}</TableCell>
                            <TableCell style={{ fontSize: '17px', textAlign: 'right', fontWeight: 'bold', color: '#C97B7B' }}>{formatAmount(bill.total)}</TableCell>
                            <TableCell style={{ fontSize: '17px' }}>{bill.period}</TableCell>
                            <TableCell style={{ fontSize: '17px', color: '#C97B7B', fontWeight: 'bold' }}>{daysOverdue}天</TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<SendIcon />}
                                onClick={() => setRemindTarget(bill)}
                                className="rounded-full"
                                style={{ borderColor: '#F5D78E', color: '#4A4038' }}
                              >
                                发送提醒
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* Confirm Dialog */}
      <Dialog open={!!confirmTarget} onClose={() => setConfirmTarget(null)} maxWidth="xs">
        <DialogTitle className="font-bold" style={{ color: '#7BA37B' }}>
          确认收款
        </DialogTitle>
        <DialogContent>
          <Alert severity="success" className="rounded-xl">
            确认收到 {confirmTarget?.tenantName} 的账单 ¥{(confirmTarget && (confirmTarget.total / 100).toFixed(0)) || ''}？
          </Alert>
        </DialogContent>
        <DialogActions className="p-4">
          <Button onClick={() => setConfirmTarget(null)} className="rounded-full">
            取消
          </Button>
          <Button
            variant="contained"
            onClick={() => handleConfirm(confirmTarget)}
            className="rounded-full font-bold"
            style={{ background: '#7BA37B', color: '#fff' }}
          >
            确认收款
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remind Dialog */}
      <Dialog open={!!remindTarget} onClose={() => setRemindTarget(null)} maxWidth="xs">
        <DialogTitle className="font-bold" style={{ color: '#F5D78E' }}>
          发送催缴提醒
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" className="rounded-xl">
            将向 {remindTarget?.tenantName} 发送微信订阅消息提醒缴费，确认发送？
          </Alert>
        </DialogContent>
        <DialogActions className="p-4">
          <Button onClick={() => setRemindTarget(null)} className="rounded-full">
            取消
          </Button>
          <Button
            variant="contained"
            onClick={() => handleRemind(remindTarget)}
            className="rounded-full font-bold"
            style={{ background: '#F5D78E', color: '#4A4038' }}
          >
            发送提醒
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
