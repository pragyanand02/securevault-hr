# 7-Minute Demo Script — SecureVault HR

> Goal: prove **motive → handling → usefulness** in one pass.
> Every claim on a slide is followed by a click that shows the control working.

---

## 0. Pre-flight (do this 10 minutes before)

```powershell
# 1. Clean, deterministic state
cd backend
npm.cmd run seed:reset

# 2. Optional but recommended: prove the test suite first (keep the output visible)
npm.cmd test          # 14/14
npm.cmd run smoke     # 20/20 (backend must be running)

# 3. Re-seed after smoke, because smoke changes consent + DSAR state
npm.cmd run seed:reset

# 4. Start the API
npm.cmd run dev       # http://localhost:5000

# 5. New terminal: start the UI
cd ..\frontend
npm.cmd run dev       # http://localhost:5173
```

**Open `http://localhost:5173` — not `127.0.0.1`.** The CORS allow-list contains
`http://localhost:5173`; using the IP will make login fail and waste demo time.

### Accounts (password for all: `Demo@2026!`)

| Email | Role | Use it to show |
|---|---|---|
| `neha@securevault.demo` | Employee (Engineering) | My Data, consent, export, erasure, self-scope |
| `hr@securevault.demo` | HR Manager (Engineering) | Department scoping, masked salary, JIT request |
| `hr.finance@securevault.demo` | HR Manager (Finance) | Independent scope (optional) |
| `admin@securevault.demo` | Admin | Full scope, audit trail, JIT approval, DSAR queue |

### Pre-flight checklist

- [ ] Backend health: open `http://localhost:5000/api/health` → `"status":"ok"`, `"algorithm":"aes-256-gcm"`
- [ ] Frontend loads the login page with the DPDP hero panel
- [ ] `seed:reset` has just run (chain should be 3 records)
- [ ] Browser zoom 100%, notifications off, only one tab
- [ ] Terminal window open in `backend/` for the tamper demo
- [ ] Know the fallback: if UI fails, show `npm test` + `npm run smoke` output and the API with `curl`

---

## 1. The 7-minute run sheet

| Time | Beat | What the audience sees |
|---|---|---|
| 0:00–0:40 | Problem + positioning | "This is not an HRMS. It is the trust layer beside one." |
| 0:40–2:00 | Employee: My Data + rights | Inventory, consent, export, erasure with legal hold |
| 2:00–3:10 | HR: least privilege | Only 4 Engineering employees, salary masked, JIT request |
| 3:10–4:10 | Admin: approve + evidence | Grant approved, HR sees salary, audit shows who/why |
| 4:10–5:10 | Security Center | Chain verify, sensitive-read count, DSAR queue |
| 5:10–6:20 | Tamper demo | "An engineer edits the audit row; verification fails." |
| 6:20–7:00 | Limits + roadmap | Name what is *not* built; close on usefulness |

---

## 2. Beat-by-beat clicks

### Beat 1 — Frame the problem (no clicks, 40 s)

Say:

> "An SME has salary and bank data spread across spreadsheets, WhatsApp and a payroll vendor.
> DPDP makes the employer a Data Fiduciary, and failure to apply reasonable safeguards can reach
> ₹250 crore. Big consultancies are priced out. My project is the small, verifiable layer:
> encrypt the high-risk fields, record consent with evidence, make the audit trail tamper-evident,
> and let an employee actually exercise their rights. The HRMS screens are the surface —
> the contribution is the governance underneath."

Point at the login hero: **AES-256-GCM · Hash-chained audit · Purpose-bound consent · Time-bound access**.

### Beat 2 — Employee view: rights are real (80 s)

1. Sign in as `neha@securevault.demo` / `Demo@2026!`.
2. Dashboard → point at **Your data rights at a glance** (encryption, audit events about me, 5/7 consents).
3. Click **My Data**.
4. Scroll the **data inventory**: field → value → purpose → retention → "encrypted at rest".
5. Point at **Consent register**. Toggle **Marketing** ON, then OFF.
   - Say: "Each toggle is a chained audit event with time, IP and notice version."
6. Click **Export my data**. Open the downloaded JSON briefly:
   `exportFormat: "securevault-dsar-v1"`, profile, consents, leave records, audit events.
7. Raise an **erasure** request (reason: "Please remove my data after I leave").
   - Point at the response: **legal hold** + **due date**.
   - Say: "It does not blindly delete payroll history — statutory retention is a legal obligation.
     It records the request, explains the hold, and schedules review."

Expected: success toast, request appears in "My requests" with `pending` and a 30-day due date.

### Beat 3 — HR view: least privilege in action (70 s)

1. Logout → sign in as `hr@securevault.demo`.
2. Dashboard: **Employees in scope: 4 · Engineering only**, **Sensitive access: Masked**.
3. Click **Employees**.
4. Point at the banner: *"Salary and bank details are masked for your role"* and *"Scope: Engineering department only"*.
5. Point at the table: 4 rows only (Priya, Neha, Kabir, Meera). Ananya (Finance) and Vikram (Sales) are absent.
6. Point at the salary/bank columns: `••••••` + "masked · encrypted at rest".
7. Click **Request sensitive access** → prompt appears.
   - Enter: `Compensation review for the Engineering team (Q3 cycle)`
   - Say: "The reason is mandatory and becomes part of the audit record. The grant is time-bound."

Expected: toast "Access request submitted…", button disappears while pending.

### Beat 4 — Admin view: approve + prove (60 s)

1. Logout → sign in as `admin@securevault.demo`.
2. Click **Security Center**.
3. In **Time-bound sensitive-access requests**, find Priya's request.
   - Point at the reason and `Pending`.
4. Click **Approve** → prompt: `60` (minutes) → Enter.
   - Say: "The admin cannot approve their own request. This one expires automatically."
5. Toast: "Time-bound access grant approved."
6. Optional: click **Audit Log** → find `JIT_ACCESS_APPROVED` (critical).

Now switch back to HR to show the grant working:

7. Logout → sign in as `hr@securevault.demo` → **Employees**.
   - Banner turns amber: *"Sensitive fields visible through an approved time-bound grant (expires …)"*.
   - Salary/bank values are now visible for the 4 Engineering employees.
   - Say: "Same user, same page. What changed is a reviewed, expiring grant — not a permanent permission."

> If you are short on time, skip the second HR login: the audit event already proves the approval.
> The visual flip is worth it if you have 20 seconds.

### Beat 5 — Security Center: evidence dashboard (45 s)

Back as `admin@securevault.demo` → **Security Center**.

1. Point at metrics: **Audit events**, **Sensitive reads (24h)**, **Failed logins (24h)**, **Open DSARs**.
2. Under **Audit chain integrity**, click **Verify chain now**.
   - Expected green: **INTACT · no tampering detected** + "N record(s) recomputed and matched."
3. Scroll to **Data-principal requests (DSAR)**.
   - Point at Vikram's erasure request: **legal hold (statutory retention)**.
   - Click **Start review**, then **Defer (legal hold)** → note: "Retained until statutory window ends".
   - Say: "The system will not anonymise an active employee record. Deferring keeps the obligation visible."
4. Point at **Control summary** — the last tile is **Known limits**, not a marketing claim.

### Beat 6 — Tamper demo: the money shot (70 s)

Keep the Security Center open. In the terminal:

```powershell
cd backend
npm.cmd run tamper:demo
```

Expected output:

```
Before tampering: valid=true (N records)
Tampered with audit record sequence=X (action=SENSITIVE_FIELDS_DECRYPTED)
After tampering:  valid=false
Detected at sequence X: Hash mismatch: this record was altered after it was written
```

Say: "That edit was made directly in MongoDB, bypassing the application's append-only guards —
exactly what an operator or an attacker with database access would do. The chain caught it."

Back in the browser: **Security Center → Verify chain now** → red **TAMPERING DETECTED** with the
sequence number. Then **Audit Log → Verify integrity** for the same result on the full trail.

**Immediately after this beat**, restore the demo state:

```powershell
npm.cmd run seed:reset
```

(If you plan Q&A after the demo, reseed and sign in again; reseeding invalidates existing sessions.)

### Beat 7 — Close: honesty + roadmap (40 s)

Say:

> "What is deliberately not here: KMS/HSM-backed keys, WebAuthn passkeys, multi-tenancy,
> external anchoring of the chain head, breach-notification automation, and post-quantum
> envelope encryption. Those are in `docs/ROADMAP.md` with effort and risk, not hidden.
> The contribution is a working reference implementation of employee-data trust controls that
> can be evaluated against a regulation, a threat model, and a reproducible demo."

---

## 3. If something breaks (fallback ladder)

| Symptom | Fix |
|---|---|
| Login says "Login failed" | You are on `127.0.0.1`; switch to `http://localhost:5173` |
| "Too many login attempts" | Wait for the 15-min IP window, or restart the backend (in-memory limiter resets). Successful logins do not count, so this only happens after real failures |
| "Loading…" never finishes | Backend is down; check `http://localhost:5000/api/health` and restart |
| Chain verify is red before the tamper demo | You forgot to reseed after a previous tamper run: `npm.cmd run seed:reset` |
| Tamper demo says "No sensitive-access record found" | Nobody has viewed salary yet; sign in as admin → Employees once, then rerun |
| UI build broken | Show `npm.cmd test`, `npm.cmd run smoke`, and the README architecture diagram; narrate the same controls |
| Wi-Fi/Mongo down | Use the recorded smoke/test output and explain the design; do not debug live |

---

## 4. Quick answers for the viva (during or after the demo)

| Question | 20-second answer |
|---|---|
| "Isn't this just an HRMS?" | "The CRUD is the surface. The contribution is the governance layer: authenticated encryption, evidenced consent, a tamper-evident trail, and enforceable data-principal rights." |
| "Why not just use MongoDB encryption at rest?" | "At-rest encryption protects the disk, not the operator. It does not stop an admin reading salary in the UI, does not log the read, and does not prove the audit trail is intact. We do field-level encryption plus access policy plus evidence." |
| "Why a hash chain and not blockchain?" | "There is one fiduciary, not a consortium; consensus adds cost without solving the real threat. A hash chain plus an external anchor gives the same tamper-evidence for this scope. Anchoring is the next roadmap item." |
| "Can't an attacker delete the audit logs?" | "They can delete the newest rows — that is why we say tamper-evident, not tamper-proof. Editing or removing a middle row breaks the chain. External anchoring closes the truncation gap." |
| "Where are the keys?" | "In the environment today, with key-id rotation supported. Production moves to KMS/HSM envelope encryption; that is documented as a limitation, not hand-waved." |
| "Is it DPDP compliant?" | "It implements DPDP-ready controls and maps them to obligations. Compliance also needs legal review, a DPO, breach process and organisational measures. `docs/DPDP.md` lists exactly what is not claimed." |
| "What happens if HR is malicious?" | "They can only see their department, salary is masked without a reviewed grant, and every sensitive read is a critical audit event. A malicious admin is still an admin — dual control is roadmap." |
| "How do you know it works?" | "14 unit tests, 20 end-to-end smoke checks, and a tamper demo that edits the database directly and shows verification fail." |
| "What is the biggest weakness?" | "The chain lock is in-process and keys are in env. Both are known, scoped, and on the roadmap with the same seriousness as the features." |
| "What would you do with 3 more months?" | "External anchoring, KMS, passkeys, automated retention jobs, CI with authorisation tests, then multi-tenancy." |

---

## 5. After the demo

```powershell
# leave the repo in a clean, reproducible state
cd backend
npm.cmd run seed:reset
npm.cmd test
```

- Do **not** commit a database that has been tampered with.
- If you showed the export, delete the downloaded JSON from the Downloads folder.
- Keep the terminal output of `npm test`, `npm run smoke` and `tamper:demo` as screenshots/backup.
