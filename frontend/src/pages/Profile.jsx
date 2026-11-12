import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { updateUser, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [payslip, setPayslip] = useState(null);
  const [showPayslip, setShowPayslip] = useState(false);
  const [loadingPayslip, setLoadingPayslip] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ name: '', designation: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const loadProfile = async () => {
    try {
      const res = await api.get('/employees/me');
      setProfile(res.data);
      setForm({
        name: res.data.name || '',
        designation: res.data.designation || '',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load profile');
    }
  };

  const loadPayslip = async () => {
    setLoadingPayslip(true);
    setError('');
    try {
      const res = await api.get('/employees/me/payslip');
      setPayslip(res.data);
      setShowPayslip(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate payslip');
    } finally {
      setLoadingPayslip(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const flash = (message) => {
    setSuccess(message);
    setError('');
    setTimeout(() => setSuccess(''), 5000);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const res = await api.put('/employees/me', form);
      setProfile(res.data.user);
      updateUser({ name: res.data.user.name, designation: res.data.user.designation });
      flash('Profile updated. The change is recorded in the audit trail.');
      setIsEditing(false);
    } catch (err) {
      const validation = err.response?.data?.errors?.[0]?.message;
      setError(validation || err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (passwords.newPassword !== passwords.confirmPassword) {
      return setError('New password and confirmation do not match');
    }

    setChangingPassword(true);
    try {
      await api.put('/auth/password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      flash('Password changed. All sessions were revoked — signing you out…');
      setTimeout(async () => { await logout(); }, 1800);
    } catch (err) {
      const validation = err.response?.data?.errors?.[0]?.message;
      setError(validation || err.response?.data?.message || 'Could not change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (error && !profile) return <div className="mx-auto max-w-lg p-6 text-red-600">{error}</div>;
  if (!profile) return <div className="mx-auto max-w-lg p-6 text-slate-400">Loading profile…</div>;

  const rows = [
    ['Full name', profile.name],
    ['Work email', profile.email],
    ['Employee code', profile.employeeCode || '—'],
    ['Designation', profile.designation || '—'],
    ['Department', profile.department || '—'],
    ['User role', profile.role?.replace('_', ' ')],
    ['Account status', profile.isActive ? 'Active' : 'Inactive'],
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Your account details. Department and role are managed by an administrator (ABAC scope cannot be self-modified).
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/privacy"
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
          >
            My Data
          </Link>
          <button
            onClick={() => { setIsEditing(!isEditing); setError(''); setSuccess(''); }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              isEditing ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isEditing ? 'Cancel' : 'Edit profile'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">{success}</div>
      )}

      {isEditing ? (
        <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Full name</label>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Designation</label>
            <input
              type="text"
              value={form.designation}
              onChange={(event) => setForm({ ...form, designation: event.target.value })}
              placeholder="e.g. Backend Engineer"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Email (read only)</label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Department (read only)
            </label>
            <input
              type="text"
              value={profile.department || ''}
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Changing your own department would let you expand your access scope, so only an admin can do it.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 text-sm last:border-0">
              <span className="text-slate-500">{label}</span>
              <span className="font-medium capitalize text-slate-800">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sensitive self-service fields */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800">Your sensitive records</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          You can always see your own data. At rest these fields use AES-256-GCM authenticated encryption.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Salary</p>
            <p className="mt-1 font-mono text-sm text-slate-800">{profile.salary || 'Not recorded'}</p>
            <p className="mt-0.5 text-[11px] text-emerald-600">
              {profile.salaryMasked === false && profile.salary ? 'Decrypted for you · encrypted at rest' : 'No value stored'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Bank details</p>
            <p className="mt-1 font-mono text-sm text-slate-800">{profile.bankDetails || 'Not recorded'}</p>
            <p className="mt-0.5 text-[11px] text-emerald-600">
              {profile.bankDetails && profile.bankDetailsMasked === false ? 'Decrypted for you · encrypted at rest' : 'No value stored'}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={loadPayslip}
            disabled={loadingPayslip}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60 shadow-sm"
          >
            📄 {loadingPayslip ? 'Generating Secure Payslip…' : 'Generate & Download Official Payslip'}
          </button>
          <Link to="/privacy" className="text-xs font-semibold text-blue-600 hover:underline">
            See full data inventory, consent history and retention &rarr;
          </Link>
        </div>
      </section>

      {/* Password change */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800">Change password</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Changing your password revokes every existing session (access and refresh tokens).
        </p>
        <form onSubmit={handlePasswordChange} className="mt-4 space-y-3">
          <input
            type="password"
            placeholder="Current password"
            value={passwords.currentPassword}
            onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="password"
              placeholder="New password (10+ chars, mixed)"
              value={passwords.newPassword}
              onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={passwords.confirmPassword}
              onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={changingPassword}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-900 disabled:opacity-60"
          >
            {changingPassword ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </section>

      <div className="text-center">
        <span className="inline-block rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
          Account status: {profile.isActive ? 'Active' : 'Inactive'} &bull; Role: {profile.role?.replace('_', ' ').toUpperCase()}
        </span>
      </div>

      {/* Cryptographic Payslip Modal */}
      {showPayslip && payslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            {/* Header */}
            <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">SV</span>
                  <h3 className="text-lg font-bold text-slate-800">{payslip.company}</h3>
                </div>
                <p className="mt-1 text-xs text-slate-500">Official Monthly Compensation & Earnings Statement</p>
              </div>
              <div className="text-right">
                <span className="inline-block rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                  {payslip.period}
                </span>
                <p className="mt-1 font-mono text-[10px] text-slate-400">Generated: {new Date(payslip.generatedAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Employee Meta */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl text-xs border border-slate-100">
              <div>
                <p className="text-slate-400 font-medium">Employee Name</p>
                <p className="font-semibold text-slate-800 mt-0.5">{payslip.employee.name}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Employee Code</p>
                <p className="font-semibold text-slate-800 mt-0.5">{payslip.employee.employeeCode}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Department</p>
                <p className="font-semibold text-slate-800 mt-0.5">{payslip.employee.department}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Designation</p>
                <p className="font-semibold text-slate-800 mt-0.5">{payslip.employee.designation}</p>
              </div>
            </div>

            {/* Earnings & Deductions Tables */}
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              {/* Earnings */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-white">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b pb-1.5 mb-2">Earnings</h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600"><span>Basic Pay (50%)</span><span>₹{payslip.earnings.basic.toLocaleString()}</span></div>
                  <div className="flex justify-between text-slate-600"><span>House Rent Allowance (30%)</span><span>₹{payslip.earnings.hra.toLocaleString()}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Special Allowance</span><span>₹{payslip.earnings.specialAllowance.toLocaleString()}</span></div>
                  <div className="border-t pt-1.5 flex justify-between font-bold text-slate-800"><span>Gross Earnings</span><span>₹{payslip.earnings.grossSalary.toLocaleString()}</span></div>
                </div>
              </div>

              {/* Deductions */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-white">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b pb-1.5 mb-2">Deductions</h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600"><span>Provident Fund (EPF)</span><span>₹{payslip.deductions.pf.toLocaleString()}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Professional Tax</span><span>₹{payslip.deductions.professionalTax.toLocaleString()}</span></div>
                  <div className="border-t pt-1.5 flex justify-between font-bold text-slate-800"><span>Total Deductions</span><span>₹{payslip.deductions.totalDeductions.toLocaleString()}</span></div>
                </div>
              </div>
            </div>

            {/* Net Pay Callout */}
            <div className="mt-4 flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-emerald-900">
              <div>
                <p className="text-xs font-semibold text-emerald-800">Net Take-Home Disbursed</p>
                <p className="text-[11px] text-emerald-600 font-mono mt-0.5">Credited to: {payslip.employee.bankDetails}</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold font-mono text-emerald-800">₹{payslip.netSalary.toLocaleString()}</span>
              </div>
            </div>

            {/* Cryptographic Tamper-Evidence Seal */}
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-3.5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider">Cryptographic Security Verification</span>
                </div>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded font-mono">
                  {payslip.security.algorithm}
                </span>
              </div>
              <p className="mt-2 text-[10px] text-slate-400">
                Digital Fingerprint (SHA-256 Digest of verified salary & identity state):
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-emerald-400 break-all bg-black/40 p-2 rounded border border-slate-800">
                {payslip.security.verificationHash}
              </p>
            </div>

            {/* Modal Footer Actions */}
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 shadow-sm"
              >
                🖨️ Print / Save as PDF
              </button>
              <button
                type="button"
                onClick={() => setShowPayslip(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
