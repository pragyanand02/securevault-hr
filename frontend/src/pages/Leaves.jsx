import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const emptyForm = { leaveType: 'casual', startDate: '', endDate: '', reason: '' };

const statusStyle = {
  pending: 'bg-orange-100 text-orange-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

const leaveTypeStyle = {
  casual: 'bg-blue-50 text-blue-700',
  sick: 'bg-rose-50 text-rose-700',
  earned: 'bg-emerald-50 text-emerald-700',
  unpaid: 'bg-slate-100 text-slate-600',
};

const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const countDays = (start, end) => {
  if (!start || !end) return 0;
  const diff = new Date(end) - new Date(start);
  if (Number.isNaN(diff) || diff < 0) return 0;
  return Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
};

const Leaves = () => {
  const { isReviewer } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState('');

  const loadLeaves = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(isReviewer ? '/leaves' : '/leaves/me');
      setLeaves(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load leaves');
    } finally {
      setLoading(false);
    }
  }, [isReviewer]);

  useEffect(() => { loadLeaves(); }, [loadLeaves]);

  const flash = (message) => {
    setSuccess(message);
    setError('');
    setTimeout(() => setSuccess(''), 5000);
  };

  const handleChange = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const handleApply = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await api.post('/leaves', form);
      flash('Leave request submitted. It is now visible to your department reviewer.');
      setForm(emptyForm);
      await loadLeaves();
    } catch (err) {
      const validation = err.response?.data?.errors?.[0]?.message;
      setError(validation || err.response?.data?.message || 'Could not apply for leave');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelLeave = async (leave) => {
    if (!window.confirm('Cancel this pending leave request?')) return;
    setBusyId(leave._id);
    try {
      await api.delete(`/leaves/${leave._id}`);
      flash('Leave request cancelled.');
      await loadLeaves();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not cancel the request');
    } finally {
      setBusyId('');
    }
  };

  const reviewLeave = async (leave, status) => {
    const reviewNote = window.prompt(
      `${status === 'approved' ? 'Approval' : 'Rejection'} note (optional)`,
      ''
    );
    if (reviewNote === null) return;
    setBusyId(leave._id);
    try {
      await api.put(`/leaves/${leave._id}/review`, { status, reviewNote });
      flash(`Leave ${status}.`);
      await loadLeaves();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not review the leave');
    } finally {
      setBusyId('');
    }
  };

  const previewDays = countDays(form.startDate, form.endDate);

  const filteredLeaves = useMemo(
    () => leaves.filter((leave) => filterStatus === 'ALL' || leave.status === filterStatus),
    [leaves, filterStatus]
  );

  const counts = useMemo(() => ({
    pending: leaves.filter((l) => l.status === 'pending').length,
    approved: leaves.filter((l) => l.status === 'approved').length,
    rejected: leaves.filter((l) => l.status === 'rejected').length,
  }), [leaves]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Leave Management</h1>
        <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
          {isReviewer
            ? 'Reviewers see only their own department and cannot approve their own request. Every decision is audit-logged.'
            : 'Apply for leave, track approval status, and cancel while a request is still pending.'}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">{success}</div>
      )}

      {!isReviewer && (
        <form onSubmit={handleApply} className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-slate-800">Apply for leave</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Leave type</label>
              <select
                name="leaveType"
                value={form.leaveType}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="casual">Casual</option>
                <option value="sick">Sick</option>
                <option value="earned">Earned</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Start date</label>
              <input
                type="date"
                name="startDate"
                value={form.startDate}
                onChange={handleChange}
                min={todayIso()}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">End date</label>
              <input
                type="date"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
                min={form.startDate || todayIso()}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end">
              <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Duration</p>
                <p className="text-sm font-bold text-slate-800">{previewDays || 0} day(s)</p>
              </div>
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Reason</label>
              <textarea
                name="reason"
                value={form.reason}
                onChange={handleChange}
                required
                rows={2}
                maxLength={500}
                placeholder="5-500 characters. Be specific enough for your reviewer to decide."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
            <p className="text-[11px] text-slate-400">
              Requests cannot start in the past, must be 1-30 days, and cannot overlap an active request.
            </p>
          </div>
        </form>
      )}

      {/* Summary + filter */}
      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {['ALL', 'pending', 'approved', 'rejected', 'cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                filterStatus === status ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status === 'ALL' ? 'All' : status}
            </button>
          ))}
        </div>
        {isReviewer && (
          <p className="text-xs text-slate-500">
            {counts.pending} pending · {counts.approved} approved · {counts.rejected} rejected
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                {isReviewer && <th className="px-4 py-3 text-left font-semibold">Employee</th>}
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-left font-semibold">Dates</th>
                <th className="px-4 py-3 text-left font-semibold">Days</th>
                <th className="px-4 py-3 text-left font-semibold">Reason</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeaves.map((leave) => (
                <tr key={leave._id} className="transition hover:bg-slate-50/75">
                  {isReviewer && (
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{leave.employee?.name || '—'}</p>
                      <p className="text-xs text-slate-400">{leave.employee?.department || '—'}</p>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${leaveTypeStyle[leave.leaveType] || leaveTypeStyle.casual}`}>
                      {leave.leaveType || 'casual'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                    {new Date(leave.startDate).toLocaleDateString()} → {new Date(leave.endDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700">{leave.days}</td>
                  <td className="max-w-xs px-4 py-3 text-xs text-slate-600">
                    {leave.reason}
                    {leave.reviewNote && (
                      <span className="mt-1 block italic text-[11px] text-slate-400">Reviewer: {leave.reviewNote}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle[leave.status] || statusStyle.pending}`}>
                      {leave.status}
                    </span>
                    {leave.reviewedBy?.name && (
                      <span className="mt-1 block text-[10px] text-slate-400">by {leave.reviewedBy.name}</span>
                    )}
                  </td>
                  <td className="space-x-2 whitespace-nowrap px-4 py-3">
                    {!isReviewer && leave.status === 'pending' && (
                      <button
                        onClick={() => cancelLeave(leave)}
                        disabled={busyId === leave._id}
                        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    )}
                    {isReviewer && leave.canReview && (
                      <>
                        <button
                          onClick={() => reviewLeave(leave, 'approved')}
                          disabled={busyId === leave._id}
                          className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => reviewLeave(leave, 'rejected')}
                          disabled={busyId === leave._id}
                          className="rounded border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {isReviewer && !leave.canReview && leave.status === 'pending' && (
                      <span className="text-[11px] text-slate-400">Outside your review scope</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredLeaves.length === 0 && (
                <tr>
                  <td colSpan={isReviewer ? 7 : 6} className="px-4 py-12 text-center text-slate-400">
                    {loading ? 'Loading leave records…' : 'No leave records match this filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-slate-400">
        {isReviewer
          ? 'Separation of duties: an HR manager cannot approve their own leave, and can only act on requests from their own department.'
          : 'Your leave history is part of your personal data. Export or review it any time from My Data.'}
      </p>
    </div>
  );
};

export default Leaves;
