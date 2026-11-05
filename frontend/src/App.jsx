import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Leaves from './pages/Leaves';
import Profile from './pages/Profile';
import AuditLogs from './pages/AuditLogs';
import Privacy from './pages/Privacy';
import SecurityCenter from './pages/SecurityCenter';

const Layout = ({ children }) => (
  <>
    <Navbar />
    {children}
  </>
);

const AppRoutes = () => {
  const { user, booting } = useAuth();

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-sm text-slate-500">Starting SecureVault…</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />

      <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute allowedRoles={['admin', 'hr_manager']}><Layout><Employees /></Layout></ProtectedRoute>} />
      <Route path="/leaves" element={<ProtectedRoute><Layout><Leaves /></Layout></ProtectedRoute>} />
      <Route path="/privacy" element={<ProtectedRoute><Layout><Privacy /></Layout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />

      <Route path="/security" element={<ProtectedRoute allowedRoles={['admin']}><Layout><SecurityCenter /></Layout></ProtectedRoute>} />
      <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={['admin']}><Layout><AuditLogs /></Layout></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
