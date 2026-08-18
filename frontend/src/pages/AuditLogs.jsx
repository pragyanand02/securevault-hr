import { useEffect, useState } from 'react';
import api from '../api/axios';

const actionBadge = {
  CREATE_EMPLOYEE: 'bg-green-100 text-green-800 border-green-200',
  UPDATE_EMPLOYEE: 'bg-blue-100 text-blue-800 border-blue-200',
  DELETE_EMPLOYEE: 'bg-red-100 text-red-800 border-red-200',
  LEAVE_APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  LEAVE_REJECTED: 'bg-rose-100 text-rose-800 border-rose-200',
  UPDATE_PROFILE: 'bg-purple-100 text-purple-800 border-purple-200',
  APPLY_LEAVE: 'bg-amber-100 text-amber-800 border-amber-200',
  CANCEL_LEAVE: 'bg-slate-100 text-slate-800 border-slate-200',
};

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [filterAction, setFilterAction] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit-logs');
      setLogs(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesAction = filterAction === 'ALL' || log.action === filterAction;
    const matchesSearch =
      (log.user?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.user?.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.action || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAction && matchesSearch;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Security Audit Trail</h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Immutable trace of system-critical create, update, and delete actions for compliance &amp; accountability.
          </p>
        </div>
        <button
          onClick={loadLogs}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-lg font-medium transition border border-slate-300 self-start sm:self-auto"
        >
          &#x21bb; Refresh Logs
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-lg mb-4 border border-red-200">
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search by user, action, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 font-medium">Filter Action:</span>
          {['ALL', 'CREATE_EMPLOYEE', 'UPDATE_EMPLOYEE', 'DELETE_EMPLOYEE', 'LEAVE_APPROVED', 'LEAVE_REJECTED'].map((act) => (
            <button
              key={act}
              onClick={() => setFilterAction(act)}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition ${
                filterAction === act
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {act === 'ALL' ? 'All Actions' : act.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Timestamp</th>
              <th className="text-left px-4 py-3 font-semibold">Actor (User)</th>
              <th className="text-left px-4 py-3 font-semibold">Role</th>
              <th className="text-left px-4 py-3 font-semibold">Action Performed</th>
              <th className="text-left px-4 py-3 font-semibold">Action Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLogs.map((log) => (
              <tr key={log._id} className="hover:bg-slate-50/75 transition">
                <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-mono text-xs">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">
                  {log.user ? (
                    <div>
                      <p>{log.user.name}</p>
                      <p className="text-xs text-slate-400 font-normal">{log.user.email}</p>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">System / Deleted User</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded capitalize font-medium">
                    {log.user?.role?.replace('_', ' ') || '—'}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-semibold border ${actionBadge[log.action] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs font-mono">
                  {log.details || '—'}
                </td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  {loading ? 'Loading audit records...' : 'No matching audit records found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogs;

