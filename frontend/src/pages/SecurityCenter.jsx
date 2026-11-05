import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';

const statusStyle = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  in_review: 'bg-blue-100 text-blue-700 border-blue-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  denied: 'bg-red-100 text-red-700 border-red-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  revoked: 'bg-slate-200 text-slate-700 border-slate-300',
  expired: 'bg-slate-100 text-slate-500 border-slate-200',
  deferred: 'bg-amber-100 text-amber-700 border-amber-200',
};

const severityStyle = {
  info: 'bg-slate-100 text-slate-600',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

const StatCard = ({ label, value, hint, tone = 'slate' }) => {
  const tones = {
    slate: 'text-slate-800',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    emerald: 'text-emerald-600',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-extrabold ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
};

const Section = ({ title, subtitle, action, children }) => (
  <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </section>
);

const SecurityCenter = () => {
  const [stats, setStats] = useState(null);
  const [privacy, setPrivacy] = useState(null);
  const [grants, setGrants] = useState([]);
  const [requests, setRequests] = useState([]);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [downloading, setDownloading] = useState('');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, privacyRes, grantsRes, requestsRes] = await Promise.all([
        api.get('/audit-logs/stats'),
        api.get('/privacy/stats'),
        api.get('/access/requests'),
        api.get('/privacy/requests'),
      ]);
      setStats(statsRes.data);
      setPrivacy(privacyRes.data);
      setGrants(grantsRes.data);
      setRequests(requestsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load the security centre');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (message) => {
    setSuccess(message);
    setError('');
    setTimeout(() => setSuccess(''), 5000);
  };

  const verifyChain = async () => {
    setVerifying(true);
    setError('');
    try {
      const res = await api.get('/audit-logs/verify');
      setVerification(res.data);
      if (res.data.valid) flash('Audit hash chain verified: every record is intact.');
      else setError(`Chain verification FAILED at sequence ${res.data.brokenAtSequence}: ${res.data.reason}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const downloadJson = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const downloadAnchor = async () => {
    setDownloading('anchor');
    setError('');
    try {
      const res = await api.get('/audit-logs/anchor');
      downloadJson(res.data, `securevault-anchor-${res.data.sequenceTo}.json`);
      flash(`Anchor receipt for sequence #${res.data.sequenceTo} downloaded (root ${String(res.data.merkleRoot).slice(0, 12)}…).`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create the anchor receipt');
    } finally {
      setDownloading('');
    }
  };

  const downloadCompliancePack = async () => {
    setDownloading('pack');
    setError('');
    try {
      const res = await api.get('/privacy/compliance-pack');
      downloadJson(res.data, `securevault-compliance-pack-${new Date().toISOString().slice(0, 10)}.json`);
      flash('Compliance evidence pack downloaded (counts, chain proof and access matrix).');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not generate the compliance pack');
    } finally {
      setDownloading('');
    }
  };

  const reviewGrant = async (grant, status) => {
    let reviewNote = '';
    if (status === 'approved') {
      const duration = window.prompt('Approve for how many minutes? (5-480)', '60');
      if (duration === null) return;
      setBusyId(grant._id);
      try {
        await api.put(`/access/requests/${grant._id}/review`, {
          status,
          durationMinutes: Number(duration) || 60,
        });
        flash('Time-bound access grant approved. It will expire automatically.');
        await load();
      } catch (err) {
        setError(err.response?.data?.message || 'Could not review the access request');
      } finally {
        setBusyId('');
      }
      return;
    }
    reviewNote = window.prompt('Reason for denial (optional)') || '';
    setBusyId(grant._id);
    try {
      await api.put(`/access/requests/${grant._id}/review`, { status, reviewNote });
      flash('Access request denied.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not review the access request');
    } finally {
      setBusyId('');
    }
  };

  const revokeGrant = async (grant) => {
    if (!window.confirm('Revoke this access grant immediately?')) return;
    setBusyId(grant._id);
    try {
      await api.delete(`/access/requests/${grant._id}`);
      flash('Access grant revoked.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not revoke the grant');
    } finally {
      setBusyId('');
    }
  };

  const reviewPrivacyRequest = async (request, status) => {
    const resolutionNote = window.prompt(`Note for marking this ${request.type} request as ${status.replace('_', ' ')} (optional)`) || '';
    setBusyId(request._id);
    try {
      await api.put(`/privacy/requests/${request._id}`, { status, resolutionNote });
      flash(`Data request marked ${status.replace('_', ' ')}.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not review the data request');
    } finally {
      setBusyId('');
    }
  };

  if (loading && !stats) {
    return <div className="mx-auto max-w-6xl p-6 text-sm text-slate-500">Loading security posture…</div>;
  }

  const chain = stats?.chain || { sequence: 0, totalRecords: 0, lastHash: 'GENESIS' };
  const pendingGrants = grants.filter((g) => g.status === 'pending');
  const activeGrants = grants.filter((g) => g.status === 'approved');
  const openRequests = requests.filter((r) => ['pending', 'in_review'].includes(r.status));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-blue-900 p-6 text-white shadow-md">
        <span className="inline-block rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
          Operator &amp; DPO workspace
        </span>
        <h1 className="mt-2 text-2xl font-bold">Security Center</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-300">
          Evidence that the controls are working: tamper-evident audit chain, sensitive-read
          monitoring, time-bound access approvals, and data-principal request SLAs.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1">
            Chain length: {chain.totalRecords} record(s)
          </span>
          <span className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1">
            Consent coverage: {privacy?.consentCoveragePercent ?? 0}%
          </span>
          <span className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1">
            Response SLA: {privacy?.responseSlaDays ?? 30} days
          </span>
          <span className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1">
            Retention: {privacy?.retentionYears ?? 7} years
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={downloadCompliancePack}
            disabled={downloading === 'pack'}
            className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
          >
            {downloading === 'pack' ? 'Preparing pack…' : 'Download compliance pack'}
          </button>
          <span className="self-center text-[11px] text-slate-400">
            Counts, chain proof and access matrix — no salary/bank contents
          </span>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">{success}</div>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Audit events" value={stats?.total ?? '—'} hint={`${stats?.last24h ?? 0} in the last 24h`} tone="blue" />
        <StatCard
          label="Sensitive reads (24h)"
          value={stats?.sensitiveAccessLast24h ?? 0}
          hint="Salary/bank decryptions, all logged"
          tone={(stats?.sensitiveAccessLast24h ?? 0) > 0 ? 'amber' : 'emerald'}
        />
        <StatCard
          label="Failed logins (24h)"
          value={stats?.failedLoginsLast24h ?? 0}
          hint="Brute-force / credential-stuffing signal"
          tone={(stats?.failedLoginsLast24h ?? 0) > 0 ? 'red' : 'emerald'}
        />
        <StatCard
          label="Open DSARs"
          value={privacy?.pendingRequests ?? 0}
          hint={`${privacy?.overdueRequests ?? 0} overdue · ${privacy?.erasureRequests ?? 0} erasure`}
          tone={(privacy?.overdueRequests ?? 0) > 0 ? 'red' : 'slate'}
        />
      </div>

      <Section
        title="Audit chain integrity"
        subtitle="Every event is linked to the previous one with SHA-256. Editing any stored record breaks verification."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={downloadAnchor}
              disabled={downloading === 'anchor'}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {downloading === 'anchor' ? 'Anchoring…' : 'Download anchor receipt'}
            </button>
            <button
              onClick={verifyChain}
              disabled={verifying}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {verifying ? 'Verifying…' : 'Verify chain now'}
            </button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Current chain head</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-700">{chain.lastHash}</p>
            <p className="mt-2 text-[11px] text-slate-500">Sequence #{chain.sequence}</p>
          </div>
          <div className={`rounded-lg border p-4 ${
            verification
              ? verification.valid
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-red-200 bg-red-50'
              : 'border-slate-100 bg-slate-50/60'
          }`}>
            {verification ? (
              <>
                <p className={`text-sm font-bold ${verification.valid ? 'text-emerald-700' : 'text-red-700'}`}>
                  {verification.valid ? 'INTACT · no tampering detected' : 'TAMPERING DETECTED'}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {verification.valid
                    ? `${verification.total} record(s) recomputed and matched.`
                    : `Broken at sequence ${verification.brokenAtSequence}: ${verification.reason}`}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Checked {new Date(verification.checkedAt).toLocaleString()}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-slate-700">Not verified in this session</p>
                <p className="mt-1 text-xs text-slate-500">
                  Run verification to recompute every hash and prove the trail has not been altered.
                </p>
              </>
            )}
          </div>
        </div>

        {stats?.byCategory?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {stats.byCategory.map((item) => (
              <span key={item.category} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                {item.category}: {item.count}
              </span>
            ))}
            {stats?.bySeverity?.map((item) => (
              <span key={item.severity} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${severityStyle[item.severity] || severityStyle.info}`}>
                {item.severity}: {item.count}
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Time-bound sensitive-access requests"
        subtitle="HR gets salary/bank access only through an approved grant that expires automatically."
      >
        <div className="space-y-2">
          {grants.length === 0 && <p className="text-sm text-slate-400">No access requests yet.</p>}
          {grants.map((grant) => {
            const expired = grant.status === 'approved' && grant.expiresAt && new Date(grant.expiresAt) < new Date();
            return (
              <div key={grant._id} className="rounded-lg border border-slate-100 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {grant.grantee?.name || 'Unknown user'}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {grant.grantee?.email} · {grant.grantee?.department || 'no department'}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Field: <span className="font-medium">{grant.field}</span> · Scope: {grant.scope}
                    </p>
                    <p className="mt-0.5 text-xs italic text-slate-500">“{grant.reason}”</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Requested {new Date(grant.createdAt).toLocaleString()}
                      {grant.expiresAt && ` · ${expired ? 'expired' : 'expires'} ${new Date(grant.expiresAt).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${statusStyle[expired ? 'expired' : grant.status] || statusStyle.pending}`}>
                      {expired ? 'expired' : grant.status}
                    </span>
                    {grant.status === 'pending' && (
                      <>
                        <button
                          onClick={() => reviewGrant(grant, 'approved')}
                          disabled={busyId === grant._id}
                          className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => reviewGrant(grant, 'denied')}
                          disabled={busyId === grant._id}
                          className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                        >
                          Deny
                        </button>
                      </>
                    )}
                    {grant.status === 'approved' && !expired && (
                      <button
                        onClick={() => revokeGrant(grant)}
                        disabled={busyId === grant._id}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Revoke now
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-slate-400">
          {pendingGrants.length} pending · {activeGrants.length} active · every approval is a critical audit event.
        </p>
      </Section>

      <Section
        title="Data-principal requests (DSAR)"
        subtitle="Access, correction, erasure and grievance requests with a statutory-style response target."
      >
        <div className="space-y-2">
          {requests.length === 0 && <p className="text-sm text-slate-400">No data-principal requests yet.</p>}
          {requests.map((request) => {
            const overdue = ['pending', 'in_review'].includes(request.status) && new Date(request.dueAt) < new Date();
            return (
              <div key={request._id} className="rounded-lg border border-slate-100 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      <span className="capitalize">{request.type}</span> request
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {request.user?.name} · {request.user?.email}
                      </span>
                    </p>
                    {request.reason && <p className="mt-0.5 text-xs italic text-slate-500">“{request.reason}”</p>}
                    <p className={`mt-1 text-[11px] ${overdue ? 'font-semibold text-red-600' : 'text-slate-400'}`}>
                      Due {new Date(request.dueAt).toLocaleDateString()}
                      {overdue ? ' · OVERDUE' : ''}
                      {request.legalHold ? ' · legal hold (statutory retention)' : ''}
                    </p>
                    {request.resolutionNote && (
                      <p className="mt-1 text-[11px] text-slate-500">Resolution: {request.resolutionNote}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${statusStyle[request.status] || statusStyle.pending}`}>
                      {request.status.replace('_', ' ')}
                    </span>
                    {['pending', 'in_review'].includes(request.status) && (
                      <>
                        {request.status === 'pending' && (
                          <button
                            onClick={() => reviewPrivacyRequest(request, 'in_review')}
                            disabled={busyId === request._id}
                            className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                          >
                            Start review
                          </button>
                        )}
                        {request.type === 'erasure' && request.legalHold ? (
                          <button
                            onClick={() => reviewPrivacyRequest(request, 'deferred')}
                            disabled={busyId === request._id}
                            title="Statutory retention prevents erasure until the hold ends"
                            className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                          >
                            Defer (legal hold)
                          </button>
                        ) : (
                          <button
                            onClick={() => reviewPrivacyRequest(request, 'completed')}
                            disabled={busyId === request._id}
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                          >
                            Complete
                          </button>
                        )}
                        <button
                          onClick={() => reviewPrivacyRequest(request, 'rejected')}
                          disabled={busyId === request._id}
                          className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-slate-400">
          {openRequests.length} open request(s) · {privacy?.deferredRequests ?? 0} deferred under legal hold.
          Completing an erasure request anonymises the record only when no statutory retention hold is active; otherwise it must be deferred.
        </p>
      </Section>

      <Section
        title="Control summary"
        subtitle="What the system enforces today (and what is deliberately deferred)."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['Authenticated encryption', 'AES-256-GCM with per-record IV, auth tag and key id. Tampered ciphertext is rejected.'],
            ['Tamper-evident audit', 'SHA-256 hash chain with sequence numbers and an append-only application guard.'],
            ['Sensitive-read logging', 'Every salary/bank decryption creates a critical audit event with actor and IP.'],
            ['ABAC department scoping', 'HR sees only its own department; employees see only themselves.'],
            ['JIT elevation', 'Time-bound grants with a reason, review and automatic expiry.'],
            ['DPDP rights', 'Consent register, export, correction, erasure with legal hold, and grievance.'],
            ['JWT hardening', 'Short-lived access token in memory, rotating httpOnly refresh cookie, token-version revocation.'],
            ['Known limits', 'Single-instance chain lock, no KMS/HSM, no WebAuthn passkeys yet — see docs/SECURITY.md.'],
          ].map(([title, detail]) => (
            <div key={title} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <p className="text-xs font-semibold text-slate-800">{title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{detail}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
};

export default SecurityCenter;
