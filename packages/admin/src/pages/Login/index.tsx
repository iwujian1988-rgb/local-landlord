import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, TextField, Button, Typography, Alert } from '@mui/material';
import { useAuthStore } from '../../store/useAuthStore';
import { login as apiLogin } from '../../services/auth';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const { token, admin } = await apiLogin(username, password);
      setAuth(token, admin);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('账号或密码错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
      <Card sx={{ width: 400, p: 5 }}>
        <Typography variant="h5" fontWeight={700} textAlign="center" mb={1}>
          五联人家
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center" mb={4}>
          管理后台登录
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField fullWidth label="用户名" value={username} onChange={(e) => setUsername(e.target.value)} sx={{ mb: 2 }} />
        <TextField fullWidth label="密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} sx={{ mb: 3 }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
        <Button fullWidth variant="contained" onClick={handleSubmit} disabled={loading}
          sx={{ py: 1.5, bgcolor: '#F5D78E', color: '#4A4038', fontWeight: 700, '&:hover': { bgcolor: '#EBCB6E' } }}>
          {loading ? '登录中...' : '登录'}
        </Button>
        <Typography variant="caption" color="text.secondary" textAlign="center" display="block" mt={2}>
          默认账号: admin / admin123
        </Typography>
      </Card>
    </Box>
  );
}
