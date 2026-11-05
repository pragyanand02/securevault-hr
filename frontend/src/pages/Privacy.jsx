import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';

const rightsActions = [
  { type: 'correction', label: 'Request correction', hint: 'Ask for an inaccurate field to be fixed.' },
  { type: 'grievance', label: 'Raise a grievance', hint: 'Escalate a privacy concern; 30-day response target.' },
];

const Privacy = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/privacy/me');
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load privacy centre');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (message) => {
    setSuccess(message);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const toggleConsent = async (purpose, granted) => {
    setBusy(purpose);
    try {
      await api.put('/privacy/consents', { purpose, granted });
      flash(`Consent ${granted ? 'granted' : 'withdrawn'} for ${purpose.replace(/_/g, ' ')}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update consent');
    } finally {
      setBusy('');
    }
  };

  const exportData = async () => {
    setBusy('export');
    try {
      const res = await api.get('/privacy/me/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `securevault-export-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      flash('Your data export has been downloaded. Every export is audit-logged.');
    } catch (err) {
      setError(err.response?.data?.message || 'Export failed');
    } finally {
      setBusy('');
    }
  };

  const requestErasure = async () => {
    const reason = window.prompt('Why are you requesting erasure? (optional)');
    if (reason === null) return;
    setBusy('erasure');
    try {
      const res = await api.post('/privacy/erasure', { reason });
      flash(res.data.message);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create erasure request');
    } finally {
      setBusy('');
    }
  };

  const createRequest = async (type) => {
    const reason = window.prompt(`Describe your ${type} request (optional)`);
    if (reason === null) return;
    setBusy(type);
    try {
      await api.post('/privacy/requests', { type, reason });
      flash(`${type} request recorded. Response target: 30 days.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create request');
    } finally {
      setBusy('');
    }
  };

  if (loading && !data) {
    return <div className="p-6 max-w-6xl mx-auto text-sm text-slate-500">Loading your privacy record…</div>;
  }

  if (!data) {
    return <div className="p-6 max-w-6xl mx-auto text-sm text-red-600">{error || 'Privacy record unavailable'}</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-blue-900 p-6 text-white shadow-md">
        <span className="inline-block rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
          Data-principal rights · DPDP-aligned
        </span>
        <h1 className="mt-2 text-2xl font-bold">My Data & Privacy</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-300">
          See exactly what is stored about you, why it is processed, who can access it,
          and exercise your access, correction, erasure and consent-withdrawal rights.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-300">
          <span className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1">
            Encryption: {data.encryption.algorithm} / {data.encryption.keyId}
          </span>
          <span className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1">
            Notice: {data.dataPrincipal.noticeVersion || 'not accepted'}
          </span>
          <span className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1">
            Audit events about you: {data.audit.totalEventsAboutMe}
          </span>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">{success}</div>}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-800">What we store about you</h2>
          <p className="mt-0.5 text-xs text-slate-500">Data inventory with purpose and retention.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Field</th>
                <th className="px-4 py-3 text-left font-semibold">Value</th>
                <th className="px-4 py-3 text-left font-semibold">Encrypted at rest</th>
                <th className="px-4 py-3 text-left font-semibold">Purpose</th>
                <th className="px-4 py-3 text-left font-semibold">Retention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.inventory.map((item) => (
                <tr key={item.field}>
                  <td className="px-4 py-3 font-medium text-slate-800">{item.field}</td>
                  <td className="px-4 py-3 text-slate-600">{item.value}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.encryptedAtRest ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {item.encryptedAtRest ? 'Yes · AES-256-GCM' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.purpose.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{item.retention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800">Consent register</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Mandatory processing is required by contract or legal obligation. Optional purposes can be withdrawn at any time.
        </p>
        <div className="mt-4 space-y-2">
          {data.consents.map((consent) => (
            <div key={consent.purpose} className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium capitalize text-slate-800">{consent.purposeLabel}</p>
                <p className="text-xs text-slate-500">
                  Basis: {consent.lawfulBasis.replace(/_/g, ' ')}
                  {consent.mandatory ? ' · required' : ' · optional'}
                  {consent.withdrawnAt ? ` · withdrawn ${new Date(consent.withdrawnAt).toLocaleDateString()}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-semibold ${consent.granted ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {consent.granted ? 'Granted' : 'Not granted'}
                </span>
                <button
                  disabled={!consent.canWithdraw || busy === consent.purpose}
                  onClick={() => toggleConsent(consent.purpose, !consent.granted)}
                  className={`relative h-6 w-11 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${consent.granted ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  aria-label={`Toggle ${consent.purpose}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${consent.granted ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800">Exercise your rights</h2>
          <p className="mt-0.5 text-xs text-slate-500">Requests are recorded in the audit trail and have a 30-day response target.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              onClick={exportData}
              disabled={busy === 'export'}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy === 'export' ? 'Preparing export…' : 'Export my data (JSON)'}
            </button>
            <button
              onClick={requestErasure}
              disabled={busy === 'erasure'}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
            >
              {busy === 'erasure' ? 'Submitting…' : 'Request erasure'}
            </button>
            {rightsActions.map((action) => (
              <button
                key={action.type}
                onClick={() => createRequest(action.type)}
                disabled={busy === action.type}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {action.label}
                <span className="mt-0.5 block text-[11px] font-normal text-slate-400">{action.hint}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Erasure may be limited by statutory payroll retention. In that case the request is recorded with a legal hold and reviewed after the retention period.
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800">My requests</h2>
          <p className="mt-0.5 text-xs text-slate-500">Access, correction, erasure and grievance history.</p>
          <div className="mt-4 space-y-2">
            {data.requests.length === 0 && <p className="text-sm text-slate-400">No requests raised yet.</p>}
            {data.requests.map((request) => (
              <div key={request._id} className="rounded-lg border border-slate-100 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium capitalize text-slate-800">{request.type}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                    request.status === 'completed' ? 'bg-emerald-100 text-emerald-700'
                      : request.status === 'rejected' ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}>
                    {request.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Due {new Date(request.dueAt).toLocaleDateString()}
                  {request.legalHold ? ' · legal hold (statutory retention)' : ''}
                </p>
                {request.resolutionNote && <p className="mt-1 text-[11px] text-slate-500">Note: {request.resolutionNote}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800">Retention policy</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {Object.entries(data.retentionPolicy).map(([key, value]) => (
            <div key={key} className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{key}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-700">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-800">Who can access what</h2>
          <p className="mt-0.5 text-xs text-slate-500">Access explainability: the policy is visible to the data principal.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Field</th>
                <th className="px-4 py-2.5 text-left font-semibold">Admin</th>
                <th className="px-4 py-2.5 text-left font-semibold">HR Manager</th>
                <th className="px-4 py-2.5 text-left font-semibold">Employee</th>
                <th className="px-4 py-2.5 text-left font-semibold">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.accessMatrix.map((row) => (
                <tr key={row.field}>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{row.field}</td>
                  <td className="px-4 py-2.5 text-slate-600">{row.admin}</td>
                  <td className="px-4 py-2.5 text-slate-600">{row.hr_manager}</td>
                  <td className="px-4 py-2.5 text-slate-600">{row.employee}</td>
                  <td className="px-4 py-2.5 text-slate-500">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800">Recent audit events about me</h2>
        <div className="mt-3 space-y-2">
          {data.audit.recent.length === 0 && <p className="text-sm text-slate-400">No events recorded yet.</p>}
          {data.audit.recent.map((event) => (
            <div key={event._id} className="flex flex-col gap-1 rounded-lg border border-slate-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-700">{event.action}</p>
                <p className="text-[11px] text-slate-500">{event.details}</p>
              </div>
              <p className="text-[11px] text-slate-400">{new Date(event.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Privacy;
