import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PropertyList from './pages/PropertyList';
import RoomList from './pages/RoomList';
import TenantList from './pages/TenantList';
import RentManage from './pages/RentManage';
import { useAdminStore } from './store/adminStore';

function App() {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={isAuthenticated ? <Layout /> : <Navigate to="/login" replace />}
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="properties" element={<PropertyList />} />
          <Route path="rooms" element={<RoomList />} />
          <Route path="tenants" element={<TenantList />} />
          <Route path="rent" element={<RentManage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
