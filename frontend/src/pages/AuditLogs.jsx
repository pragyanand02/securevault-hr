import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';

const actionBadge = {
  AUTH_LOGIN_SUCCESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  AUTH_LOGIN_FAILED: 'bg-red-50 text-red-700 border-red-200',
  AUTH_LOGIN_BLOCKED: 'bg-red-50 text-red-700 border-red-200',
  AUTH_LOGOUT: 'bg-slate-100 text-slate-700 border-slate-200',
  ACCOUNT_REGISTERED: 'bg-blue-50 text-blue-700 border-blue-200',
  PASSWORD_CHANGED: 'bg-amber-50 text-amber-700 border-amber-200',
  EMPLOYEE_CREATED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EMPLOYEE_UPDATED: 'bg-blue-50 text-blue-700 border-blue-200',
  EMPLOYEE_SOFT_DELETED: 'bg-red-50 text-red-700 border-red-200',
  EMPLOYEE_RESTORED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SENSITIVE_FIELDS_DECRYPTED: 'bg-red-50 text-red-700 border-red-200',
  EMPLOYEE_DIRECTORY_VIEWED: 'bg-slate-100 text-slate-700 border-slate-200',
  LEAVE_APPLIED: 'bg-amber-50 text-amber-700 border-amber-200',
  LEAVE_APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  LEAVE_REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  LEAVE_CANCELLED: 'bg-slate-100 text-slate-700 border-slate-200',
  JIT_ACCESS_REQUESTED: 'bg-blue-50 text-blue-700 border-blue-200',
  JIT_ACCESS_APPROVED: 'bg-amber-50 text-amber-700 border-amber-200',
  JIT_ACCESS_DENIED: 'bg-slate-100 text-slate-700 border-slate-200',
  JIT_ACCESS_REVOKED: 'bg-slate-100 text-slate-700 border-slate-200',
  AUDIT_CHAIN_VERIFIED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  AUDIT_TRAIL_VIEWED: 'bg-slate-100 text-slate-700 border-slate-200',
};

const severityStyle = {
  info: 'bg-slate-100 text-slate-600 border-slate-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

const categories = ['ALL', 'AUTH', 'EMPLOYEE', 'LEAVE', 'ACCESS', 'SYSTEM'];
const severities = ['ALL', 'info', 'warning', 'critical'];

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [chain, setChain] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 50 });
  const [category, setCategory] = useState('ALL');
  const [severity, setSeverity] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [verification, setVerification] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingGrants, setPendingGrants] = useState([]);
  const [reviewingId, setReviewingId] = useState(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 50 };
      if (category !== 'ALL') params.category = category;
      if (severity !== 'ALL') params.severity = severity;
      if (search.trim()) params.search = search.trim();

      const res = await api.get('/audit-logs', { params });
      setLogs(res.data.data || []);
      setChain(res.data.chain || null);
      setPagination(res.data.pagination || { page: 1, pages: 1, total: 0, limit: 50 });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [category, severity, search, page]);

  const loadPendingGrants = useCallback(async () => {
    try {
      const res = await api.get('/access/requests');
      const pending = (res.data || []).filter((g) => g.status === 'pending');
      setPendingGrants(pending);
    } catch {
      setPendingGrants([]);
    }
  }, []);

  useEffect(() => {
    loadLogs();
    loadPendingGrants();
  }, [loadLogs, loadPendingGrants]);

  const handleReviewGrant = async (id, status) => {
    setReviewingId(id);
    setError('');
    setSuccess('');
    try {
      await api.put(`/access/requests/${id}/review`, {
        status,
        durationMinutes: 30, // 30 minutes temporary access
        reviewNote: status === 'approved' ? 'Approved for 30 mins' : 'Rejected',
      });
      setSuccess(`Access request ${status} successfully.`);
      await loadPendingGrants();
      await loadLogs();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to review access request');
    } finally {
      setReviewingId(null);
    }
  };

  const verifyChain = async () => {
    setVerifying(true);
    setError('');
    try {
      const res = await api.get('/audit-logs/verify');
      setVerification(res.data);
      if (!res.data.valid) {
        setError(`Chain verification FAILED at sequence ${res.data.brokenAtSequence}: ${res.data.reason}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const activeFilters = (category !== 'ALL' ? 1 : 0) + (severity !== 'ALL' ? 1 : 0) + (search.trim() ? 1 : 0);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Security Audit Trail</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
            Append-only, hash-chained record of all authentication, employee, leave, and access operations.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { loadLogs(); loadPendingGrants(); }}
            className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
          >
            &#x21bb; Refresh
          </button>
          <button
            onClick={verifyChain}
            disabled={verifying}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {verifying ? 'Verifying…' : 'Verify Integrity'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* Pending Temporary Access Requests for Admin */}
      {pendingGrants.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-sm font-bold text-amber-900">Pending Temporary Salary Access Requests (JIT)</h2>
          <p className="text-xs text-amber-700 mb-3">HR Managers requesting temporary access to view masked fields.</p>
          <div className="space-y-2">
            {pendingGrants.map((grant) => (
              <div key={grant._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-amber-200">
                <div className="text-xs">
                  <span className="font-semibold text-slate-800">{grant.grantee?.name} ({grant.grantee?.email})</span>
                  <span className="text-slate-500 ml-2">&bull; Reason: &ldquo;{grant.reason}&rdquo;</span>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={reviewingId === grant._id}
                    onClick={() => handleReviewGrant(grant._id, 'approved')}
                    className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve (30 Mins)
                  </button>
                  <button
                    disabled={reviewingId === grant._id}
                    onClick={() => handleReviewGrant(grant._id, 'denied')}
                    className="rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chain status banner */}
      <div className={`mb-6 rounded-xl border p-4 ${
        verification
          ? verification.valid
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-red-200 bg-red-50'
          : 'border-slate-200 bg-white'
      }`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className={`text-sm font-bold ${
              verification
                ? verification.valid ? 'text-emerald-700' : 'text-red-700'
                : 'text-slate-800'
            }`}>
              {verification
                ? verification.valid
                  ? 'Hash chain intact — no tampering detected'
                  : `Tampering detected at sequence ${verification.brokenAtSequence}`
                : 'Integrity not checked in this session'}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {verification
                ? verification.valid
                  ? `${verification.total} record(s) recomputed. Covers the current chain head.`
                  : verification.reason
                : 'Click "Verify Integrity" to recompute SHA-256 hashes and verify data immutability.'}
            </p>
          </div>
          {chain && (
            <div className="text-left sm:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Chain head · #{chain.sequence}
              </p>
              <p className="max-w-xs break-all font-mono text-[11px] text-slate-600">{chain.lastHash}</p>
              <p className="text-[11px] text-slate-400">{chain.totalRecords} record(s) total</p>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            type="text"
            placeholder="Search action, actor email, details or target id…"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 lg:max-w-md"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Category:</span>
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => { setCategory(item); setPage(1); }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  category === item ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {item === 'ALL' ? 'All' : item}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Severity:</span>
          {severities.map((item) => (
            <button
              key={item}
              onClick={() => { setSeverity(item); setPage(1); }}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition ${
                severity === item
                  ? 'border-slate-800 bg-slate-800 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item === 'ALL' ? 'All' : item}
            </button>
          ))}
          {activeFilters > 0 && (
            <button
              onClick={() => { setCategory('ALL'); setSeverity('ALL'); setSearch(''); setPage(1); }}
              className="ml-auto text-xs font-medium text-blue-600 hover:underline"
            >
              Clear {activeFilters} filter(s)
            </button>
          )}
        </div>
      </div>

      {/* Log table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">#</th>
                <th className="px-4 py-3 text-left font-semibold">Timestamp</th>
                <th className="px-4 py-3 text-left font-semibold">Actor</th>
                <th className="px-4 py-3 text-left font-semibold">Action</th>
                <th className="px-4 py-3 text-left font-semibold">Details</th>
                <th className="px-4 py-3 text-left font-semibold">Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log._id} className="transition hover:bg-slate-50/75">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{log.sequence}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{log.actorName || 'System'}</p>
                    <p className="text-xs font-normal text-slate-400">{log.actorEmail || '—'}</p>
                    <p className="text-[11px] capitalize text-slate-400">{log.actorRole?.replace('_', ' ')}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${actionBadge[log.action] || 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                      {log.action}
                    </span>
                    <span className={`mt-1 block w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${severityStyle[log.severity] || severityStyle.info}`}>
                      {log.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {log.details || '—'}
                    {log.ip && <span className="mt-0.5 block font-mono text-[10px] text-slate-400">IP {log.ip}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[10px] text-slate-400" title={log.hash}>
                      {log.hash?.slice(0, 12)}…
                    </span>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    {loading ? 'Loading audit records…' : 'No matching audit records found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Page {pagination.page} of {pagination.pages} · {pagination.total} record(s)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={pagination.page <= 1 || loading}
              className="rounded-md border border-slate-200 bg-white px-3 py-1 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))}
              disabled={pagination.page >= pagination.pages || loading}
              className="rounded-md border border-slate-200 bg-white px-3 py-1 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
