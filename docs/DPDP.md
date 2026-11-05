# DPDP Readiness Pack — SecureVault HR

> **Disclaimer.** This is an engineering mapping, not legal advice. The Digital Personal Data
> Protection Act, 2023 and its Rules are being brought into force in phases; verify the latest
> official notification, thresholds and timelines with counsel before relying on any statement
> here. Section references are to the Act as published.

---

## 1. Why an SME needs this

An Indian SME is a **Data Fiduciary** for its employees' data. It decides *why* and *how* payroll,
identity, attendance and performance data is processed. The Act does not exempt small employers,
and the penalty schedule can reach **₹250 crore** for failure to take reasonable security
safeguards. Most SMEs cannot afford a Big-4 compliance programme, so the practical question is:
*what is the smallest set of controls that is both defensible and demonstrable?*

SecureVault answers that with four capabilities that map directly to obligations:

1. a **purpose-bound consent register** with evidence,
2. **authenticated encryption** for high-risk fields,
3. a **tamper-evident access trail** (accountability),
4. a **data-principal rights workflow** with deadlines and legal hold.

---

## 2. Roles

| DPDP role | In this system |
|---|---|
| **Data Principal** | The employee (and, for some data, applicants/former employees) |
| **Data Fiduciary** | The SME deploying SecureVault |
| **Data Processor** | A payroll vendor or cloud provider, if used — the SME remains accountable |
| **Consent Manager** | *Not implemented*; consent is collected directly by the fiduciary (allowed, but registration with the Board is required for a Consent Manager) |
| **Data Protection Board** | External regulator; the app produces evidence for a Board inquiry |
| **Significant Data Fiduciary** | *Not claimed*; SDF obligations (DPIA, audit, DPO) are roadmap items |

**Separation of duties in the app:** the `admin` role operates the system and resolves DSARs; HR
manages employment data; employees exercise their own rights. A real deployment should give the
DPO an independent account that is not the same person as the HR operator, and should document
that reporting line. The app's `Security Center` is labelled "Operator & DPO workspace" because a
small SME often has one accountable person — that is a staffing compromise, not a control.

---

## 3. Obligation → implementation map

| DPDP obligation (indicative) | What the Act expects | What SecureVault does | Evidence you can show | Gap / roadmap |
|---|---|---|---|---|
| **Notice** (s.5) | Clear, itemised notice of data, purpose, rights, grievance route, before/with consent | Login/registration shows a DPDP notice; `noticeVersion` + `noticeAcceptedAt` stored on the user; My Data shows the notice version and rights | `users.noticeAcceptedAt`, `users.noticeVersion`, My Data page | Notice text is a demo draft; legal review needed |
| **Consent** (s.6) | Free, specific, informed, unconditional, unambiguous, affirmative; withdraw as easily as grant | Seven-purpose register; mandatory purposes marked and blocked from withdrawal while employed; optional purposes toggle with timestamp, IP, UA and evidence | `consents` collection; consent audit events `CONSENT_GRANTED` / `CONSENT_WITHDRAWN` | No Consent Manager integration; no multilingual notice |
| **Purpose limitation** | Use data only for the consented/legitimate purpose | Each consent row names one purpose; access matrix states the purpose for salary/bank/leave/audit; sensitive reads are logged with the business reason | `GET /api/privacy/access-matrix`, My Data inventory | Technical purpose enforcement is policy-level, not a per-query label |
| **Data minimisation** | Collect only what is necessary | Only name, email, role, department, designation, salary, bank, leave; financial fields masked for HR by default | Employee list API masks fields; access matrix | No automated "field ageing" review |
| **Accuracy** | Reasonable efforts to keep data accurate | Employees can correct name/designation; correction request workflow for other fields; admin edits are audit-logged | `PUT /api/employees/me`, `POST /api/privacy/requests` (correction) | No self-service correction for salary/bank (by design, to avoid fraud) |
| **Storage limitation** | Retain only as long as necessary | `retentionUntil` on the user; soft delete + retention window; erasure respects legal hold | `User.retentionUntil`, `DataRequest.legalHold`, retention policy in My Data | No automated purge job; retention period is configurable but manual |
| **Security safeguards** (s.8(5)) | Reasonable technical and organisational measures | AES-256-GCM, bcrypt, JWT hardening, ABAC, JIT, rate limits, sanitisation, audit chain, fail-fast secrets | `docs/SECURITY.md`, tests, tamper demo | No KMS/HSM, no MFA yet |
| **Breach notification** (s.8(6)) | Notify the Board and affected Data Principals | **Process gap**: the app records failed logins and sensitive reads but does not run a breach workflow | Audit trail supports investigation | Roadmap: incident register, notification templates, 72-hour-style runbook |
| **Right to access** (s.11) | Summary of personal data processed, identities of processors, and sharing | My Data inventory + machine-readable JSON export with consents, leaves, requests and audit events | `GET /api/privacy/me`, `GET /api/privacy/me/export`; `DATA_EXPORTED` audit event | No processor register in the export yet |
| **Right to correction & erasure** (s.12) | Correction, completion, updating; erasure when purpose is served | Correction request workflow; erasure request with statutory legal hold, then anonymisation | `datarequests`, `DATA_ERASED` event, Security Center DSAR list | Erasure is anonymisation, not cryptographic erasure of backups |
| **Right to grievance** (s.13) | Accessible grievance redressal, then Board escalation | Grievance request type with 30-day target; My Data shows how to raise it | `DataRequest` type `grievance`, due date, resolution note | No external escalation UI; no published grievance officer contact |
| **Right to nominate** (s.14) | Nominate someone to exercise rights on death/incapacity | **Not implemented** | — | Roadmap |
| **Consent withdrawal** | As easy as giving | One toggle per optional purpose; mandatory purposes explain the lawful basis and refuse withdrawal | `PUT /api/privacy/consents`, audit events | Withdrawal does not trigger downstream purge (manual review) |
| **Accountability** | Demonstrate compliance | Hash-chained audit trail, verification endpoint, access matrix, DSAR SLA metrics | `GET /api/audit-logs/verify`, Security Center | No external anchor; no annual audit pack |
| **Cross-border transfer** | Allowed except to notified restricted countries | Not modelled | — | Roadmap: deployment-region policy |
| **Children** (s.9) | Verifiable parental consent; no behavioural tracking | Employment data assumed 18+; no tracking | — | Interns/minors need a process |
| **SDF obligations** (s.10) | DPIA, audit, DPO, algorithmic due diligence | Not claimed | — | Roadmap |
| **Data Protection Officer** | Point of contact for Data Principals | Security Center is the DPO workspace; admin resolves requests | DSAR list + SLA metrics | DPO independence is organisational, not enforced |

---

## 4. Consent model

### 4.1 Purposes

| Purpose | Lawful basis in demo | Mandatory? | Withdrawable? |
|---|---|---|---|
| `core_hr` | Contract | Yes | No, while employed |
| `payroll` | Legal obligation | Yes | No, while employed |
| `statutory_compliance` | Legal obligation | Yes | No, while employed |
| `benefits` | Consent | No | Yes |
| `background_verification` | Consent | No | Yes |
| `analytics` | Consent | No | Yes |
| `marketing` | Consent | No | Yes |

Mandatory rows are mandatory **for the employment relationship**, not because the Act says so.
The UI explains the lawful basis when withdrawal is refused; it does not pretend the choice is
free when it is not.

### 4.2 What is recorded per consent

`user`, `purpose`, `lawfulBasis`, `mandatory`, `granted`, `noticeVersion`, `grantedAt`,
`withdrawnAt`, `ip`, `userAgent`, `evidence`.

That is deliberately more than a boolean: in a Board inquiry, "the employee consented" is not
evidence unless you can show *to what*, *when*, *under which notice version*, and *from where*.

### 4.3 Consent lifecycle

```
registration / admin onboarding
        │
        ▼
ensureDefaultConsents()  ──► mandatory rows granted, optional rows off
        │
        ├── employee toggles an optional purpose ON  ──► CONSENT_GRANTED (audit)
        ├── employee toggles an optional purpose OFF ──► CONSENT_WITHDRAWN (audit)
        └── employee tries to withdraw a mandatory purpose ──► 409 + lawful basis explained
```

`ensureDefaultConsents` uses `$setOnInsert`, so calling it again never overwrites a later choice.

---

## 5. Data-principal request (DSAR) lifecycle

### 5.1 Types

`access`, `correction`, `erasure`, `grievance`.

### 5.2 States

```
pending ──► in_review ──► completed
   │            │
   └────────────┴────────► rejected (with resolution note)
```

- `dueAt = createdAt + DSAR_RESPONSE_DAYS` (default 30).
- Security Center flags overdue requests in red; `GET /api/privacy/stats` counts open/overdue/erasure.
- Each transition writes an audit event (`DATA_REQUEST_REVIEWED`, `DATA_ERASED`).
- An erasure request that is completed calls `anonymiseUser()`: name replaced, email replaced with
  `erased+<id>@invalid.local`, password randomised, department/designation/code/salary/bank cleared,
  account deactivated, `tokenVersion` bumped, refresh hash cleared.
- **Legal hold:** erasure is blocked while `retentionUntil > now` (statutory payroll retention).
  The request stays recorded with `legalHold: true` and a reason; it is not silently dropped.

### 5.3 Why legal hold matters

A naive "delete on request" feature creates a compliance violation: payroll and tax law require
retention for a period after exit. The defensible behaviour is to **record the request, explain
the hold, and erase after the statutory window** — which is what the UI and API do.

### 5.4 Access export

`GET /api/privacy/me/export` returns a JSON document (`securevault-dsar-v1`) containing the data
principal's profile, consents, leave records, data requests and audit events about them. Running
an export creates a `DATA_EXPORTED` critical audit event, so the export itself is accountable.

---

## 6. Retention and deletion

| Data | Retention in the demo | Mechanism |
|---|---|---|
| Core HR profile | While employed + statutory period | `isActive`, `isDeleted`, `retentionUntil` |
| Salary / bank | 7 years after exit (configurable `RETENTION_YEARS`) | Legal hold on erasure; encrypted at rest |
| Leave records | 7 years after exit | Retained with the user record |
| Consent evidence | Life of consent + 3 years | Consent rows retained for accountability |
| Audit events | Per audit policy; personal identifiers can be redacted | Append-only; actor fields denormalised so the trail survives user deletion |
| DSAR records | Retained as evidence of compliance | `datarequests` |

**Deactivation is a soft delete.** `DELETE /api/employees/:id` sets `isDeleted`, `deletedAt`,
disables login and bumps `tokenVersion`; an admin can restore. Destructive deletion only happens
through the approved erasure workflow after the hold expires.

---

## 7. Security safeguards relevant to DPDP

The Act requires "reasonable security safeguards". This project interprets that as:

1. **Encryption at rest for high-risk fields** — AES-256-GCM, authenticated (see `SECURITY.md`).
2. **Least privilege** — RBAC + department scoping + self-only access.
3. **Time-bound elevation** — HR needs an approved, expiring grant for salary/bank data.
4. **Accountability** — hash-chained audit; every sensitive read is a critical event.
5. **Confidentiality of credentials** — bcrypt, rotating refresh tokens, in-memory access tokens.
6. **Resilience** — validation, sanitisation, rate limits, fail-fast configuration.
7. **Evidence** — tests, smoke checks and a tamper demo, not just assertions.

---

## 8. What is deliberately *not* claimed

| Not claimed | Why it matters in a viva |
|---|---|
| "Fully DPDP compliant" | Compliance is organisational + legal + technical; software is one input. We say "DPDP-ready controls". |
| Consent Manager | Requires registration with the Board; not built. |
| Significant Data Fiduciary readiness | No DPIA, annual audit or independent DPO. |
| Breach notification automation | No incident register or notification workflow yet. |
| Cryptographic erasure of backups | Erasure anonymises the live record; backups need a separate key-destruction strategy. |
| Cross-border transfer controls | No region restriction. |
| Nomination | Right exists in the Act; not implemented. |
| Children's data | Assumes adult employees; interns need a separate process. |

Saying this out loud is the difference between a project that understands the regulation and one
that pastes "DPDP compliant" onto a slide.

---

## 9. Demo path for the compliance story (≈2 minutes)

1. Sign in as `neha@securevault.demo` → **My Data**.
2. Show the inventory (what is stored, purpose, retention, encrypted-at-rest flags).
3. Toggle an optional consent off → point at `CONSENT_WITHDRAWN` in the audit trail.
4. Try to withdraw `payroll` → show the 409 explanation of the lawful basis.
5. **Export my data** → open the JSON (profile, consents, leaves, audit events).
6. Raise an **erasure** request → show the legal-hold explanation and the 30-day due date.
7. Sign in as admin → **Security Center** → show the DSAR queue, overdue flag and resolution flow.

Then switch to the security story (tamper demo) — together they answer "motive, handling and
usefulness" in one pass.
