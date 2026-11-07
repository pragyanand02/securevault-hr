/* eslint-disable no-console */
// Core Smoke Test matching the SOP scope (Auth, RBAC, Employees, Masking, JIT Access, Leaves, Audit)
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
  try { json = JSON.parse(text); } catch { /* ignore */ }

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
  return { token: result.json.accessToken, cookie: result.cookie };
};

const run = async () => {
  const checks = [];
  const check = (name, fn) => checks.push({ name, fn });

  check('Health endpoint reports encryption + audit chain', async () => {
    const res = await call('/health');
    assert.equal(res.status, 200);
    assert.equal(res.json.encryption.algorithm, 'aes-256-gcm');
    assert.ok(res.json.auditChain.totalRecords > 0);
  });

  const admin = await login('admin@securevault.demo');
  const hr = await login('hr@securevault.demo');
  const employee = await login('neha@securevault.demo');

  check('Admin sees decrypted sensitive fields (Salary/Bank)', async () => {
    const res = await call('/employees?limit=5', { token: admin.token });
    assert.equal(res.status, 200);
    assert.equal(res.json.access.sensitiveMasked, false);
    assert.ok(res.json.data.some((e) => e.salary && e.salary !== '••••••'));
  });

  check('HR sees masked sensitive fields by default', async () => {
    const res = await call('/employees?limit=5', { token: hr.token });
    assert.equal(res.status, 200);
    assert.equal(res.json.access.sensitiveMasked, true);
    assert.ok(res.json.data.every((e) => e.salary === '••••••'));
  });

  check('HR cannot see employees outside their department (RBAC/ABAC)', async () => {
    const res = await call('/employees', { token: hr.token });
    assert.equal(res.status, 200);
    assert.ok(res.json.data.every((e) => e.department === 'Engineering'));
  });

  check('HR cannot access the audit trail', async () => {
    const res = await call('/audit-logs', { token: hr.token });
    assert.equal(res.status, 403);
  });

  check('Employee cannot list employee directory', async () => {
    const res = await call('/employees', { token: employee.token });
    assert.equal(res.status, 403);
  });

  let grantId;
  check('HR raises a JIT temporary access request', async () => {
    const res = await call('/access/requests', {
      method: 'POST',
      token: hr.token,
      body: { reason: 'Payroll verification for monthly cycle' },
    });
    assert.ok([201, 409].includes(res.status));
    grantId = res.json.grant?._id || res.json.grant?.id;
  });

  check('Admin approves the JIT request', async () => {
    if (!grantId) {
      const list = await call('/access/requests', { token: admin.token });
      const pending = list.json.find((g) => g.status === 'pending');
      grantId = pending?._id;
    }
    if (grantId) {
      const res = await call(`/access/requests/${grantId}/review`, {
        method: 'PUT',
        token: admin.token,
        body: { status: 'approved', durationMinutes: 30 },
      });
      assert.equal(res.status, 200);
    }
  });

  check('HR can see sensitive fields after approval (temporary grant active)', async () => {
    const res = await call('/employees', { token: hr.token });
    assert.equal(res.status, 200);
    assert.equal(res.json.access.viaGrant, true);
    assert.ok(res.json.data.some((e) => e.salary && e.salary !== '••••••'));
  });

  check('Audit hash chain verifies successfully', async () => {
    const res = await call('/audit-logs/verify', { token: admin.token });
    assert.equal(res.status, 200);
    assert.equal(res.json.valid, true);
  });

  check('Sensitive decryptions are logged in audit trail', async () => {
    const res = await call('/audit-logs?action=SENSITIVE_FIELDS_DECRYPTED', { token: admin.token });
    assert.equal(res.status, 200);
    assert.ok(res.json.data.length > 0);
  });

  check('Employee can apply for leave', async () => {
    const res = await call('/leaves', {
      method: 'POST',
      token: employee.token,
      body: {
        leaveType: 'sick',
        startDate: '2026-11-20',
        endDate: '2026-11-21',
        reason: 'Medical checkup',
      },
    });
    assert.equal(res.status, 201);
  });

  check('HR Analytics are scoped and returned', async () => {
    const res = await call('/analytics/summary', { token: hr.token });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json.departmentCounts));
    assert.ok(Array.isArray(res.json.leaveStatusCounts));
  });

  let passed = 0;
  for (const { name, fn } of checks) {
    try {
      await fn();
      console.log(`PASS  ${name}`);
      passed += 1;
    } catch (err) {
      console.error(`FAIL  ${name}\n      ${err.message}`);
    }
  }

  console.log(`\n${passed}/${checks.length} core checks passed`);
  if (passed !== checks.length) process.exit(1);
};

run().catch((err) => {
  console.error('Smoke suite crashed:', err);
  process.exit(1);
});
