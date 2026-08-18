import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const Leaves = () => {
  const { user } = useAuth();
  const isReviewer = user.role === 'admin' || user.role === 'hr_manager';
  const [leaves, setLeaves] = useState([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [form, setForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadLeaves = async () => {
    try {
      const res = await api.get(isReviewer ? '/leaves' : '/leaves/me');
      setLeaves(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load leaves');
    }
  };

  useEffect(() => {
    loadLeaves();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleApply = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (new Date(form.startDate) > new Date(form.endDate)) {
      return setError('Start date cannot be after end date');
    }

    setSubmitting(true);
    try {
      await api.post('/leaves', form);
      setForm({ startDate: '', endDate: '', reason: '' });
      setSuccess('Leave application submitted successfully!');
      loadLeaves();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to apply for leave');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this pending leave request?')) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/leaves/${id}`);
      setSuccess('Leave request cancelled successfully');
      loadLeaves();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel leave');
    }
  };

  const handleReview = async (id, status) => {
    setError('');
    setSuccess('');
    try {
      await api.put(`/leaves/${id}/review`, { status });
      setSuccess(`Leave request ${status} successfully`);
      loadLeaves();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed');
    }
  };

  const statusBadge = {
    pending: 'bg-orange-100 text-orange-800 border-orange-200',
    approved: 'bg-green-100 text-green-800 border-green-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
  };

  const filteredLeaves = leaves.filter((lv) => {
    if (filterStatus === 'ALL') return true;
    return lv.status === filterStatus;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Leave Management</h1>
          <p className="text-slate-500 text-xs mt-0.5">
            {isReviewer
              ? 'Review and manage employee leave applications.'
              : 'Submit and track your leave requests and review status.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-lg mb-4 border border-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-700 text-sm px-4 py-2.5 rounded-lg mb-4 border border-green-200">
          {success}
        </div>
      )}

      {!isReviewer && (
        <form onSubmit={handleApply} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3">Apply for New Leave</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label>
              <input
                type="date"
                name="startDate"
                value={form.startDate}
                onChange={handleChange}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label>
              <input
                type="date"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Reason</label>
              <input
                type="text"
                name="reason"
                placeholder="e.g. Medical, Vacation"
                value={form.reason}
                onChange={handleChange}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition sm:col-span-3 shadow-sm"
            >
              {submitting ? 'Submitting...' : 'Submit Leave Application'}
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-slate-500 font-medium">Status Filter:</span>
        {['ALL', 'pending', 'approved', 'rejected'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`text-xs px-3 py-1 rounded-md font-medium capitalize transition ${
              filterStatus === st
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {st === 'ALL' ? 'All Leaves' : st}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              {isReviewer && <th className="text-left px-4 py-3 font-semibold">Employee</th>}
              {isReviewer && <th className="text-left px-4 py-3 font-semibold">Department</th>}
              <th className="text-left px-4 py-3 font-semibold">Start Date</th>
              <th className="text-left px-4 py-3 font-semibold">End Date</th>
              <th className="text-left px-4 py-3 font-semibold">Reason</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-left px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLeaves.map((lv) => (
              <tr key={lv._id} className="hover:bg-slate-50/75 transition">
                {isReviewer && (
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <p>{lv.employee?.name || 'Unknown'}</p>
                    <p className="text-xs text-slate-400 font-normal">{lv.employee?.email}</p>
                  </td>
                )}
                {isReviewer && (
                  <td className="px-4 py-3 text-slate-600 text-xs">{lv.employee?.department || '—'}</td>
                )}
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{new Date(lv.startDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{new Date(lv.endDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-slate-700">{lv.reason}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-semibold border capitalize ${statusBadge[lv.status] || 'bg-slate-100 text-slate-700'}`}>
                    {lv.status}
                  </span>
                </td>
                <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                  {isReviewer ? (
                    lv.status === 'pending' ? (
                      <>
                        <button
                          onClick={() => handleReview(lv._id, 'approved')}
                          className="bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 px-2.5 py-1 rounded text-xs font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReview(lv._id, 'rejected')}
                          className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded text-xs font-medium"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-400 text-xs">Reviewed</span>
                    )
                  ) : (
                    lv.status === 'pending' ? (
                      <button
                        onClick={() => handleCancel(lv._id)}
                        className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded text-xs font-medium"
                      >
                        Cancel
                      </button>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )
                  )}
                </td>
              </tr>
            ))}
            {filteredLeaves.length === 0 && (
              <tr>
                <td colSpan={isReviewer ? 7 : 5} className="px-4 py-12 text-center text-slate-400">
                  No leave requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Leaves;

