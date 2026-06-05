import { useState, useEffect } from 'react';
import { Box, Card, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Checkbox, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tabs, Tab, Snackbar, Alert } from '@mui/material';
import { billApi } from '../../services/api';
import type { Bill } from '@local-landlord/shared';
import { BillStatus } from '@local-landlord/shared';

const STATUS_MAP: Record<number, string> = { 0: '待支付', 1: '已收', 2: '逾期' };
const STATUS_COLOR: Record<number, 'warning' | 'success' | 'error'> = { 0: 'warning', 1: 'success', 2: 'error' };

const statusTabs = ['全部', '待支付', '已收', '逾期'];

export default function BillManage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [statusTab, setStatusTab] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDate, setConfirmDate] = useState(new Date().toISOString().slice(0, 10));
  const [confirmTargetId, setConfirmTargetId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'info' | 'warning' | 'error' } | null>(null);

  const fetchList = async () => {
    try {
      const result = await billApi.list();
      setBills(result.list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      setToast({ message: '获取账单列表失败：' + msg, severity: 'error' });
    }
  };

  useEffect(() => { fetchList(); }, []);

  const toggleSelect = (id: number) => {
    setSelected(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  const handleUrge = async (targetBills: Bill[]) => {
    try {
      const ids = targetBills.map((b) => b.id);
      await billApi.batchRemind(ids);
      setToast({ message: '催缴通知已发送', severity: 'success' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      setToast({ message: '催缴失败：' + msg, severity: 'error' });
    }
  };

  const handleExportOverdue = async () => {
    try {
      const result = await billApi.overdue();
      const overdueList = result.list;
      if (!overdueList || overdueList.length === 0) {
        setToast({ message: '暂无逾期账单', severity: 'info' });
        return;
      }
      // Generate CSV
      const headers = ['房间', '租客', '周期', '合计(元)', '状态', '发送时间'];
      const rows = overdueList.map((b: Bill) => {
        const ext = b as unknown as Record<string, unknown>;
        return [
          ext.room || ext.roomName || '',
          ext.tenant || ext.tenantName || '',
          b.period || '',
          b.totalAmount ?? 0,
          STATUS_MAP[b.status] ?? '未知',
          b.sentAt || '',
        ];
      });
      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `逾期账单_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setToast({ message: `已导出 ${overdueList.length} 条逾期账单`, severity: 'success' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      setToast({ message: '导出逾期账单失败：' + msg, severity: 'error' });
    }
  };

  const handleConfirmReceipt = async () => {
    try {
      if (confirmTargetId) {
        // Single confirmation
        await billApi.confirm(confirmTargetId, { paidAt: confirmDate });
      } else {
        // Batch confirmation
        await billApi.batchConfirm(selected, { paidAt: confirmDate });
      }
      setToast({ message: '收款确认成功', severity: 'success' });
      setConfirmOpen(false);
      setConfirmTargetId(null);
      setSelected([]);
      fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      setToast({ message: '确认收款失败：' + msg, severity: 'error' });
    }
  };

  const filtered = bills.filter((b) => {
    if (statusTab === 0) return true;
    if (statusTab === 1) return b.status === BillStatus.PENDING;
    if (statusTab === 2) return b.status === BillStatus.PAID;
    if (statusTab === 3) return b.status === BillStatus.OVERDUE;
    return true;
  });

  const overdueBills = bills.filter((b) => b.status === BillStatus.OVERDUE);

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
                  <TableCell>{String((row as unknown as Record<string, unknown>).room || (row as unknown as Record<string, unknown>).roomName || '-')}</TableCell>
                  <TableCell>{String((row as unknown as Record<string, unknown>).tenant || (row as unknown as Record<string, unknown>).tenantName || '-')}</TableCell>
                  <TableCell>{row.period || '-'}</TableCell>
                  <TableCell><Typography fontWeight={700}>{(row.totalAmount ?? 0).toLocaleString()} 元</Typography></TableCell>
                  <TableCell>
                    <Chip label={STATUS_MAP[row.status] ?? '未知'} size="small"
                      color={STATUS_COLOR[row.status] ?? 'default'} />
                  </TableCell>
                  <TableCell>{row.sentAt || '-'}</TableCell>
                  <TableCell>{row.paidAt || '-'}</TableCell>
                  <TableCell>
                    {row.status === BillStatus.PENDING && (
                      <Button size="small" onClick={() => { setConfirmTargetId(row.id); setConfirmOpen(true); }} sx={{ mr: 1 }}>确认收款</Button>
                    )}
                    {(row.status === BillStatus.PENDING || row.status === BillStatus.OVERDUE) && (
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
