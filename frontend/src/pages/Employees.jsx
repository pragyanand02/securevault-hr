import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const emptyForm = { name: '', email: '', password: '', role: 'employee', department: '', salary: '', bankDetails: '' };

const Employees = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const res = await api.get('/employees');
      setEmployees(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (editingId) {
        const { name, department, role, salary, bankDetails } = form;
        await api.put(`/employees/${editingId}`, { name, department, role, salary, bankDetails });
        setSuccess('Employee details updated successfully');
      } else {
        await api.post('/employees', form);
        setSuccess('New employee created successfully');
      }
      resetForm();
      loadEmployees();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed');
    }
  };

  const handleEdit = (emp) => {
    setError('');
    setSuccess('');
    setForm({
      name: emp.name,
      email: emp.email,
      password: '',
      role: emp.role,
      department: emp.department || '',
      salary: emp.salary || '',
      bankDetails: emp.bankDetails || '',
    });
    setEditingId(emp.id);
    setShowForm(true);
  };

  const handleDelete = async (id, empName) => {
    if (!window.confirm(`Are you sure you want to delete employee "${empName}"? This action cannot be undone.`)) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/employees/${id}`);
      setSuccess('Employee record deleted successfully');
      loadEmployees();
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    }
  };

  const canSeeSensitive = user.role === 'admin';

  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase();
    return (
      (emp.name || '').toLowerCase().includes(q) ||
      (emp.email || '').toLowerCase().includes(q) ||
      (emp.department || '').toLowerCase().includes(q) ||
      (emp.role || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Employee Management</h1>
          <p className="text-slate-500 text-xs mt-0.5">
            {user.role === 'admin'
              ? 'Full management: create, edit, delete, and view AES-encrypted salary/bank records.'
              : 'HR view: edit employee department and personal details (financial details masked).'}
          </p>
        </div>
        {user.role === 'admin' && (
          <button
            onClick={() => { resetForm(); setShowForm(!showForm); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition shadow-sm self-start sm:self-auto"
          >
            {showForm ? 'Close Form' : '+ Add New Employee'}
          </button>
        )}
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

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-base font-bold text-slate-800 mb-4">
            {editingId ? 'Edit Employee Details' : 'Create New Employee Account'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
              <input
                name="name"
                placeholder="Full Name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Work Email</label>
              <input
                name="email"
                type="email"
                placeholder="Email Address"
                value={form.email}
                onChange={handleChange}
                required
                disabled={!!editingId}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {!editingId && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
                <input
                  name="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={handleChange}
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {user.role === 'admin' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">System Role</label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="employee">Employee</option>
                  <option value="hr_manager">HR Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
              <input
                name="department"
                placeholder="Department"
                value={form.department}
                onChange={handleChange}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {canSeeSensitive && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Salary (AES Encrypted)</label>
                  <input
                    name="salary"
                    placeholder="e.g. $85,000"
                    value={form.salary}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Bank Account Details (AES Encrypted)</label>
                  <input
                    name="bankDetails"
                    placeholder="e.g. AC: 9876543210 / IFSC: HDFC0001"
                    value={form.bankDetails}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            <div className="sm:col-span-2 pt-2 flex gap-3">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition shadow-sm"
              >
                {editingId ? 'Save Changes' : 'Create Employee'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="w-full sm:w-80">
          <input
            type="text"
            placeholder="Search employee by name, email, department, role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing {filteredEmployees.length} of {employees.length} employees
        </div>
      </div>

      {/* Employee List Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Employee</th>
              <th className="text-left px-4 py-3 font-semibold">Role</th>
              <th className="text-left px-4 py-3 font-semibold">Department</th>
              {canSeeSensitive && <th className="text-left px-4 py-3 font-semibold">Salary (Decrypted)</th>}
              {canSeeSensitive && <th className="text-left px-4 py-3 font-semibold">Bank Details</th>}
              <th className="text-left px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredEmployees.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50/75 transition">
                <td className="px-4 py-3 font-medium text-slate-800">
                  <p>{emp.name}</p>
                  <p className="text-xs text-slate-400 font-normal">{emp.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize border ${
                    emp.role === 'admin'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : emp.role === 'hr_manager'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {emp.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs">{emp.department || '—'}</td>
                {canSeeSensitive && (
                  <td className="px-4 py-3 font-mono text-slate-700 text-xs">
                    {emp.salary || <span className="text-slate-400">Not set</span>}
                  </td>
                )}
                {canSeeSensitive && (
                  <td className="px-4 py-3 font-mono text-slate-700 text-xs">
                    {emp.bankDetails || <span className="text-slate-400">Not set</span>}
                  </td>
                )}
                <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                  <button
                    onClick={() => handleEdit(emp)}
                    className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded text-xs font-medium"
                  >
                    Edit
                  </button>
                  {user.role === 'admin' && (
                    <button
                      onClick={() => handleDelete(emp.id, emp.name)}
                      className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded text-xs font-medium"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan={canSeeSensitive ? 6 : 4} className="px-4 py-12 text-center text-slate-400">
                  {loading ? 'Loading employees...' : 'No matching employees found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Employees;

