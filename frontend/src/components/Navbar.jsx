import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const roleLabel = {
  admin: 'Admin',
  hr_manager: 'HR Manager',
  employee: 'Employee',
};

const Navbar = () => {
  const { user, logout, isAdmin, isReviewer } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  const linkClass = 'text-sm text-slate-200 hover:text-white transition';

  return (
    <nav className="bg-slate-900 text-white px-4 sm:px-6 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-sm">SV</span>
            <span className="font-bold text-base tracking-tight">SecureVault HR</span>
            <span className="hidden sm:inline-block rounded-full border border-blue-400/40 bg-blue-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-300">
              RBAC & Audit
            </span>
          </Link>

          <Link to="/dashboard" className={linkClass}>Dashboard</Link>
          {isReviewer && <Link to="/employees" className={linkClass}>Employees</Link>}
          <Link to="/leaves" className={linkClass}>Leaves</Link>
          {isAdmin && <Link to="/audit-logs" className={linkClass}>Audit Logs</Link>}
          <Link to="/profile" className={linkClass}>Profile</Link>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-300">
            {user.name}
            <span className="ml-2 rounded bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">
              {roleLabel[user.role]}
            </span>
            {user.department && (
              <span className="ml-1 text-[11px] text-slate-400">· {user.department}</span>
            )}
          </span>
          <button
            onClick={handleLogout}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
