import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const roleLabel = {
  admin: 'Admin',
  hr_manager: 'HR Manager',
  employee: 'Employee',
};

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-bold text-lg">SecureVault HR</span>
        <Link to="/dashboard" className="text-sm hover:text-blue-300">Dashboard</Link>
        {(user.role === 'admin' || user.role === 'hr_manager') && (
          <Link to="/employees" className="text-sm hover:text-blue-300">Employees</Link>
        )}
        <Link to="/leaves" className="text-sm hover:text-blue-300">Leaves</Link>
        {user.role === 'admin' && (
          <Link to="/audit-logs" className="text-sm hover:text-blue-300">Audit Log</Link>
        )}
        <Link to="/profile" className="text-sm hover:text-blue-300">My Profile</Link>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-300">
          {user.name} <span className="bg-blue-600 text-xs px-2 py-0.5 rounded ml-1">{roleLabel[user.role]}</span>
        </span>
        <button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-sm px-3 py-1.5 rounded"
        >
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
