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

const MetricCard = ({ label, value, hint, tone = 'slate' }) => {
  const tones = {
    slate: 'text-slate-800',
    blue: 'text-blue-600',
    orange: 'text-orange-500',
    green: 'text-green-600',
    red: 'text-red-600',
    purple: 'text-purple-600',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-extrabold ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
};

const statusBadge = (status) => {
  if (status === 'approved') return 'bg-green-100 text-green-700';
  if (status === 'rejected') return 'bg-red-100 text-red-700';
  if (status === 'cancelled') return 'bg-slate-100 text-slate-500';
  return 'bg-orange-100 text-orange-700';
};

const Dashboard = () => {
  const { user, isAdmin, isReviewer } = useAuth();
  const [stats, setStats] = useState({});
  const [summary, setSummary] = useState(null);
  const [myLeavesList, setMyLeavesList] = useState([]);
  const [posture, setPosture] = useState(null);
  const [privacy, setPrivacy] = useState(null);
  const [activeGrant, setActiveGrant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        if (isReviewer) {
          const requests = [
            api.get('/employees', { params: { limit: 1 } }),
            api.get('/leaves'),
            api.get('/analytics/summary'),
          ];
          if (isAdmin) {
            requests.push(api.get('/audit-logs/stats'));
            requests.push(api.get('/privacy/stats'));
          } else {
            requests.push(api.get('/access/active'));
          }

          const [empRes, leaveRes, summaryRes, extra] = await Promise.all(requests);
          const leaves = leaveRes.data || [];
          setStats({
            employees: empRes.data.pagination?.total ?? empRes.data.data?.length ?? 0,
            pendingLeaves: leaves.filter((l) => l.status === 'pending').length,
            approvedLeaves: leaves.filter((l) => l.status === 'approved').length,
          });
          setSummary(summaryRes.data);

          if (isAdmin) {
            setPosture(extra.data);
            const privacyRes = await requests[4];
            setPrivacy(privacyRes.data);
          } else {
            setActiveGrant(extra.data?.grant || null);
          }
        } else {
          const [leaveRes, privacyRes] = await Promise.all([
            api.get('/leaves/me'),
            api.get('/privacy/me').catch(() => null),
          ]);
          const leaves = leaveRes.data || [];
          setMyLeavesList(leaves);
          setStats({
            totalLeaves: leaves.length,
            pendingLeaves: leaves.filter((l) => l.status === 'pending').length,
            approvedLeaves: leaves.filter((l) => l.status === 'approved').length,
            rejectedLeaves: leaves.filter((l) => l.status === 'rejected').length,
          });
          if (privacyRes) setPrivacy(privacyRes.data);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();
  }, [isAdmin, isReviewer, user.id]);

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
      backgroundColor: ['#f97316', '#16a34a', '#dc2626', '#64748b'],
    }],
  };

  const roleData = summary && {
    labels: summary.roleCounts.map((r) => r.label.replace('_', ' ').toUpperCase()),
    datasets: [{
      data: summary.roleCounts.map((r) => r.count),
      backgroundColor: ['#2563eb', '#7c3aed', '#0891b2'],
    }],
  };

  const chain = posture?.chain;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-900 to-blue-900 p-6 text-white shadow-md sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="mb-2 inline-block rounded-full bg-blue-500/30 px-2.5 py-0.5 text-xs font-medium tracking-wide text-blue-200">
            {isAdmin ? 'SYSTEM ADMINISTRATOR' : user.role === 'hr_manager' ? 'HR MANAGEMENT' : 'EMPLOYEE PORTAL'}
          </span>
          <h1 className="text-2xl font-bold sm:text-3xl">Welcome, {user.name}</h1>
          <p className="mt-1 text-sm text-slate-300">
            SecureVault HR &bull; DPDP-ready employee data trust layer
            {user.department && <> &bull; {user.department}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.role === 'employee' && (
            <>
              <Link to="/leaves" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-blue-700">
                + Apply for Leave
              </Link>
              <Link to="/privacy" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20">
                My Data
              </Link>
            </>
          )}
          {isReviewer && (
            <Link to="/employees" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20">
              View Employees
            </Link>
          )}
          {isAdmin && (
            <Link to="/security" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-600">
              Security Center
            </Link>
          )}
        </div>
      </div>

      {/* Metrics */}
      {isReviewer ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Employees in scope" value={loading ? '—' : stats.employees} hint={isAdmin ? 'Whole organisation' : `${summary?.scope || user.department} only`} tone="blue" />
          <MetricCard label="Pending leaves" value={stats.pendingLeaves ?? '—'} hint="Awaiting your review" tone="orange" />
          <MetricCard label="Approved leaves" value={stats.approvedLeaves ?? '—'} hint="Current records" tone="green" />
          {isAdmin ? (
            <MetricCard
              label="Sensitive reads (24h)"
              value={posture?.sensitiveAccessLast24h ?? 0}
              hint="Salary/bank decryptions, all logged"
              tone={(posture?.sensitiveAccessLast24h ?? 0) > 0 ? 'red' : 'green'}
            />
          ) : (
            <MetricCard
              label="Sensitive access"
              value={activeGrant ? 'Granted' : 'Masked'}
              hint={activeGrant ? `Expires ${new Date(activeGrant.expiresAt).toLocaleTimeString()}` : 'Request a time-bound grant'}
              tone={activeGrant ? 'orange' : 'slate'}
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="My leave requests" value={stats.totalLeaves ?? '—'} tone="blue" />
          <MetricCard label="Pending" value={stats.pendingLeaves ?? 0} tone="orange" />
          <MetricCard label="Approved" value={stats.approvedLeaves ?? 0} tone="green" />
          <MetricCard label="Rejected" value={stats.rejectedLeaves ?? 0} tone="red" />
        </div>
      )}

      {/* Trust posture (admin) */}
      {isAdmin && posture && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Trust posture</h2>
              <p className="mt-0.5 text-xs text-slate-500">Live evidence from the encryption, audit and privacy layers.</p>
            </div>
            <Link to="/security" className="text-xs font-semibold text-blue-600 hover:underline">
              Open Security Center &rarr;
            </Link>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Encryption</p>
              <p className="mt-1 text-sm font-bold text-slate-800">AES-256-GCM</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Authenticated, per-record IV</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Audit chain</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{chain?.totalRecords ?? 0} records</p>
              <p className="mt-0.5 break-all font-mono text-[10px] text-slate-500">head {chain?.lastHash?.slice(0, 16)}…</p>
            </div>
            <div className={`rounded-lg border p-3 ${(posture.failedLoginsLast24h ?? 0) > 0 ? 'border-red-100 bg-red-50/60' : 'border-slate-100 bg-slate-50/60'}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Failed logins (24h)</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{posture.failedLoginsLast24h ?? 0}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{posture.total ?? 0} total events</p>
            </div>
            <div className={`rounded-lg border p-3 ${(privacy?.overdueRequests ?? 0) > 0 ? 'border-red-100 bg-red-50/60' : 'border-slate-100 bg-slate-50/60'}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Open DSARs</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{privacy?.pendingRequests ?? 0}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{privacy?.overdueRequests ?? 0} overdue · {privacy?.consentCoveragePercent ?? 0}% consent coverage</p>
            </div>
          </div>
        </section>
      )}

      {/* Employee privacy summary */}
      {!isReviewer && privacy && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Your data rights at a glance</h2>
              <p className="mt-0.5 text-xs text-slate-500">What is stored, who accessed it, and how to exercise your rights.</p>
            </div>
            <Link to="/privacy" className="text-xs font-semibold text-blue-600 hover:underline">
              Open My Data &rarr;
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Encryption</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{privacy.encryption?.algorithm || 'AES-256-GCM'}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Audit events about you</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{privacy.audit?.totalEventsAboutMe ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active consents</p>
              <p className="mt-1 text-sm font-bold text-slate-800">
                {privacy.consents?.filter((c) => c.granted).length ?? 0} / {privacy.consents?.length ?? 0}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Charts */}
      {isReviewer && summary && (summary.departmentCounts?.length > 0 || summary.leaveStatusCounts?.length > 0) && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-800">Department distribution</h3>
            {deptData.labels.length > 0 ? (
              <div className="flex h-64 items-center justify-center">
                <Bar data={deptData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-slate-400">No department data</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-800">Leave requests by status</h3>
            {leaveData.labels.length > 0 ? (
              <div className="flex h-64 items-center justify-center">
                <Doughnut data={leaveData} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-slate-400">No leave data</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-800">Role breakdown</h3>
            {roleData.labels.length > 0 ? (
              <div className="flex h-64 items-center justify-center">
                <Pie data={roleData} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-slate-400">No role data</p>
            )}
          </div>
        </div>
      )}

      {/* Employee recent leaves */}
      {!isReviewer && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">My recent leave requests</h2>
            <Link to="/leaves" className="text-sm text-blue-600 hover:underline">
              View all &rarr;
            </Link>
          </div>

          {myLeavesList.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {myLeavesList.slice(0, 5).map((leave) => (
                <div key={leave._id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium capitalize text-slate-800">{leave.leaveType} · {leave.days} day(s)</p>
                    <p className="text-xs text-slate-500">
                      {new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusBadge(leave.status)}`}>
                    {leave.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-slate-400">
              No leave requests yet. Click “Apply for Leave” to submit one.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
