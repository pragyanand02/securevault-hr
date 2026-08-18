import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ name: '', department: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProfile = async () => {
    try {
      const res = await api.get('/employees/me');
      setProfile(res.data);
      setForm({
        name: res.data.name || '',
        department: res.data.department || '',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load profile');
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const res = await api.put('/employees/me', form);
      setProfile(res.data.user);
      updateUser({ name: res.data.user.name, department: res.data.user.department });
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (error && !profile) return <div className="p-6 max-w-lg mx-auto text-red-600">{error}</div>;
  if (!profile) return <div className="p-6 max-w-lg mx-auto text-slate-400">Loading profile...</div>;

  const rows = [
    ['Full Name', profile.name],
    ['Work Email', profile.email],
    ['User Role', profile.role?.replace('_', ' ')],
    ['Department', profile.department || '—'],
  ];

  if (profile.role === 'admin') {
    rows.push(['Salary (AES Encrypted in DB)', profile.salary || '—']);
    rows.push(['Bank Details (AES Encrypted in DB)', profile.bankDetails || '—']);
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
          <p className="text-xs text-slate-500">View and update your personal employee details</p>
        </div>
        <button
          onClick={() => { setIsEditing(!isEditing); setError(''); setSuccess(''); }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${isEditing ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
        >
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </button>
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

      {isEditing ? (
        <form onSubmit={handleSave} className="bg-white rounded-xl shadow-md p-6 border border-slate-200 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Email (Read Only)</label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full border border-slate-200 bg-slate-100 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Department</label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              placeholder="e.g. Engineering, Product, HR"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition shadow-sm"
            >
              {saving ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white rounded-xl shadow-md divide-y divide-slate-100 border border-slate-200 overflow-hidden">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between items-center px-5 py-3.5 text-sm">
              <span className="text-slate-500">{label}</span>
              <span className="text-slate-800 font-medium capitalize">{value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 text-center">
        <span className="inline-block bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full border border-blue-200">
          Account Status: Active &bull; Role: {profile.role?.replace('_', ' ').toUpperCase()}
        </span>
      </div>
    </div>
  );
};

export default Profile;

