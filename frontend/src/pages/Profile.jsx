import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { updateUser, logout } = useAuth();
  const [profile, setProfile] = useState(null);
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
        <div className="mt-3 flex flex-wrap gap-2">
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
    </div>
  );
};

export default Profile;
