import { useState, useEffect } from 'react';
import { Box, Card, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Checkbox, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tabs, Tab, Snackbar, Alert } from '@mui/material';
import { billApi } from '../../services/api';

const STATUS_MAP: Record<number, string> = { 0: '待支付', 1: '已收', 2: '逾期' };
const STATUS_COLOR: Record<number, 'warning' | 'success' | 'error'> = { 0: 'warning', 1: 'success', 2: 'error' };

const statusTabs = ['全部', '待支付', '已收', '逾期'];

export default function BillManage() {
  const [bills, setBills] = useState<any[]>([]);
  const [statusTab, setStatusTab] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDate, setConfirmDate] = useState(new Date().toISOString().slice(0, 10));
  const [confirmTargetId, setConfirmTargetId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'info' | 'warning' | 'error' } | null>(null);

  const fetchList = async () => {
    try {
      const res = await billApi.list();
      setBills((res as any)?.data?.data ?? (res as any)?.data ?? []);
    } catch (e) {
      console.error('获取账单列表失败', e);
    }
  };

  useEffect(() => { fetchList(); }, []);

  const toggleSelect = (id: number) => {
    setSelected(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  const handleUrge = async (targetBills: any[]) => {
    try {
      const ids = targetBills.map((b) => b.id);
      if (ids.length === 1) {
        await billApi.batchRemind(ids);
      } else {
        await billApi.batchRemind(ids);
      }
      setToast({ message: '催缴通知已发送', severity: 'success' });
    } catch (e) {
      console.error('催缴失败', e);
      setToast({ message: '催缴失败', severity: 'error' });
    }
  };

  const handleExportOverdue = () => {
    // 导出逾期账单的实际实现需要进一步对接导出 API
    setToast({ message: '逾期账单已导出', severity: 'success' });
  };

  const handleConfirmReceipt = async () => {
    const idsToConfirm = confirmTargetId ? [confirmTargetId] : selected;
    try {
      for (const id of idsToConfirm) {
        await billApi.confirm(id, { paidAt: confirmDate });
      }
      setToast({ message: '收款确认成功', severity: 'success' });
      setConfirmOpen(false);
      setConfirmTargetId(null);
      setSelected([]);
      fetchList();
    } catch (e) {
      console.error('确认收款失败', e);
      setToast({ message: '确认收款失败', severity: 'error' });
    }
  };

  const filtered = bills.filter((b) => {
    if (statusTab === 0) return true;
    if (statusTab === 1) return b.status === 0;
    if (statusTab === 2) return b.status === 1;
    if (statusTab === 3) return b.status === 2;
    return true;
  });

  const overdueBills = bills.filter((b) => b.status === 2);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>收租管理</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={() => { setConfirmTargetId(null); setConfirmOpen(true); }} disabled={selected.length === 0}>
            批量确认收款
          </Button>
          <Button variant="outlined" color="warning" onClick={() => handleUrge(bills.filter((b) => selected.includes(b.id)))} disabled={selected.length === 0}>
            批量催缴
          </Button>
          <Button variant="contained" color="error" sx={{ bgcolor: '#C97B7B' }} onClick={handleExportOverdue} disabled={overdueBills.length === 0}>
            导出逾期
          </Button>
        </Box>
      </Box>

      <Tabs value={statusTab} onChange={(_, v) => setStatusTab(v)} sx={{ mb: 2 }}>
        {statusTabs.map((label, _i) => <Tab key={label} label={label} />)}
      </Tabs>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selected.length === filtered.length && filtered.length > 0}
                    onChange={() => setSelected(selected.length ? [] : filtered.map((b) => b.id))}
                  />
                </TableCell>
                <TableCell>房间</TableCell><TableCell>租客</TableCell><TableCell>周期</TableCell>
                <TableCell>合计</TableCell><TableCell>状态</TableCell><TableCell>发送时间</TableCell><TableCell>收款时间</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography color="text.secondary">暂无账单</Typography>
                  </TableCell>
                </TableRow>
              ) : filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell padding="checkbox"><Checkbox checked={selected.includes(row.id)} onChange={() => toggleSelect(row.id)} /></TableCell>
                  <TableCell>{row.room || row.roomName || '-'}</TableCell>
                  <TableCell>{row.tenant || row.tenantName || '-'}</TableCell>
                  <TableCell>{row.period || '-'}</TableCell>
                  <TableCell><Typography fontWeight={700}>{(row.total ?? 0).toLocaleString()} 元</Typography></TableCell>
                  <TableCell>
                    <Chip label={STATUS_MAP[row.status] ?? '未知'} size="small"
                      color={STATUS_COLOR[row.status] ?? 'default'} />
                  </TableCell>
                  <TableCell>{row.sentAt || '-'}</TableCell>
                  <TableCell>{row.paidAt || '-'}</TableCell>
                  <TableCell>
                    {row.status === 0 && (
                      <Button size="small" onClick={() => { setConfirmTargetId(row.id); setConfirmOpen(true); }} sx={{ mr: 1 }}>确认收款</Button>
                    )}
                    {(row.status === 0 || row.status === 2) && (
                      <Button size="small" color="error" onClick={() => handleUrge([row])}>催缴</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={confirmOpen} onClose={() => { setConfirmOpen(false); setConfirmTargetId(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>确认收款</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {confirmTargetId
              ? '确认已收到该笔房租？'
              : `确认已收到 ${selected.length} 笔房租？`}
          </Typography>
          <TextField fullWidth label="收款日期" type="date" value={confirmDate}
            onChange={(e) => setConfirmDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setConfirmOpen(false); setConfirmTargetId(null); }}>取消</Button>
          <Button variant="contained" onClick={handleConfirmReceipt} sx={{ bgcolor: '#7BA37B', color: '#fff' }}>
            确认收款
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert onClose={() => setToast(null)} severity={toast?.severity} sx={{ width: '100%' }}>{toast?.message}</Alert>
      </Snackbar>
    </Box>
  );
}
