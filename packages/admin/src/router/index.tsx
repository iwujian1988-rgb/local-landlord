import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import PropertyList from '../pages/Property/PropertyList';
import RoomList from '../pages/Room/RoomList';
import LandlordList from '../pages/Landlord/LandlordList';
import TenantList from '../pages/Tenant/TenantList';
import BillManage from '../pages/Rent/BillManage';
import ContractList from '../pages/Contract/ContractList';
import Statistics from '../pages/Statistics';
import Settings from '../pages/Settings';
import { useAuthStore } from '../store/useAuthStore';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleGuard({ children, roles }: { children: React.ReactNode; roles: number[] }) {
  const role = useAuthStore((s) => s.role);
  if (!roles.includes(role as number)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="landlords/*" element={<RoleGuard roles={[0, 1]}><LandlordList /></RoleGuard>} />
          <Route path="properties" element={<PropertyList />} />
          <Route path="rooms" element={<RoomList />} />
          <Route path="tenants" element={<TenantList />} />
          <Route path="rent" element={<BillManage />} />
          <Route path="contracts" element={<ContractList />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="settings/*" element={<RoleGuard roles={[0]}><Settings /></RoleGuard>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
