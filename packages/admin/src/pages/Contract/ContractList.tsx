import { useState, useEffect } from 'react';
import {
  Box, Card, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Chip, Tabs, Tab,
  Alert,
} from '@mui/material';
import { CloudUpload, Delete } from '@mui/icons-material';
import { contractApi } from '../../services/api';
import type { Document } from '@local-landlord/shared';

const docTypes = ['合同', '收据', '水电单', '维修', '押金'];

/** Document with extra display fields from the API */
interface ContractItem extends Omit<Document, 'type'> {
  type: number | string;
  roomName?: string;
  uploadTime?: string;
}

export default function ContractList() {
  const [tab, setTab] = useState('全部');
  const [data, setData] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadData, setUploadData] = useState({ roomId: '', name: '', imageUrl: '', note: '' });

  // delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await contractApi.list();
      setData(res.list || []);
    } catch {
      setError('加载文档列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const filtered = tab === '全部' ? data : data.filter((d) => d.type === tab);

  const handleUpload = async () => {
    if (!uploadData.roomId || !uploadData.name || !uploadData.imageUrl) return;
    try {
      // B12 fix: previously posted `{ type: 0, name, imageUrl }` — but the
      // admin upload DTO requires `roomId` and doesn't whitelist `type`,
      // so every upload from this dialog 400'd. The backend stamps type=1
      // (contract) on its side; frontend no longer sends it.
      await contractApi.upload({
        roomId: Number(uploadData.roomId),
        name: uploadData.name,
        imageUrl: uploadData.imageUrl,
        note: uploadData.note || undefined,
      });
      setUploadOpen(false);
      setUploadData({ roomId: '', name: '', imageUrl: '', note: '' });
      fetchList();
    } catch {
      setError('上传文档失败，请稍后重试');
    }
  };

  const handleDelete = async () => {
    if (deleteId == null) return;
    try {
      await contractApi.remove(deleteId);
      setDeleteOpen(false);
      setDeleteId(null);
      fetchList();
    } catch {
      setError('删除文档失败，请稍后重试');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>合同管理</Typography>
        <Button variant="contained" startIcon={<CloudUpload />}
          onClick={() => { setUploadData({ roomId: '', name: '', imageUrl: '', note: '' }); setUploadOpen(true); }}
          sx={{ bgcolor: '#F5D78E', color: '#4A4038', fontWeight: 600 }}>
          上传文档
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        {['全部', ...docTypes].map((t) => (
          <Tab key={t} label={t} value={t} />
        ))}
      </Tabs>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>文档名称</TableCell>
                <TableCell>所属房间</TableCell>
                <TableCell>类型</TableCell>
                <TableCell>上传时间</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary">加载中...</Typography>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary">暂无数据</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell><Typography fontWeight={600}>{row.name}</Typography></TableCell>
                    <TableCell>{row.roomName || '-'}</TableCell>
                    <TableCell><Chip label={row.type} size="small" /></TableCell>
                    <TableCell>{row.uploadTime || '-'}</TableCell>
                    <TableCell>
                      <IconButton onClick={() => { setDeleteId(row.id); setDeleteOpen(true); }}>
                        <Delete fontSize="small" color="error" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>上传文档</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="房间ID" type="number"
            value={uploadData.roomId}
            onChange={(e) => setUploadData({ ...uploadData, roomId: e.target.value })}
            sx={{ mt: 1, mb: 2 }} />
          <TextField fullWidth label="文档名称"
            value={uploadData.name}
            onChange={(e) => setUploadData({ ...uploadData, name: e.target.value })}
            sx={{ mb: 2 }} />
          <TextField fullWidth label="图片URL"
            value={uploadData.imageUrl}
            onChange={(e) => setUploadData({ ...uploadData, imageUrl: e.target.value })}
            sx={{ mb: 2 }} />
          <TextField fullWidth label="备注" multiline rows={2}
            value={uploadData.note}
            onChange={(e) => setUploadData({ ...uploadData, note: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleUpload}
            disabled={!uploadData.roomId || !uploadData.name || !uploadData.imageUrl}
            sx={{ bgcolor: '#F5D78E', color: '#4A4038' }}>
            上传
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>确定要删除此文档吗？此操作不可撤销。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>删除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
