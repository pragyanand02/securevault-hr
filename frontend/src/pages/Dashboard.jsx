import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const COLORS = ['#2563eb', '#16a34a', '#f97316', '#dc2626', '#7c3aed', '#0891b2', '#eab308'];

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [summary, setSummary] = useState(null);
  const [myLeavesList, setMyLeavesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const isReviewer = user.role === 'admin' || user.role === 'hr_manager';

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        if (isReviewer) {
          const [empRes, leaveRes, summaryRes] = await Promise.all([
            api.get('/employees'),
            api.get('/leaves'),
            api.get('/analytics/summary'),
          ]);
          setStats({
            employees: empRes.data.length,
            pendingLeaves: leaveRes.data.filter((l) => l.status === 'pending').length,
            approvedLeaves: leaveRes.data.filter((l) => l.status === 'approved').length,
          });
          setSummary(summaryRes.data);
        } else {
          const leaveRes = await api.get('/leaves/me');
          const leaves = leaveRes.data;
          setMyLeavesList(leaves);
          setStats({
            totalLeaves: leaves.length,
            pendingLeaves: leaves.filter((l) => l.status === 'pending').length,
            approvedLeaves: leaves.filter((l) => l.status === 'approved').length,
            rejectedLeaves: leaves.filter((l) => l.status === 'rejected').length,
          });
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();
  }, [user]);

  const deptData = summary && {
    labels: summary.departmentCounts.map((d) => d.label || 'Unassigned'),
    datasets: [{
      label: 'Employees',
      data: summary.departmentCounts.map((d) => d.count),
      backgroundColor: COLORS,
    }],
  };

  const leaveData = summary && {
    labels: summary.leaveStatusCounts.map((l) => l.label.toUpperCase()),
    datasets: [{
      data: summary.leaveStatusCounts.map((l) => l.count),
      backgroundColor: ['#f97316', '#16a34a', '#dc2626'],
    }],
  };

  const roleData = summary && {
    labels: summary.roleCounts.map((r) => r.label.replace('_', ' ').toUpperCase()),
    datasets: [{
      data: summary.roleCounts.map((r) => r.count),
      backgroundColor: ['#2563eb', '#7c3aed', '#0891b2'],
    }],
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white rounded-2xl p-6 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="inline-block bg-blue-500/30 text-blue-200 text-xs px-2.5 py-0.5 rounded-full mb-2 font-medium tracking-wide">
            {user.role === 'admin' ? 'SYSTEM ADMINISTRATOR' : user.role === 'hr_manager' ? 'HR MANAGEMENT' : 'EMPLOYEE PORTAL'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold">Welcome, {user.name}</h1>
          <p className="text-slate-300 text-sm mt-1">
            SecureVault HR &bull; Role-Based Access Control &amp; Field-Level Encryption
          </p>
        </div>
        <div className="flex gap-2">
          {user.role === 'employee' && (
            <Link
              to="/leaves"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition shadow"
            >
              + Apply for Leave
            </Link>
          )}
          {(user.role === 'admin' || user.role === 'hr_manager') && (
            <Link
              to="/employees"
              className="bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-xl transition border border-white/20"
            >
              View Employees
            </Link>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isReviewer ? (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Employees</p>
              <p className="text-3xl font-extrabold text-blue-600 mt-2">{stats.employees ?? '—'}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Leaves</p>
              <p className="text-3xl font-extrabold text-orange-500 mt-2">{stats.pendingLeaves ?? '—'}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved Leaves</p>
              <p className="text-3xl font-extrabold text-green-600 mt-2">{stats.approvedLeaves ?? '—'}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your Role</p>
              <p className="text-2xl font-bold text-slate-800 capitalize mt-2">{user.role.replace('_', ' ')}</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">My Leave Requests</p>
              <p className="text-3xl font-extrabold text-blue-600 mt-2">{stats.totalLeaves ?? '—'}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending</p>
              <p className="text-3xl font-extrabold text-orange-500 mt-2">{stats.pendingLeaves ?? 0}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved</p>
              <p className="text-3xl font-extrabold text-green-600 mt-2">{stats.approvedLeaves ?? 0}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rejected</p>
              <p className="text-3xl font-extrabold text-red-600 mt-2">{stats.rejectedLeaves ?? 0}</p>
            </div>
          </>
        )}
      </div>

      {/* Admin & HR Analytics Charts */}
      {isReviewer && summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Department Distribution</h3>
            {deptData.labels.length > 0 ? (
              <div className="h-64 flex items-center justify-center">
                <Bar data={deptData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
              </div>
            ) : (
              <p className="text-slate-400 text-sm py-12 text-center">No department data</p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Leave Requests Status</h3>
            {leaveData.labels.length > 0 ? (
              <div className="h-64 flex items-center justify-center">
                <Doughnut data={leaveData} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            ) : (
              <p className="text-slate-400 text-sm py-12 text-center">No leave data</p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3">User Role Breakdown</h3>
            {roleData.labels.length > 0 ? (
              <div className="h-64 flex items-center justify-center">
                <Pie data={roleData} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            ) : (
              <p className="text-slate-400 text-sm py-12 text-center">No role data</p>
            )}
          </div>
        </div>
      )}

      {/* Employee Recent Leaves Activity */}
      {!isReviewer && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">My Recent Leave Requests</h2>
            <Link to="/leaves" className="text-sm text-blue-600 hover:underline">
              View All &rarr;
            </Link>
          </div>

          {myLeavesList.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {myLeavesList.slice(0, 5).map((leave) => (
                <div key={leave._id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{leave.reason}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                    leave.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : leave.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {leave.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm py-6 text-center">
              No leave requests applied yet. Click "Apply for Leave" to submit a new request.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;

