# SecureVault HR

**A DPDP-ready Employee Data Trust Layer for Indian SMEs** — not another HRMS.

> Most employee-management projects demonstrate CRUD. SecureVault demonstrates **data governance**:
> authenticated field-level encryption, verifiable consent, a tamper-evident access trail,
> and data-principal rights a person can actually exercise.

---

## 1. Why this project exists

A 200-person Indian SME typically keeps employee data across spreadsheets, WhatsApp, a payroll
vendor and an HR portal. That creates four concrete failures:

| Failure | What it costs the business |
|---|---|
| No consent record tied to a purpose | Cannot prove lawful processing when a data principal or regulator asks |
| Salary / bank data readable by anyone with DB or admin access | Insider leak, no forensic trail |
| Audit logs stored as ordinary rows | An operator or attacker can edit them; "immutable" is a claim, not a control |
| Access/erasure requests handled by email | Days of manual work, no SLA, no evidence |

India's **Digital Personal Data Protection Act, 2023** (with rules being phased in) puts
significant obligations on employers as *data fiduciaries*, and penalties for failing to
implement reasonable security safeguards can reach **₹250 crore**. Large consultancies are
priced out of an SME's budget. SecureVault is the small, verifiable layer that fills that gap.

**Positioning:** the trust layer that sits beside (or on top of) an HRMS — starting with the
highest-risk data an SME holds: salary, bank details, identity data and access history.

---

## 2. What is actually implemented (not slideware)

### 2.1 Authenticated field encryption
- **AES-256-GCM** for `salary` and `bankDetails` (confidentiality **and** integrity).
- Fresh 96-bit IV per record; auth tag stored with the ciphertext; AAD binds version + key id.
- Payload format `v2:<keyId>:<iv>:<tag>:<ciphertext>` enables **key rotation** without a
  big-bang migration (`scripts/rotate-encryption.js`).
- Legacy AES-CBC values from v1 are still readable, so no data is lost.
- **Fail-fast configuration**: the server refuses to start with missing/short secrets
  (`config/env.js`) instead of silently using a public default.

### 2.2 Tamper-evident audit trail
- Every event is appended with `sequence`, `prevHash` and `hash = SHA-256(canonical record)`.
- `GET /api/audit-logs/verify` recomputes the entire chain and reports the first broken link.
- Application-level append-only guards block update/delete through Mongoose; the chain catches
  direct database edits (demonstrated by `scripts/tamper-demo.js`).
- Denormalised actor identity means the trail survives user deletion/anonymisation.

### 2.3 Sensitive-read logging
- Viewing the employee directory and **every decryption** of salary/bank fields creates an
  audit event (`SENSITIVE_FIELDS_DECRYPTED`, severity `critical`) with actor, role, IP,
  user agent, target ids and whether access came through a grant.

### 2.4 Consent register + data-principal rights (DPDP)
- Seven purposes: `core_hr`, `payroll`, `statutory_compliance`, `benefits`,
  `background_verification`, `analytics`, `marketing`.
- Each consent records lawful basis, mandatory flag, notice version, grant/withdraw time,
  IP, user agent and evidence string.
- Mandatory purposes (contract / legal obligation) cannot be withdrawn while employed;
  optional purposes can be withdrawn anytime.
- **My Data** page: data inventory, purpose + retention per field, consent toggles,
  JSON export, correction / erasure / grievance requests, access matrix, recent audit events
  about the user.
- Erasure respects **statutory payroll retention**: the request is recorded with a legal hold
  and only anonymised after the retention window.

### 2.5 ABAC + just-in-time elevation
- RBAC alone is not enough: an HR manager is additionally scoped to **their own department**.
- Employees can read only themselves.
- Salary/bank fields are **masked** for HR by default. Sensitive access requires a
  reason-bearing, admin-approved grant that **expires automatically** (5–480 minutes).
- An admin cannot approve their own request; a manager cannot review their own leave.
- Employees cannot change their own department (prevents scope escalation).

### 2.6 Session and transport hardening
- Short-lived **access token kept in memory** (never localStorage) — an XSS payload cannot
  read a persistent token.
- **httpOnly, SameSite=Lax refresh cookie** scoped to `/api/auth`, with **rotation on every
  refresh** and reuse rejection.
- **`tokenVersion` revocation**: password change, role change, deactivation, deletion and
  soft delete invalidate existing sessions immediately.
- Account lockout after repeated failed logins; all auth events are audit-logged.
- Helmet, CORS allowlist, request body limit, rate limits (API, login, register, sensitive
  actions), NoSQL/prototype-pollution sanitisation, central error handler.
- Soft delete + retention date instead of destructive deletion; admin restore endpoint.

### 2.7 Evidence, not claims
- `backend/tests/` — 24 unit tests for crypto, hash chain, Merkle anchoring, retention
  eligibility and authorisation policy.
- `backend/scripts/smoke.js` — 23 end-to-end checks against a running API (including the
  anchor receipt and compliance pack).
- `backend/scripts/tamper-demo.js` — edits an audit row directly in MongoDB and proves
  verification fails.
- `backend/scripts/anchor-chain.js` — publishes a Merkle-root receipt and later proves whether
  the trail still matches it.
- `backend/scripts/retention-run.js` — dry-run/apply retention sweep with audit events.
- `docs/SECURITY.md` — STRIDE threat model, OWASP Top 10 mapping, explicit limitations.

---

## 3. Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│ React SPA (Vite + Tailwind)                                        │
│  Login · Dashboard · Employees · Leaves · My Data · Security Center│
│  Access token in memory  +  httpOnly refresh cookie                │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ HTTPS / JSON
┌──────────────────────────────▼─────────────────────────────────────┐
│ Express API                                                        │
│  helmet · CORS allowlist · rate limits · sanitisation · errors     │
│                                                                    │
│  auth ──► tokenService (access + rotating refresh, tokenVersion)   │
│  rbac ──► policy.js (role + department + self + separation of duty)│
│  jit  ──► AccessGrant (reason, approver, expiry)                   │
│  priv ──► Consent + DataRequest (DSAR, legal hold, 30-day SLA)     │
│  audit──► auditChain (sequence + prevHash + SHA-256)               │
│  crypto─► AES-256-GCM (per-record IV, auth tag, key id)            │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
                     ┌─────────▼─────────┐
                     │ MongoDB Atlas     │
                     │ users (encrypted) │
                     │ auditlogs (chain) │
                     │ consents, requests│
                     └───────────────────┘
```

Trust boundaries: browser is untrusted; the API is the only writer; the database is treated as
**potentially compromised or operator-tampered** (hence the chain). Key material lives in the
environment today and is designed to move to a KMS/HSM (see roadmap).

---

## 4. Quick start

**Prerequisites:** Node.js 20+, a MongoDB connection string.

```bash
# 1. Backend
cd backend
npm install
copy .env.example .env        # Windows (cp on macOS/Linux)
# set MONGO_URI, then generate secrets:
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log('AES_SECRET_KEY=' + require('crypto').randomBytes(48).toString('base64url'))"

npm run seed:reset            # demo accounts + data + audit chain
npm run dev                   # http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

The backend **fails fast** if `JWT_SECRET`, `JWT_REFRESH_SECRET` or `AES_SECRET_KEY` are missing
or shorter than 32 characters. That is intentional.

### Demo accounts — password `Demo@2026!`

| Email | Role | Department | Demonstrates |
|---|---|---|---|
| `admin@securevault.demo` | Admin | Leadership | Full scope, decryption logging, Security Center, DSAR admin |
| `hr@securevault.demo` | HR Manager | Engineering | Department-only scope, masked salary, JIT request |
| `hr.finance@securevault.demo` | HR Manager | Finance | Independent department scope |
| `neha@securevault.demo` | Employee | Engineering | Self-service, My Data, export / erasure |
| `kabir@securevault.demo` | Employee | Engineering | Peer employee (invisible to other employees) |
| `ananya@securevault.demo` | Employee | Finance | Cross-department isolation |
| `vikram@securevault.demo` | Employee | Sales | Seeded erasure request under legal hold |
| `meera@securevault.demo` | Employee | Engineering | Additional directory data |

---

## 5. API surface

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `/login`, `/refresh`, `/logout`; `GET /me`; `PUT /password` |
| Employees | `GET /api/employees` (paged + search), `POST /`; `GET/PUT /me`; `GET/PUT /:id`; `DELETE /:id` (soft); `POST /:id/restore` |
| Leaves | `GET /api/leaves` (scoped), `GET /me`, `GET /summary`; `POST /`; `DELETE /:id`; `PUT /:id/review` |
| Audit | `GET /api/audit-logs` (filters + pagination), `GET /verify`, `GET /stats` |
| Analytics | `GET /api/analytics/summary` (department-scoped) |
| Privacy | `GET /api/privacy/me`, `PUT /consents`, `GET /me/export`, `POST /erasure`, `POST /requests`, `GET /requests/me`, `GET /access-matrix`; admin: `GET /requests`, `PUT /requests/:id`, `GET /stats` |
| Access | `POST /api/access/requests`, `GET /requests/me`, `GET /active`; admin: `GET /requests`, `PUT /requests/:id/review`, `DELETE /requests/:id` |
| Health | `GET /api/health` (encryption + chain state) |

Employee list response shape:

```json
{
  "data": [
    {
      "id": "...", "name": "Neha Iyer", "email": "neha@securevault.demo",
      "role": "employee", "department": "Engineering",
      "salary": "••••••", "salaryMasked": true,
      "bankDetails": "••••••", "bankDetailsMasked": true,
      "sensitiveAccessViaGrant": false, "isActive": true, "isDeleted": false
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 8, "pages": 1 },
  "access": { "sensitiveMasked": true, "viaGrant": false, "scope": "Engineering" }
}
```

Audit list response shape:

```json
{
  "data": [ { "sequence": 12, "action": "SENSITIVE_FIELDS_DECRYPTED", "actorName": "...", "hash": "...", "prevHash": "..." } ],
  "pagination": { "page": 1, "limit": 50, "total": 18, "pages": 1 },
  "chain": { "sequence": 18, "lastHash": "...", "totalRecords": 18 }
}
```

---

## 6. Testing and evidence

```bash
cd backend
npm test               # 24 unit tests (node --test)
npm run seed:reset     # clean demo data
npm run smoke          # 23 end-to-end checks (server must be running)
npm run tamper:demo    # proves the audit chain detects edits, then reseed
npm run anchor:chain   # publish a Merkle-root receipt for the current chain
npm run anchor:verify -- "..\docs\anchors\chain-anchor-000006.json"
npm run retention:run  # dry run: who is past retention, which DSARs are overdue
npm run retention:apply    # anonymise records whose retention window ended
npm run rotate:encryption  # re-encrypt with the active key id
```

`npm run tamper:demo` output (expected):

```
Before tampering: valid=true (18 records)
Tampered with audit record sequence=8 (action=SENSITIVE_FIELDS_DECRYPTED)
After tampering:  valid=false
Detected at sequence 8: Hash mismatch: this record was altered after it was written
```

After running it, **always** run `npm run seed:reset` before a demo.

---

## 7. Documentation

- [`docs/SECURITY.md`](docs/SECURITY.md) — threat model (STRIDE), controls, OWASP mapping, crypto/audit design, limitations.
- [`docs/DPDP.md`](docs/DPDP.md) — DPDP obligation-to-implementation mapping, consent model, DSAR lifecycle, retention.
- [`docs/DEMO.md`](docs/DEMO.md) — 7–8 minute demo script with exact clicks and expected output.
- [`docs/PRESENTATION.md`](docs/PRESENTATION.md) — 10-slide narrative, metrics, likely viva questions and answers.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what is deliberately deferred (KMS, WebAuthn, multi-tenancy, post-quantum, private RAG).

---

## 8. Honest limitations

- The audit chain is **tamper-evident, not tamper-proof**: an attacker with DB access can delete
  the newest records; the chain proves *that* records were altered but cannot prevent it.
  The app can now emit a Merkle-root anchor receipt (`npm run anchor:chain`) that can be
  published outside MongoDB; automated publication to an append-only log is roadmap work.
- Chain appends are serialised **in-process**; a multi-instance deployment needs a distributed
  lock or transactional counter.
- Encryption keys live in the environment today (no KMS/HSM yet).
- Access tokens are held in JS memory, which mitigates — not eliminates — XSS.
- Retention is enforced by a runnable sweep (`npm run retention:apply`), not yet by a scheduler
  in the deployment.
- `DPDP.md` maps controls to the Act; it is **not legal advice** and specific Rules/timelines
  should be verified against the latest official notification before citing them.
- No WebAuthn passkeys, no multi-tenancy, no differential privacy yet — deliberately deferred
  and documented.

---

## 9. Academic context

Final-year project. The contribution is not "an HRMS"; it is a **reference implementation of
employee-data trust controls** that can be evaluated against a regulation, a threat model and
a measurable demo. Built with Node.js, Express, MongoDB, Mongoose, React, Vite, Tailwind CSS,
Chart.js and Node's built-in test runner.
