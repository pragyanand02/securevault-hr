# Presentation Deck & Viva Pack — SecureVault HR

**One-line positioning:** *A DPDP-ready employee data trust layer for Indian SMEs — the governance
underneath an HRMS, not another HRMS.*

Use 10 slides. Put the demo in the middle (slide 5→6) so the audience sees evidence before the
architecture details. Keep slides sparse; the detail lives in `docs/SECURITY.md` and `docs/DPDP.md`.

---

## 30-second elevator pitch

> Indian SMEs are Data Fiduciaries under DPDP, but they keep salary and bank data in spreadsheets
> and portals where any admin can read it and any log can be edited. Enterprise privacy tools are
> priced for large firms. SecureVault is a small trust layer: authenticated field encryption,
> a purpose-bound consent register, a tamper-evident audit trail, and a data-principal rights
> workflow. It is not a bigger HRMS — it is the evidence layer an SME can actually run.

---

## Slide 1 — Title

**On slide**

- SecureVault HR
- A DPDP-ready Employee Data Trust Layer for Indian SMEs
- Final-year project · 2026–27
- Name · Roll number · Guide

**Say:** "My project is not an employee-management CRUD app. It is the trust layer that sits
beside one, built around the data an SME is most afraid of losing: salary, bank details, identity
and access history."

---

## Slide 2 — The problem (motive)

**On slide**

- SME employee data lives in spreadsheets, WhatsApp, payroll vendors and portals.
- DPDP 2023 makes the employer a **Data Fiduciary**.
- Penalty schedule can reach **₹250 crore** for inadequate security safeguards.
- Enterprise privacy suites are priced out of an SME's budget.
- Result: **no consent evidence, no read accountability, no provable audit trail, manual DSARs.**

**Say:** "The motive is not 'digitise HR'. It is that the smallest companies now carry the same
legal obligations as the largest, without the same budget. The gap is not features — it is
evidence."

**If asked "why now?":** the Rules are being phased in; SMEs are being asked for consent records,
retention policies and grievance handling before they have any tooling for it.

---

## Slide 3 — Why existing systems fail

**On slide** — four concrete failures, not generic complaints

| Failure | Consequence |
|---|---|
| Consent is a checkbox in a form, not a register | Cannot prove lawful processing to a Data Principal or the Board |
| Salary/bank readable by anyone with DB or admin access | Insider leak; no forensic trail |
| Audit logs are ordinary rows | An operator or attacker can edit them; "immutable" is a claim |
| DSARs handled by email | No SLA, no legal-hold logic, no evidence of resolution |

**Say:** "A normal HRMS checks every box on the left and fails every row on the right. The
contribution is the right-hand column."

---

## Slide 4 — The insight and the scope

**On slide**

- Not "an HRMS with security features".
- A **reference implementation of employee-data trust controls**:
  1. authenticated encryption for high-risk fields,
  2. purpose-bound consent with evidence,
  3. a tamper-evident access trail,
  4. enforceable data-principal rights,
  5. least privilege with time-bound elevation.
- Evaluated against a regulation, a threat model, and a **reproducible demo**.

**Say:** "I deliberately did not build performance reviews, recruitment or payroll calculation.
Those are commodities. The defensible part is the governance layer, and it can be dropped beside
any existing HRMS."

---

## Slide 5 — Architecture

**On slide** — simplified

```
React SPA (Vite + Tailwind)
  access token in memory · httpOnly refresh cookie
        │  HTTPS / JSON
Express API
  helmet · CORS allow-list · rate limits · validation · sanitisation
  ┌──────────────┬───────────────┬────────────────┬──────────────┐
  │ auth/session │ RBAC + ABAC   │ JIT grants     │ DPDP rights  │
  │ tokenVersion │ policy.js     │ reason+expiry  │ consent+DSAR │
  └──────────────┴───────────────┴────────────────┴──────────────┘
  ┌──────────────────────────┬───────────────────────────────────┐
  │ AES-256-GCM field crypto │ SHA-256 chained audit trail       │
  └──────────────────────────┴───────────────────────────────────┘
        │
MongoDB (ciphertext for salary/bank, append-only audit)
```

**Say:** "Two things are unusual. The database is treated as potentially tampered-with, which is
why the audit trail is chained. And authorisation is not just a role check — it is role plus
department plus self plus separation of duties, in one policy module."

**Demo hand-off:** "Let me show the two highest-value controls rather than describe them."

---

## Slide 6 — Handling #1: authenticated encryption

**On slide**

- AES-256-GCM for `salary` and `bankDetails`
- Fresh 96-bit IV per record; auth tag stored with ciphertext
- AAD binds format version + key id
- Format `v2:<keyId>:<iv>:<tag>:<ciphertext>` → **key rotation without a big-bang migration**
- Legacy AES-CBC read support so no data is lost
- Fail-fast: the server refuses to boot with missing/short secrets

**Say:** "CBC hides data but cannot detect modification. GCM's tag makes a one-bit change fail —
for salary data, integrity is part of confidentiality."

**Demo pointer:** admin → Employees shows plaintext only because the admin role decrypts and
**logs** it; HR sees `••••••`.

**Viva trap:** "Why not just use MongoDB CSFLE?" → "CSFLE is a valid alternative and would
protect at-rest bytes, but it does not give me field-level masking, JIT approval or an audit event
per decryption in the application layer. I chose application-level crypto for control and
portability; CSFLE/KMS is the production hardening path."

---

## Slide 7 — Handling #2: tamper-evident audit

**On slide**

- Every event: `sequence`, `prevHash`, `hash = SHA-256(canonical record)`
- Append-only guards in Mongoose
- `GET /api/audit-logs/verify` recomputes the whole chain
- Detects: edits (hash mismatch), deletion (sequence gap), reordering (`prevHash` break)
- **Tamper-evident, not tamper-proof** — stated on the slide

**Demo (the money shot):** run `npm run tamper:demo`.
It edits an audit row **directly in MongoDB**, bypassing application guards, then verifies:

```
Before: valid=true
Tampered sequence=X
After:  valid=false
Detected at X: Hash mismatch: this record was altered after it was written
```

**Say:** "This is the difference between claiming immutability and proving an edit happened.
The next step is external anchoring — publish the chain head to an append-only store so even the
newest rows cannot be silently rolled back."

---

## Slide 8 — Handling #3: least privilege + JIT

**On slide**

- RBAC: admin / HR manager / employee
- ABAC: HR scoped to **own department**; employee to **self**
- Salary/bank **masked** for HR by default
- Sensitive access requires: reason → admin approval → **5–480 minute expiry**
- Separation of duties: no self-approval; HR cannot read the audit trail; no self-department change
- Every sensitive read = **critical** audit event (actor, IP, target ids, grant flag)

**Demo pointer:** HR sees 4 Engineering employees and `••••••`; admin approves a 60-minute grant;
HR's page flips to plaintext with an amber "grant active" banner.

**Say:** "This is the answer to 'handling': the permission is not a role, it is a reviewed,
expiring, logged decision."

---

## Slide 9 — Handling #4: DPDP rights that actually work

**On slide**

- **7 purposes** with lawful basis, mandatory flag, notice version, IP/UA evidence
- Optional purposes withdrawable; mandatory withdrawal blocked with an explanation
- **My Data:** inventory, purpose, retention, encrypted-at-rest flags, access matrix
- **Export:** machine-readable JSON (`securevault-dsar-v1`) + `DATA_EXPORTED` audit event
- **DSAR:** access / correction / erasure / grievance, 30-day due date, overdue flags
- **Legal hold:** erasure is deferred while statutory payroll retention applies, then anonymised
- **Audit:** consent grants/withdrawals and every DSAR transition are chained events

**Demo pointer:** Neha's My Data page → toggle consent → export JSON → raise erasure →
admin defers under legal hold.

**Say:** "Most projects stop at 'we have a consent checkbox'. The defensible version is evidence:
who consented, to what purpose, under which notice, from where, and what happened when they
withdrew."

---

## Slide 10 — Evidence, limits, roadmap

**On slide — left: evidence**

| Metric | Value |
|---|---|
| Unit tests (`node --test`) | 14 / 14 |
| End-to-end smoke checks | 20 / 20 |
| Tamper detection | verified at the edited sequence |
| Roles / demo accounts | 3 / 8 |
| Consent purposes | 7 |
| DSAR types | 4 |
| Sensitive-access grant window | 5–480 min |
| DSAR response target | 30 days |
| Retention window | 7 years (configurable) |
| Access token / refresh | 15 min / 7 days, rotating |
| Plaintext salary at rest | 0 |

**On slide — right: deliberately not built**

- KMS/HSM-backed keys (env today, rotation supported)
- WebAuthn/passkeys (highest-value accounts first)
- External anchoring of the chain head (closes truncation)
- Multi-tenancy, SIEM alerting, breach workflow
- Post-quantum envelope encryption, private RAG, differential privacy

**Say:** "A project that hides its limits is less credible than one that scopes them. These are
in `docs/ROADMAP.md` with effort, impact and risk."

**Close:** "The contribution is not more HR features. It is a working, testable reference for how
an SME can hold employee data with evidence: encrypt it, scope it, log it, prove it was not
rewritten, and let the person exercise their rights."

---

## Backup slides (keep hidden)

### B1 — Control → file map (for code questions)

| Control | File |
|---|---|
| AES-256-GCM + rotation | `backend/utils/encryption.js` |
| Hash chain + verify | `backend/utils/auditChain.js` |
| Append-only guards | `backend/models/AuditLog.js` |
| RBAC/ABAC matrix | `backend/utils/policy.js` |
| JWT + refresh rotation | `backend/services/tokenService.js`, `controllers/authController.js` |
| Sensitive-read logging | `backend/controllers/employeeController.js` |
| DSAR + legal hold | `backend/controllers/privacyController.js` |
| JIT access | `backend/controllers/accessController.js` |
| Security Center UI | `frontend/src/pages/SecurityCenter.jsx` |
| My Data UI | `frontend/src/pages/Privacy.jsx` |

### B2 — Likely viva questions (short answers)

1. **"What is novel here for a final-year project?"**
   The contribution is the mapping from DPDP obligations to enforceable, testable controls, plus
   the tamper demo. CRUD is not the contribution.
2. **"Why not blockchain?"**
   One fiduciary, no consortium consensus needed. A hash chain + external anchor is cheaper and
   sufficient. Blockchain would add operational cost without closing a real threat here.
3. **"Can an attacker delete the audit trail?"**
   Newest rows, yes — hence "tamper-evident". Middle-row edits/deletes are detected. External
   anchoring is the next step.
4. **"Is the admin trusted?"**
   The admin can decrypt, but every read is a critical event, and HR cannot read the audit trail.
   Dual control / break-glass approval is roadmap.
5. **"How do you handle an employee leaving?"**
   Soft delete + `retentionUntil`; login disabled, tokenVersion bumped; erasure deferred until
   statutory retention ends, then anonymisation.
6. **"What about backups?"**
   Erasure covers the live record; cryptographic erasure of backups (per-tenant keys) is roadmap.
   Stated as a limitation.
7. **"How does the frontend avoid storing tokens?"**
   Access token in a JS variable; refresh token in an httpOnly, SameSite=Lax cookie scoped to
   `/api/auth`; rotation on every refresh; reuse rejected.
8. **"How would this scale?"**
   The chain append lock is in-process — multi-instance needs Redis/advisory lock. Rate limits
   move to Redis. Keys move to KMS. These are documented, not surprises.
9. **"What did you measure?"**
   Test pass counts, smoke coverage, tamper detection, consent coverage, DSAR SLA, sensitive-read
   counts. Not "number of screens".
10. **"What is the business model?"**
    Per-employee SaaS for SMEs, or on-prem for firms that want data residency; the audit/DSAR pack
    is the differentiator, not payroll processing.
11. **"Why should an SME trust this over a big vendor?"**
    Cost and focus: the big vendor sells a full HR suite; this sells the evidence layer and can
    sit beside the SME's existing tools. Trust is earned by verifiable controls, not brand.
12. **"What would you do differently?"**
    Start with the threat model and the audit-chain verification test before the UI; UI work
    consumed more time than the governance layer.

### B3 — Professor's critique → response

| Critique | Response built into the project |
|---|---|
| "Idea is okay but motive is weak" | Slide 2: DPDP obligations, ₹250 crore exposure, SME budget gap, four named failures |
| "Handling seems shallow" | Slides 6–9 + demo: GCM with auth tags, hash-chain verification, ABAC + JIT, DSAR legal hold — each with a click and a test |
| "Usefulness is unclear" | Slide 10 + `docs/DPDP.md`: obligation-to-implementation map, measurable SLAs, and a deployable trust layer beside an existing HRMS |
| "It's just another CRUD project" | The CRUD is explicitly the surface; the contribution is governance and evidence, demonstrated by tampering with the database |

### B4 — If the demo cannot run

Show, in this order:

1. `docs/SECURITY.md` threat model table (STRIDE).
2. `docs/DPDP.md` obligation map.
3. `npm test` output (14/14) and `npm run smoke` output (20/20) from the terminal.
4. The tamper-demo transcript in `docs/DEMO.md`.
5. The architecture diagram on slide 5.

Do not debug live in front of the panel; narrate the design and the evidence you already have.
