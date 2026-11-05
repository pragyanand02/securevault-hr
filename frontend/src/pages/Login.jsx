import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    department: '',
    password: '',
    confirmPassword: '',
  });
  const [acceptNotice, setAcceptNotice] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (isRegister) {
      if (form.password.length < 10) {
        return setError('Password must be at least 10 characters long');
      }
      if (form.password !== form.confirmPassword) {
        return setError('Passwords do not match');
      }
      if (!acceptNotice) {
        return setError('Please accept the privacy notice to create an account');
      }
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register({
          name: form.name,
          email: form.email,
          password: form.password,
          department: form.department,
          acceptNotice,
        });
      } else {
        await login(form.email, form.password);
      }
      navigate('/dashboard');
    } catch (err) {
      const validation = err.response?.data?.errors?.[0]?.message;
      setError(
        validation ||
        err.response?.data?.message ||
        (isRegister ? 'Registration failed. Please try again.' : 'Login failed. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10">
      <div className="mx-auto grid max-w-5xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="text-white">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
            DPDP-ready · 2026–27
          </div>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            SecureVault HR
          </h1>
          <p className="mt-2 text-lg text-slate-300">
            The employee data trust layer: verifiable consent, authenticated encryption, and a tamper-evident access trail.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              ['AES-256-GCM', 'Sensitive fields encrypted and integrity-checked at rest'],
              ['Hash-chained audit', 'Any edited audit record is detected on verification'],
              ['Purpose-bound consent', 'Seven-purpose register with withdrawal support'],
              ['Time-bound access', 'HR needs an approved, expiring grant for salary data'],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{detail}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs text-slate-500">
            Academic project · National Institute of Technology, Raipur
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-2xl">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white shadow-md">
              SV
            </div>
            <h2 className="text-xl font-bold text-slate-800">SecureVault HR</h2>
            <p className="mt-1 text-xs text-slate-500">Employee Data Trust Layer</p>
          </div>

          <div className="mb-5 flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => { setIsRegister(false); setError(''); }}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${!isRegister ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setError(''); }}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${isRegister ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Register (Employee)
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {isRegister && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Full Name</label>
                <input
                  value={form.name}
                  onChange={update('name')}
                  required
                  placeholder="e.g. Neha Iyer"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Work Email</label>
              <input
                type="email"
                value={form.email}
                onChange={update('email')}
                required
                placeholder="you@company.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {isRegister && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Department</label>
                <input
                  value={form.department}
                  onChange={update('department')}
                  placeholder="e.g. Engineering"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={update('password')}
                required
                placeholder={isRegister ? '10+ chars, upper, lower, number, symbol' : 'Your password'}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {isRegister && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Confirm Password</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={update('confirmPassword')}
                    required
                    placeholder="Re-enter password"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={acceptNotice}
                    onChange={(event) => setAcceptNotice(event.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    I have read the privacy notice and consent to mandatory employment processing
                    (core HR, payroll, statutory compliance). Optional purposes can be changed later in <strong>My Data</strong>.
                  </span>
                </label>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? (isRegister ? 'Creating account…' : 'Signing in…') : (isRegister ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-4 text-center text-[11px] leading-relaxed text-slate-400">
            AES-256-GCM field encryption · httpOnly refresh sessions · RBAC + ABAC · tamper-evident audit trail
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
