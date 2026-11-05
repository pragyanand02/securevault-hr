/* eslint-disable no-console */
// End-to-end smoke test against a running local API.
// Usage: node scripts/smoke.js   (server must be running on PORT, default 5000)
const assert = require('assert/strict');

const BASE = process.env.SMOKE_BASE_URL || `http://localhost:${process.env.PORT || 5000}/api`;
const PASSWORD = 'Demo@2026!';

const call = async (path, { method = 'GET', token, body, cookie } = {}) => {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON response (export) */ }

  return {
    status: response.status,
    json,
    text,
    cookie: response.headers.getSetCookie?.().join('; ') || '',
  };
};

const login = async (email) => {
  const result = await call('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  assert.equal(result.status, 200, `login failed for ${email}: ${result.text}`);
  assert.ok(result.json.accessToken, 'access token missing');
  assert.ok(result.cookie.includes('refreshToken='), 'refresh cookie missing');
  return { token: result.json.accessToken, cookie: result.cookie };
};

const run = async () => {
  const checks = [];
  const check = (name, fn) => checks.push({ name, fn });

  check('health endpoint reports encryption + audit chain', async () => {
    const res = await call('/health');
    assert.equal(res.status, 200);
    assert.equal(res.json.encryption.algorithm, 'aes-256-gcm');
    assert.ok(res.json.auditChain.totalRecords > 0);
  });

  const admin = await login('admin@securevault.demo');
  const hr = await login('hr@securevault.demo');
  const employee = await login('neha@securevault.demo');

  check('admin sees decrypted sensitive fields', async () => {
    const res = await call('/employees?limit=5', { token: admin.token });
    assert.equal(res.status, 200);
    assert.equal(res.json.access.sensitiveMasked, false);
    assert.ok(res.json.data.some((e) => e.salary && e.salary !== '••••••'));
  });

  check('HR sees masked sensitive fields by default', async () => {
    const res = await call('/employees?limit=5', { token: hr.token });
    assert.equal(res.status, 200);
    assert.equal(res.json.access.sensitiveMasked, true);
    assert.ok(res.json.data.every((e) => e.salary === '••••••' || e.salary === null));
  });

  check('HR cannot see employees outside their department', async () => {
    const res = await call('/employees?limit=50', { token: hr.token });
    assert.equal(res.status, 200);
    assert.ok(res.json.data.every((e) => e.department === 'Engineering'));
  });

  check('HR cannot access the audit trail', async () => {
    const res = await call('/audit-logs', { token: hr.token });
    assert.equal(res.status, 403);
  });

  check('employee cannot list the employee directory', async () => {
    const res = await call('/employees', { token: employee.token });
    assert.equal(res.status, 403);
  });

  check('HR raises a JIT sensitive-access request', async () => {
    const res = await call('/access/requests', {
      method: 'POST',
      token: hr.token,
      body: { reason: 'Compensation review for the Engineering team', field: 'sensitive_fields' },
    });
    assert.ok([201, 409].includes(res.status), res.text);
  });

  check('admin approves the JIT request', async () => {
    const list = await call('/access/requests', { token: admin.token });
    assert.equal(list.status, 200);
    const pending = list.json.find((g) => g.status === 'pending');
    assert.ok(pending, 'no pending access request found');
    const res = await call(`/access/requests/${pending._id}/review`, {
      method: 'PUT',
      token: admin.token,
      body: { status: 'approved', durationMinutes: 60 },
    });
    assert.equal(res.status, 200, res.text);
  });

  check('HR can see sensitive fields after approval (via grant)', async () => {
    const res = await call('/employees?limit=5', { token: hr.token });
    assert.equal(res.status, 200);
    assert.equal(res.json.access.viaGrant, true);
    assert.ok(res.json.data.some((e) => e.salary && e.salary !== '••••••'));
  });

  check('audit hash chain verifies', async () => {
    const res = await call('/audit-logs/verify', { token: admin.token });
    assert.equal(res.status, 200);
    assert.equal(res.json.valid, true, res.text);
  });

  check('sensitive decryptions are audit-logged', async () => {
    const res = await call('/audit-logs?action=SENSITIVE_FIELDS_DECRYPTED&limit=5', { token: admin.token });
    assert.equal(res.status, 200);
    assert.ok(res.json.data.length > 0);
  });

  check('employee privacy centre exposes consent register', async () => {
    const res = await call('/privacy/me', { token: employee.token });
    assert.equal(res.status, 200);
    assert.equal(res.json.consents.length, 7);
    assert.ok(res.json.inventory.length >= 5);
  });

  check('employee can withdraw an optional consent', async () => {
    const res = await call('/privacy/consents', {
      method: 'PUT',
      token: employee.token,
      body: { purpose: 'analytics', granted: false },
    });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.consent.granted, false);
  });

  check('mandatory consent cannot be withdrawn', async () => {
    const res = await call('/privacy/consents', {
      method: 'PUT',
      token: employee.token,
      body: { purpose: 'payroll', granted: false },
    });
    assert.equal(res.status, 409);
  });

  check('employee can export their data (DSAR access)', async () => {
    const res = await call('/privacy/me/export', { token: employee.token });
    assert.equal(res.status, 200);
    assert.ok(res.text.includes('securevault-dsar-v1'));
  });

  check('admin toggles a data request status', async () => {
    const list = await call('/privacy/requests', { token: admin.token });
    assert.equal(list.status, 200);
    assert.ok(list.json.length > 0);
    const request = list.json.find((r) => r.status === 'pending');
    const res = await call(`/privacy/requests/${request._id}`, {
      method: 'PUT',
      token: admin.token,
      body: { status: 'in_review', resolutionNote: 'Reviewing retention obligation' },
    });
    assert.equal(res.status, 200, res.text);
  });

  check('refresh token rotation returns a new access token', async () => {
    const res = await call('/auth/refresh', { method: 'POST', cookie: admin.cookie });
    assert.equal(res.status, 200, res.text);
    assert.ok(res.json.accessToken);
  });

  check('revoked/rotated refresh token is rejected on reuse', async () => {
    const res = await call('/auth/refresh', { method: 'POST', cookie: admin.cookie });
    assert.equal(res.status, 401);
  });

  check('privacy stats are available to admin', async () => {
    const res = await call('/privacy/stats', { token: admin.token });
    assert.equal(res.status, 200);
    assert.ok(res.json.totalUsers > 0);
  });

  check('HR analytics are scoped to their department', async () => {
    const res = await call('/analytics/summary', { token: hr.token });
    assert.equal(res.status, 200);
    assert.equal(res.json.scope, 'Engineering');
  });

  let failed = 0;
  for (const { name, fn } of checks) {
    try {
      await fn();
      console.log(`PASS  ${name}`);
    } catch (error) {
      failed += 1;
      console.log(`FAIL  ${name}\n      ${error.message}`);
    }
  }

  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((error) => {
  console.error('Smoke test crashed:', error);
  process.exit(1);
});
