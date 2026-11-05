# Security Design & Threat Model — SecureVault HR

> Scope: the code in this repository, as deployed in the demo configuration.
> This document is written to be defensible in a viva: every control below points to
> the file that implements it, and every limitation is stated instead of hidden.

---

## 1. What we are protecting

| Asset | Where it lives | Why it matters |
|---|---|---|
| Salary, bank account details | `users.salary`, `users.bankDetails` (ciphertext) | High-value financial data; insider-leak target |
| Identity + employment data | `users` | Personal data under DPDP; enables social engineering |
| Leave records | `leaves` | Personal data; low sensitivity but part of the data-principal inventory |
| Consent evidence | `consents` | The organisation must *prove* lawful processing |
| Data-principal requests | `datarequests` | Statutory deadlines and legal hold |
| Access grants | `accessgrants` | Evidence of least-privilege and time-bound elevation |
| Audit trail | `auditlogs` + `auditchainstates` | Accountability; must survive attempts to edit it |
| Secrets | environment (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `AES_SECRET_KEY`) | Compromise defeats every other control |

### Trust boundaries

```
[ Browser ] --untrusted--> [ Express API ] --trusted app logic--> [ MongoDB ]
                                   |
                          [ Environment / secrets ]
```

- The **browser is untrusted**. It may run malicious extensions or an injected script.
- The **API is the only writer** to the database. All authorisation is enforced server-side.
- The **database is treated as potentially tampered-with** (operator error, stolen backup,
  direct `mongosh` edit). That assumption is why the audit trail is hash-chained.
- **Secrets are trusted but not safe by default**: the process refuses to boot with weak or
  missing values (`backend/config/env.js`).

### Assumptions / out of scope

- TLS termination and OS patching are the deployer's responsibility (we enable HSTS-ready
  headers through Helmet and set `secure` cookies in production).
- A compromised host with both the database and the encryption key is out of scope; the audit
  chain still makes silent edits detectable, but it cannot prevent them.
- No legal advice is given here; see `docs/DPDP.md` for the compliance disclaimer.

---

## 2. STRIDE threat model

Likelihood/impact are qualitative for a small-SME deployment.

| # | STRIDE | Threat scenario | Control in this codebase | Residual risk |
|---|---|---|---|---|
| 1 | **Spoofing** | Credential stuffing against `/api/auth/login` | bcrypt(12), per-account lockout after 5 failures for 15 min, IP rate limit (10 failed/15 min), failed-login audit events | Credentials reused from another breach still work until lockout |
| 2 | Spoofing | Stolen access token replayed | 15-min access token, DB re-check on every request, `tokenVersion` revocation, httpOnly refresh cookie | Token valid until expiry if stolen from memory |
| 3 | Spoofing | Forged/`alg:none` JWT | `jsonwebtoken.verify` with fixed secret, `type` claim checked (`access` vs `refresh`), issuer/audience set | Signing-key compromise defeats this (KMS roadmap) |
| 4 | **Tampering** | Admin edits salary directly in MongoDB | AES-256-GCM auth tag rejects modified ciphertext (`utils/encryption.js`); failed decrypt is logged and returns `null` | Attacker with the key can re-encrypt |
| 5 | Tampering | Operator edits/deletes audit rows to hide an action | SHA-256 hash chain + sequence + `prevHash`; `GET /api/audit-logs/verify` detects the first broken link; Merkle-root anchor receipts detect truncation | Newest rows can be deleted only if the published anchor is also rewritten; external publication is deployment work |
| 6 | Tampering | Mass-assignment (`role: "admin"`, `department`) on profile update | Field allow-lists in controllers; self-service cannot change role/department; role changes revoke sessions | — |
| 7 | Tampering | NoSQL operator injection (`{"$gt": ""}`) | `express-mongo-sanitize`-style sanitiser + `express-validator` on auth/employee/leave inputs | New endpoints must remember validators |
| 8 | **Repudiation** | "I never viewed that salary record" | `SENSITIVE_FIELDS_DECRYPTED` critical event with actor, role, IP, UA, target ids, grant flag; append-only trail | IP can be spoofed behind a proxy if trust config is wrong |
| 9 | Repudiation | HR denies approving a leave/grant | Every decision is a chained audit event with reviewer id and note | — |
| 10 | **Information disclosure** | HR browses the whole company | ABAC: HR scoped to own department, employee to self (`utils/policy.js`) | Mis-set `department` grants wrong scope; admin-managed |
| 11 | Information disclosure | HR reads salary/bank data casually | Masked by default; needs a reason-bearing, admin-approved, time-limited grant (5–480 min) | An admin can still read it (logged) |
| 12 | Information disclosure | XSS steals a persistent token | Access token kept in JS memory only; refresh token is `httpOnly` + `SameSite=Lax` + path-scoped | XSS can still act as the user while the tab is open |
| 13 | Information disclosure | Sensitive values leak into logs | Audit `details`/`metadata` log field names and ids, never plaintext | Application console logs must be reviewed |
| 14 | Information disclosure | Enumeration of valid emails | Generic "Invalid email or password"; unknown-account and bad-password paths both audit-logged | Registration reveals existing email (accepted trade-off) |
| 15 | **Denial of service** | Login/API flooding | `express-rate-limit`: 600/15 min API, 10 failed logins/15 min, 15 registrations/h, 30 sensitive ops/15 min | Single-process memory store; multi-instance needs Redis |
| 16 | DoS | Huge JSON bodies / deeply nested objects | `express.json({ limit })`, body-size cap, depth-limited sanitiser | — |
| 17 | **Elevation of privilege** | Employee self-assigns `admin` at registration | Registration hard-codes `role: 'employee'` | — |
| 18 | Elevation of privilege | Admin approves their own JIT request | Explicit self-approval check in `accessController.reviewAccess` | — |
| 19 | Elevation of privilege | HR reviews their own leave | `canReviewLeave` returns false for self | — |
| 20 | Elevation of privilege | Employee changes own department to widen scope | Department/role are admin-only; profile form marks them read-only | — |
| 21 | Elevation of privilege | Deactivated user keeps using a token | `authMiddleware` re-checks `isActive`, `isDeleted`, `tokenVersion` on every request | — |
| 22 | Elevation of privilege | HR reads the audit trail to cover tracks | Audit routes are admin-only; separation of duties documented in the access matrix | A malicious admin is still an admin |

---

## 3. Cryptographic design

### 3.1 Field encryption (`backend/utils/encryption.js`)

- **Algorithm:** AES-256-GCM (authenticated encryption: confidentiality + integrity).
- **Key:** `SHA-256(keyId + ":" + AES_SECRET_KEY)` → 32 bytes. Deriving with the key id means a
  rotated key never equals the old key even if the operator reuses a passphrase.
- **IV:** fresh 96-bit random IV per encryption (GCM recommendation). Never reused.
- **AAD:** `securevault:v2:<keyId>` binds the ciphertext to its format and key.
- **Payload:** `v2:<keyId>:<ivHex>:<authTagHex>:<ciphertextHex>`.
- **Rotation:** set `AES_SECRET_KEY_PREVIOUS` + `AES_KEY_ID_PREVIOUS`, deploy the new
  `AES_SECRET_KEY`/`AES_KEY_ID`, then run `npm run rotate:encryption`. Reads still work for the
  previous key id during the migration window.
- **Legacy:** v1 used AES-256-CBC (`ivHex:ciphertextHex`). It is still readable so existing data is
  not lost, but every new write is v2. CBC has no integrity check; that is why it is legacy-only.
- **Failure mode:** `safeDecrypt` returns `null` and logs a warning instead of throwing, so one
  corrupt row cannot break an entire directory page.

### 3.2 Why GCM instead of CBC

CBC hides data but cannot tell you whether it was modified. GCM's authentication tag makes a
single bit-flip fail decryption. For salary/bank data, *integrity is part of confidentiality*: a
silently modified salary is a fraud vector, not just a display bug.

### 3.3 Password storage

- bcrypt with cost 12; hashes never leave the server (`toJSON` strips `password`).
- Password change bumps `tokenVersion`, clears the refresh hash and clears the cookie.

### 3.4 Practical limits (stated honestly)

- Keys live in environment variables, not a KMS/HSM. A host compromise exposes them.
- Key rotation is per-key-id, not automatic; it is an operator runbook.
- No field-level per-user keys (envelope encryption is roadmap work).

---

## 4. Tamper-evident audit trail (`backend/utils/auditChain.js`)

### 4.1 Record shape

Every event commits to:

```
sequence | actor | actorName | actorEmail | actorRole | action | category | severity
targetId | targetType | details | metadata | ip | userAgent | createdAt | prevHash | hash
```

`hash = SHA-256(canonicalJSON(record without hash))`. Canonicalisation sorts keys, normalises
dates to ISO strings, ObjectIds to strings, and empty objects to `null` (MongoDB may omit them).
That makes verification deterministic across driver versions.

The head is stored in `auditchainstates` (`_id: "primary"`, `sequence`, `lastHash`). Appends are
serialised in-process so two concurrent requests cannot read the same `lastHash`.

### 4.2 Append-only enforcement

- Mongoose pre-hooks reject `updateOne`, `updateMany`, `findOneAndUpdate`, `deleteOne`,
  `deleteMany`, `findOneAndDelete` and `save()` on an existing document.
- The application therefore cannot rewrite history through normal code paths.
- Direct database edits are still possible for an operator — which is exactly what verification
  is for.

### 4.3 Verification algorithm

1. Read records sorted by `sequence`.
2. Expect sequence `1..N` with no gaps.
3. Expect `prevHash` of record *i* to equal `hash` of record *i-1* (`GENESIS` for the first).
4. Recompute `hash` from the stored fields and compare.
5. Confirm the final hash matches the stored chain head (`coversLatest`).

Failure returns `valid: false`, `brokenAtSequence` and a human-readable reason.

### 4.4 What this does and does not prove

**Does:** any edit to a stored audit row is detected on the next verification; deletion of a
middle row creates a sequence gap; reordering breaks `prevHash`.

**Does not:** prevent an attacker with database access from deleting the newest rows and rolling
the head back. That is why this is called *tamper-evident*, not *tamper-proof*. The project now
emits a **Merkle-root anchor receipt** (§4.6); publishing that receipt outside the database
(S3 Object Lock, an RFC 3161 timestamp, or a public transparency log) closes the truncation gap.
The receipt workflow is implemented; automated publication is deployment work.

### 4.5 Operational notes

- The chain is serialised **in-process**. A multi-instance deployment needs a distributed lock
  or a transactional counter; this is a documented scale-up step, not a hidden bug.
- Verification is capped at 10,000 records per call to bound memory. For larger trails, verify in
  windows and anchor each window's head.
- Audit failure is logged to stderr but does not crash the request (`auditLogger.js`). In
  production this should page an operator instead.

### 4.6 Anchor receipts (closing the truncation gap)

`GET /api/audit-logs/anchor` (admin) and `npm run anchor:chain` produce a portable receipt:

```json
{
  "anchorFormat": "securevault-anchor-v1",
  "sequenceFrom": 1,
  "sequenceTo": 42,
  "recordCount": 42,
  "merkleRoot": "<64 hex chars>",
  "chainValid": true
}
```

- The Merkle root commits to every record hash in the range, so one 32-byte value proves the
  state of the trail.
- `npm run anchor:verify -- <receipt.json>` recomputes the root and re-verifies the chain.
  A tampered or truncated trail returns `ANCHOR MISMATCH`.
- The remaining step is **publication**: commit the receipt, or push it to S3 Object Lock /
  an RFC 3161 timestamp, so a database operator cannot rewrite both the data and the anchor.
  The receipt workflow is implemented; only the external store is deployment work.

---

## 5. Authentication and session lifecycle

| Concern | Implementation |
|---|---|
| Access token | JWT, 15 min, memory only, `type: access`, issuer/audience set |
| Refresh token | JWT, 7 days, `httpOnly` cookie, `SameSite=Lax`, `path=/api/auth`, `secure` in production |
| Rotation | Every refresh issues a new refresh token and stores only its SHA-256 hash; the old token stops working |
| Reuse detection | A refresh whose hash does not match the stored hash is rejected ("already used or revoked") |
| Revocation | `tokenVersion` claim compared to the DB on every access and refresh; bumped on password change, role change, deactivation, delete |
| Lockout | 5 failed passwords → 15-minute account lock; IP also limited to 10 failed logins/15 min |
| Logout | Clears the refresh hash server-side and clears the cookie |
| CSRF posture | Refresh is a `SameSite=Lax` cookie scoped to `/api/auth`; the API uses a bearer token, not an ambient cookie, for normal calls. A production deployment should still add an explicit CSRF token if it adds cookie-authenticated state-changing routes |

**Why the access token is not in localStorage:** an XSS payload can read localStorage forever;
it can only read an in-memory token while the page is open, and cannot read the httpOnly refresh
cookie at all. This mitigates XSS, it does not eliminate it — output encoding and a CSP are still
required (Helmet sets a baseline CSP; tune it for the deployed frontend).

---

## 6. Authorisation model (RBAC + ABAC)

`backend/utils/policy.js` is the single policy module. Deny-by-default: an unknown role, a
missing department, or a missing target never grants access.

| Capability | Admin | HR Manager | Employee |
|---|---|---|---|
| View employee directory | All | Own department | Self only |
| Edit employee | All | Own department | Self (name/designation only) |
| View salary / bank | Yes (logged) | Masked; needs JIT grant | Own only |
| Create employee | Yes | No | No |
| Review leave | All | Own department, not self | No |
| View/verify audit trail | Yes | No | No |
| Resolve consent / DSAR | Yes | No | Own consents/requests |
| Approve JIT access | Yes (not own) | No | No |

Additional rules enforced in code:

- **Separation of duties:** the operator is not the auditor (HR cannot read the audit trail);
  an admin cannot approve their own access request; an HR manager cannot approve their own leave.
- **Self-scope protection:** users cannot change their own `role` or `department`, because that
  would let them widen their ABAC scope.
- **JIT elevation:** HR's sensitive-field access requires a reason, an admin review and an
  expiry (5–480 minutes). `getActiveGrant` expires stale grants before answering, so an expired
  grant cannot be used even if no cron job ran.
- **Masking is server-side:** the API returns `••••••` plus `salaryMasked: true`; the browser is
  never trusted to hide a value it received.

---

## 7. Input, output and transport hardening

- **Helmet** for security headers; CORS is an explicit allow-list (no `*` in production).
- **Body limit** and JSON-only parsing; central error handler avoids stack traces in responses.
- **Validation:** `express-validator` rules for register, login, password change, employee
  create/update, leave apply/review, consent, DSAR and access requests. Errors return 422 with
  field-level messages.
- **Sanitisation:** keys beginning with `$` or containing `.` are stripped; prototype-pollution
  keys (`__proto__`, `constructor`, `prototype`) are removed. Depth is limited.
- **Rate limiting** per route class (API, login, register, sensitive operations).
- **Object-level checks:** every `/:id` route loads the target and calls the policy function
  before reading or writing; ids are validated as Mongo ObjectIds by Mongoose casts.
- **File handling:** the only file-like response is the DSAR JSON export, generated server-side
  with `Content-Disposition: attachment` and a fixed filename — no user-controlled path.

---

## 8. OWASP Top 10 (2021) mapping

| Risk | How this project addresses it | Gap |
|---|---|---|
| A01 Broken Access Control | Central ABAC policy, server-side scoping, self/role/department checks, admin-only audit & DSAR routes, 403 on cross-scope ids | No automated authorisation matrix test for every route yet |
| A02 Cryptographic Failures | AES-256-GCM with per-record IV + auth tag + AAD; bcrypt(12); secrets fail-fast; legacy CBC read-only | Keys in env, no KMS/HSM |
| A03 Injection | Mongoose parameterisation, `express-validator`, `$`/dot/prototype sanitiser, regex metacharacters escaped before building search filters | New endpoints must remember validators |
| A04 Insecure Design | Threat model, least privilege, separation of duties, JIT access, legal hold, explicit limitations | No formal abuse-case review each sprint |
| A05 Security Misconfiguration | Helmet, CORS allow-list, env validation, `secure` cookies in prod, no default secrets | Deployment checklist is manual |
| A06 Vulnerable Components | Small dependency set; `npm run security:audit` (`npm audit --omit=dev`) | No automated Dependabot/Snyk in CI |
| A07 Identification & Authentication Failures | bcrypt, lockout, rotating refresh, tokenVersion, generic errors, audit of auth events | No MFA/WebAuthn yet (roadmap) |
| A08 Software & Data Integrity Failures | Hash-chained audit, authenticated ciphertext, lockfile | No signed releases / SBOM |
| A09 Security Logging & Monitoring Failures | Structured audit trail, critical sensitive-read events, chain verification, `/api/health` posture | No SIEM/alerting integration yet |
| A10 SSRF | No user-supplied URL fetching in the app | — |

---

## 9. Testing evidence

| Command | What it proves |
|---|---|
| `npm test` (backend) | 24 unit tests: GCM round-trip/tamper rejection/key-id, hash-chain determinism and break detection, Merkle-root determinism and order-sensitivity, retention eligibility, ABAC policy decisions |
| `npm run smoke` | 23 end-to-end checks against a running API: login, scoping, masking, JIT, DSAR, audit verify, anchor receipt, compliance pack |
| `npm run tamper:demo` | Edits an audit row directly in MongoDB and shows verification fail at that sequence |
| `npm run anchor:chain` + `anchor:verify` | Produces a Merkle-root receipt, then re-checks it; a tampered trail returns `ANCHOR MISMATCH` |
| `npm run retention:run` / `retention:apply` | Dry-run and apply the retention sweep; anonymises only records past their statutory window |
| `npm run seed:reset` | Restores a clean, deterministic demo state |
| `npm run rotate:encryption` | Re-encrypts rows with the active key id (rotation runbook) |
| `npm run build` (frontend) | Production build compiles; lint is clean apart from one documented warning |

The tamper demo and the anchor proof are the strongest viva artefacts: they convert
"we have audit logs" into "we can prove an edit happened and a receipt covers the trail".

---

## 10. Known limitations (and the roadmap that fixes them)

1. **Tamper-evident, not tamper-proof** — anchor receipts exist; automated publication to an
   append-only store remains. → Publish the Merkle root to S3 Object Lock / an RFC 3161 timestamp.
2. **Single-instance chain lock** — in-process queue. → Redis/Postgres advisory lock or a
   transactional outbox.
3. **Keys in environment** — → AWS KMS / HashiCorp Vault envelope encryption, per-tenant data keys.
4. **No MFA/WebAuthn** — → passkeys for admin and HR accounts (highest-value accounts first).
5. **No multi-tenancy** — one deployment per SME today. → tenant id on every collection + row-level
   policy, or database-per-tenant.
6. **No SIEM integration** — → ship critical events to CloudWatch/Loki and alert on chain
   verification failure or sensitive-read spikes.
7. **Retention needs a scheduler** — the sweep is runnable (`npm run retention:apply`) but not yet
   scheduled in the deployment. → cron/worker with alerting on failure.
8. **No CSP tuning for the SPA** — Helmet's default CSP may need explicit asset/connect sources.
9. **Audit verification is capped at 10k records per call** — → windowed verification with anchors.
10. **Rate-limit store is in-memory** — → Redis store for multi-instance deployments.

Every one of these is deliberate: shipping a claim without the control behind it would be worse
than documenting the gap.

---

## 11. Responsible disclosure

This is an academic reference implementation, not a production service. If you find a flaw,
open a private security advisory on the repository rather than a public issue, and include a
minimal reproduction. Do not test against data you do not own.
