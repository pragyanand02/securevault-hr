import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'employee',
  department: '',
  designation: '',
  salary: '',
  bankDetails: '',
};

const roleBadge = {
  admin: 'bg-purple-50 text-purple-700 border-purple-200',
  hr_manager: 'bg-blue-50 text-blue-700 border-blue-200',
  employee: 'bg-slate-100 text-slate-700 border-slate-200',
};

const Employees = () => {
  const { user, isAdmin } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [access, setAccess] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [grant, setGrant] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestingAccess, setRequestingAccess] = useState(false);

  // Debounce the search box so we do not hit the API on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 20 };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      const res = await api.get('/employees', { params });
      setEmployees(res.data.data || []);
      setAccess(res.data.access || null);
      setPagination(res.data.pagination || { page: 1, pages: 1, total: 0, limit: 20 });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  const loadActiveGrant = useCallback(async () => {
    if (user.role !== 'hr_manager') return;
    try {
      const res = await api.get('/access/active');
      setGrant(res.data.grant || null);
    } catch {
      setGrant(null);
    }
  }, [user.role]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);
  useEffect(() => { loadActiveGrant(); }, [loadActiveGrant]);

  const flash = (message) => {
    setSuccess(message);
    setError('');
    setTimeout(() => setSuccess(''), 5000);
  };

  const handleChange = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (editingId) {
        const payload = { name: form.name, designation: form.designation };
        // Role, department and salary are admin-only attributes in the policy layer.
        if (isAdmin) {
          payload.department = form.department;
          payload.role = form.role;
          payload.salary = form.salary;
          payload.bankDetails = form.bankDetails;
        }
        await api.put(`/employees/${editingId}`, payload);
        flash('Employee details updated. The change is audit-logged.');
      } else {
        await api.post('/employees', form);
        flash('New employee created with encrypted salary/bank fields.');
      }
      resetForm();
      loadEmployees();
    } catch (err) {
      const validation = err.response?.data?.errors?.[0]?.message;
      setError(validation || err.response?.data?.message || 'Action failed');
    }
  };

  const handleEdit = (employee) => {
    setError('');
    setSuccess('');
    setForm({
      name: employee.name,
      email: employee.email,
      password: '',
      role: employee.role,
      department: employee.department || '',
      designation: employee.designation || '',
      salary: employee.salaryMasked ? '' : employee.salary || '',
      bankDetails: employee.bankDetailsMasked ? '' : employee.bankDetails || '',
    });
    setEditingId(employee.id);
    setShowForm(true);
  };

  const handleSoftDelete = async (employee) => {
    const confirmed = window.confirm(
      `Deactivate "${employee.name}"?\n\nThis is a soft delete: the account is disabled and the record is kept under statutory retention, not erased.`
    );
    if (!confirmed) return;
    setError('');
    try {
      const res = await api.delete(`/employees/${employee.id}`);
      flash(res.data.message || 'Employee deactivated.');
      loadEmployees();
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleRestore = async (employee) => {
    if (!window.confirm(`Restore "${employee.name}" and re-enable their account?`)) return;
    setError('');
    try {
      await api.post(`/employees/${employee.id}/restore`);
      flash('Employee restored.');
      loadEmployees();
    } catch (err) {
      setError(err.response?.data?.message || 'Restore failed');
    }
  };

  const requestSensitiveAccess = async () => {
    const reason = window.prompt(
      'Why do you need sensitive salary/bank data? (10-500 characters, recorded in the audit trail)',
      'Compensation review for my department'
    );
    if (reason === null) return;
    setRequestingAccess(true);
    setError('');
    try {
      await api.post('/access/requests', {
        reason,
        field: 'sensitive_fields',
        scope: 'department',
      });
      flash('Access request submitted. An admin must approve it, and it will expire automatically.');
      await loadActiveGrant();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit access request');
    } finally {
      setRequestingAccess(false);
    }
  };

  const totalPages = pagination.pages || 1;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Employee Directory</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
            {isAdmin
              ? 'Full scope. Sensitive salary/bank decryptions create a critical audit event.'
              : 'Attribute-based scope: you only see employees in your own department. Financial fields stay masked unless an admin grants time-bound access.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.role === 'hr_manager' && !grant && (
            <button
              onClick={requestSensitiveAccess}
              disabled={requestingAccess}
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
            >
              {requestingAccess ? 'Submitting…' : 'Request sensitive access'}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => { resetForm(); setShowForm(!showForm); }}
              className="self-start rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 sm:self-auto"
            >
              {showForm ? 'Close Form' : '+ Add New Employee'}
            </button>
          )}
        </div>
      </div>

      {/* Access posture banner */}
      {access && (
        <div className={`mb-5 flex flex-col gap-2 rounded-xl border px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between ${
          access.viaGrant
            ? 'border-amber-200 bg-amber-50 text-amber-800'
            : access.sensitiveMasked
              ? 'border-slate-200 bg-slate-50 text-slate-600'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
        }`}>
          <div>
            <p className="font-semibold">
              {access.viaGrant
                ? `Sensitive fields visible through an approved time-bound grant${grant?.expiresAt ? ` (expires ${new Date(grant.expiresAt).toLocaleTimeString()})` : ''}`
                : access.sensitiveMasked
                  ? 'Salary and bank details are masked for your role'
                  : 'Sensitive fields are decrypted for your admin role — every read is logged'}
            </p>
            <p className="mt-0.5">
              Scope: <span className="font-medium">{access.scope === 'all' ? 'whole organisation' : `${access.scope} department only`}</span>
            </p>
          </div>
          {access.viaGrant && (
            <span className="rounded-full border border-amber-300 bg-white/60 px-2.5 py-1 font-semibold">
              JIT grant active
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">
          {success}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-slate-800">
            {editingId ? 'Edit Employee Details' : 'Create New Employee Account'}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Full Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Work Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                disabled={Boolean(editingId)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            {!editingId && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Temporary Password</label>
                <input
                  name="password"
                  type="password"
                  placeholder="10+ chars · upper, lower, number, symbol"
                  value={form.password}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Designation</label>
              <input
                name="designation"
                value={form.designation}
                onChange={handleChange}
                placeholder="e.g. Backend Engineer"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {isAdmin && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">System Role</label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="employee">Employee</option>
                  <option value="hr_manager">HR Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Department {!isAdmin && <span className="text-slate-400">(admin-managed)</span>}
              </label>
              <input
                name="department"
                value={form.department}
                onChange={handleChange}
                disabled={!isAdmin}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            {isAdmin && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Salary <span className="font-normal text-emerald-600">(AES-256-GCM at rest)</span>
                  </label>
                  <input
                    name="salary"
                    value={form.salary}
                    onChange={handleChange}
                    placeholder={editingId ? 'Leave blank to keep current value' : 'e.g. 78000'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Bank Details <span className="font-normal text-emerald-600">(AES-256-GCM at rest)</span>
                  </label>
                  <input
                    name="bankDetails"
                    value={form.bankDetails}
                    onChange={handleChange}
                    placeholder={editingId ? 'Leave blank to keep current value' : 'AC / IFSC'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2 sm:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
              >
                {editingId ? 'Save Changes' : 'Create Employee'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
          {isAdmin && (
            <p className="mt-3 text-[11px] text-slate-400">
              Role changes and sensitive-field edits are warning/critical audit events. Changing a role revokes that user's sessions.
            </p>
          )}
        </form>
      )}

      {/* Search */}
      <div className="mb-5 flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <input
          type="text"
          placeholder="Search by name, email, department or employee code…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-96"
        />
        <div className="text-xs font-medium text-slate-500">
          {loading ? 'Loading…' : `${pagination.total} employee(s) in your scope`}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Employee</th>
                <th className="px-4 py-3 text-left font-semibold">Role</th>
                <th className="px-4 py-3 text-left font-semibold">Department</th>
                <th className="px-4 py-3 text-left font-semibold">Salary</th>
                <th className="px-4 py-3 text-left font-semibold">Bank details</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((employee) => (
                <tr key={employee.id} className={`transition hover:bg-slate-50/75 ${employee.isDeleted ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">
                      {employee.name}
                      {employee.isDeleted && (
                        <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                          archived
                        </span>
                      )}
                    </p>
                    <p className="text-xs font-normal text-slate-400">{employee.email}</p>
                    {employee.designation && <p className="text-[11px] text-slate-400">{employee.designation}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${roleBadge[employee.role] || roleBadge.employee}`}>
                      {employee.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{employee.department || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-xs ${employee.salaryMasked ? 'text-slate-400' : 'text-slate-700'}`}>
                      {employee.salary ?? '—'}
                    </span>
                    {employee.salaryMasked && (
                      <span className="mt-0.5 block text-[10px] text-slate-400">masked · encrypted at rest</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-xs ${employee.bankDetailsMasked ? 'text-slate-400' : 'text-slate-700'}`}>
                      {employee.bankDetails ?? '—'}
                    </span>
                    {employee.bankDetailsMasked && (
                      <span className="mt-0.5 block text-[10px] text-slate-400">masked · encrypted at rest</span>
                    )}
                  </td>
                  <td className="space-x-2 whitespace-nowrap px-4 py-3">
                    {!employee.isDeleted && (
                      <button
                        onClick={() => handleEdit(employee)}
                        className="rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        Edit
                      </button>
                    )}
                    {isAdmin && !employee.isDeleted && employee.id !== user.id && (
                      <button
                        onClick={() => handleSoftDelete(employee)}
                        className="rounded border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        Deactivate
                      </button>
                    )}
                    {isAdmin && employee.isDeleted && (
                      <button
                        onClick={() => handleRestore(employee)}
                        className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    {loading ? 'Loading employees…' : 'No matching employees in your scope.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Page {pagination.page} of {totalPages} · {pagination.total} record(s)</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={pagination.page <= 1 || loading}
              className="rounded-md border border-slate-200 bg-white px-3 py-1 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={pagination.page >= totalPages || loading}
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

export default Employees;
