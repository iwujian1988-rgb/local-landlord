import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Link,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAdminStore } from '../../store/adminStore';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAdminStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('请输入管理员账号');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    try {
      const success = await login(username, password);
      if (success) {
        navigate('/', { replace: true });
      } else {
        setError('账号或密码错误，请重试');
      }
    } catch {
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#FDF8F3' }}
    >
      <Card
        className="w-full max-w-md"
        style={{ borderRadius: '28px', boxShadow: '0 8px 32px rgba(74,64,56,0.12)' }}
      >
        <CardContent className="p-8">
          {/* Logo / Title */}
          <Box className="text-center mb-8">
            <Box
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: '#F5D78E' }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
                  stroke="#4A4038"
                  strokeWidth="1.8"
                  fill="none"
                />
              </svg>
            </Box>
            <Typography variant="h5" className="font-bold" style={{ color: '#4A4038' }}>
              本地房东
            </Typography>
            <Typography variant="body2" style={{ color: '#8B7E74' }}>
              管理后台登录
            </Typography>
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" className="mb-4 rounded-xl">
              {error}
            </Alert>
          )}

          {/* Form */}
          <Box component="form" onSubmit={handleSubmit} className="space-y-4">
            <TextField
              fullWidth
              label="管理员账号"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入账号"
              InputProps={{ style: { fontSize: '17px', borderRadius: '16px' } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
            />

            <TextField
              fullWidth
              label="密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              InputProps={{ style: { fontSize: '17px', borderRadius: '16px' } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              className="py-3 text-lg font-bold rounded-full"
              style={{
                background: '#F5D78E',
                color: '#4A4038',
                boxShadow: '0 8px 32px rgba(245,215,142,0.4)',
                fontSize: '17px',
              }}
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </Box>

          {/* Hint */}
          <Typography variant="caption" className="block text-center mt-4" style={{ color: '#B5A99A' }}>
            Mock 账号：<Link href="#" onClick={(e) => { e.preventDefault(); setUsername('admin'); }}>admin</Link>
            {' / '}
            <Link href="#" onClick={(e) => { e.preventDefault(); setUsername('operator'); }}>operator</Link>
            {'  （任意密码）'}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
