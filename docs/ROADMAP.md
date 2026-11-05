# Roadmap — SecureVault HR

> Principle: **ship the control or document the gap.** No feature is described as done unless it
> has code, a test or a demo behind it. This roadmap is ordered by risk reduction per unit of work,
> not by how impressive the feature sounds.

Legend: **Impact** = risk/compliance reduction · **Effort** = engineering days (rough) ·
**Risk** = delivery/operational risk of adding it.

---

## Phase 0 — Done (this submission)

| Capability | Evidence |
|---|---|
| AES-256-GCM field encryption with key-id rotation + legacy CBC read | `utils/encryption.js`, `tests/encryption.test.js`, `scripts/rotate-encryption.js` |
| SHA-256 hash-chained audit + verification endpoint + append-only guards | `utils/auditChain.js`, `models/AuditLog.js`, `GET /api/audit-logs/verify` |
| Sensitive-read logging (critical events) | `controllers/employeeController.js` |
| Consent register (7 purposes, evidence, withdrawal rules) | `models/Consent.js`, `services/consentService.js`, `controllers/privacyController.js` |
| DSAR access/correction/erasure/grievance + 30-day SLA + legal hold/deferred | `controllers/privacyController.js`, Security Center UI |
| RBAC + department ABAC + self-scope + separation of duties | `utils/policy.js`, `tests/policy.test.js` |
| Time-bound JIT sensitive access (reason, approval, expiry, revoke) | `models/AccessGrant.js`, `controllers/accessController.js` |
| JWT hardening: in-memory access token, rotating httpOnly refresh, tokenVersion revocation | `services/tokenService.js`, `middleware/authMiddleware.js` |
| Soft delete + retention date + restore | `models/User.js`, employee controller |
| Runnable retention sweep with `RETENTION_PURGED` audit events | `services/retentionService.js`, `scripts/retention-run.js`, `tests/retention.test.js` |
| Merkle-root anchor receipts + verify CLI | `utils/auditChain.js`, `controllers/auditController.js`, `scripts/anchor-chain.js`, `docs/anchors/` |
| Downloadable compliance evidence pack (counts, chain proof, access matrix) | `GET /api/privacy/compliance-pack`, Security Center UI |
| Fail-fast secrets, Helmet, CORS allow-list, rate limits, sanitisation, validation | `config/env.js`, `server.js`, middleware |
| CI: unit tests, lint/build, smoke against an ephemeral Mongo | `.github/workflows/ci.yml` |
| Tests + smoke + tamper demo + anchor proof + docs | 24 unit tests, 23 smoke checks, `docs/` |

**Explicitly not claimed in Phase 0:** KMS/HSM, MFA/WebAuthn, multi-tenancy, automated external
anchoring/publishing, breach-notification automation, cross-border controls, children's data,
nomination.

---

## Phase 1 — Next 30–60 days (highest risk reduction)

| # | Item | Why | Impact | Effort | Risk / note |
|---|---|---|---|---|---|
| 1 | **Publish the audit anchor externally** | Receipt generation/verification is done; publishing the Merkle root closes the "delete the newest rows" gap | High | 2–3 d | Commit receipts or push to S3 Object Lock / RFC 3161 / a transparency log. Schedule daily anchoring and alert on failure |
| 2 | **KMS/HSM envelope encryption** | Removes long-lived data keys from the app host | High | 4–6 d | AWS KMS or Vault; per-tenant data keys; re-wrap without re-encrypting all rows; local dev fallback must stay usable |
| 3 | **WebAuthn/passkeys for admin + HR** | Credential phishing is the most likely account-takeover path for privileged users | High | 4–6 d | Libraries: SimpleWebAuthn; recovery codes; fallback policy for old devices |
| 4 | **Schedule retention + DSAR reminders** | The sweep and overdue list exist; they need a scheduler and notifications | High | 2–3 d | Cron/worker: `retention:apply`, notify owners before DSAR due date, alert on failure; must be idempotent |
| 5 | **Authorisation-matrix tests** | Prevent regressions in the exact area the project claims | Medium | 2–3 d | Route-by-route 401/403 tests; CI already runs unit, lint/build and smoke |
| 6 | **CSP tuning + Redis rate-limit store** | Closes two small but real weaknesses called out in `SECURITY.md` | Medium | 1–2 d | Define explicit `connect-src`/`script-src`; Redis store for multi-instance |
| 7 | **DPO role separation** | The operator should not be the auditor or the rights handler in a real deployment | Medium | 2–3 d | New `dpo` role with audit + DSAR access, no employee edit; organisation policy documented |
| 8 | **Sign the compliance pack** | The pack exists; signing makes it tamper-evident in an audit | Medium | 1–2 d | Hash + sign the JSON/PDF; publish the verification key |

**Recommended order:** 1 → 2 → 5 → 4 → 3 → 8 → 6 → 7.
(External anchor and KMS first because they close the two biggest "yes, but…" questions.)

---

## Phase 2 — 3–6 months (product depth)

| Item | Why | Impact | Effort |
|---|---|---|---|
| **Multi-tenancy** (tenant id + row-level policy or DB-per-tenant) | One deployment per SME does not scale commercially | High | 3–4 weeks |
| **SIEM/alerting** (critical events → CloudWatch/Loki; alert on chain failure, sensitive-read spikes, failed-login bursts) | Detection, not just recording | High | 1–2 weeks |
| **Breach-notification workflow** (incident register, affected-principal estimate, Board/principal notification templates, 72-hour-style runbook) | DPDP obligation currently unaddressed | High | 2 weeks |
| **Consent Manager integration** | Board-registered Consent Managers are part of the DPDP ecosystem | Medium | 2–3 weeks |
| **Cross-border / data-residency controls** | Some SMEs have contractual residency requirements | Medium | 1–2 weeks |
| **Nomination (s.14)** | Full rights coverage | Medium | 3–5 days |
| **Children/interns workflow** | Verifiable parental consent if minors are employed | Medium | 1 week |
| **Localisation** (Hindi + regional languages, accessible notice) | DPDP notice must be understandable to the principal | Medium | 2 weeks |
| **Mobile/PWA for employees** | Rights are more likely to be exercised if access is easy | Medium | 3–4 weeks |
| **Advanced analytics with purpose labels** (aggregate only, k-anonymity) | Useful HR insight without re-identifying individuals | Low–Medium | 2 weeks |
| **Backup erasure strategy** (per-tenant keys, crypto-shredding runbook) | Erasure must eventually cover backups | High | 2–3 weeks |

---

## Phase 3 — Research / deliberately deferred

These are interesting, but each adds complexity that is not justified for the current scope.
They are listed so the panel can see the decision was deliberate.

| Item | What it would add | Why deferred | Prerequisite |
|---|---|---|---|
| **Post-quantum envelope encryption** (hybrid X25519 + ML-KEM) | Future-proof key exchange | No deployed PQ KMS path; risk of inventing crypto | KMS/HSM + vetted library |
| **Private LLM / RAG over policy documents** | Natural-language policy Q&A without data egress | Compute cost, prompt-injection risk, evaluation burden | Local inference, guardrails, red-team suite |
| **Differential privacy for workforce analytics** | Aggregate insights with provable privacy | Small datasets make ε meaningful only with care; not core to the trust layer | Privacy budget design, utility testing |
| **Confidential computing / enclaves** | Protect data in use from the host | Operational complexity and limited portability | Cloud enclave support, attestation |
| **Zero-knowledge compliance attestations** | Prove a control holds without revealing data | Research-grade; no standard for DPDP attestations yet | Circuit design, auditor acceptance |
| **Blockchain anchoring** | Immutable public timestamp | Cost/latency; a transparency log or RFC 3161 is sufficient | Only if a customer requires it |

**What we will *not* build:** payroll calculation, recruitment, performance management, a generic
document manager, or a mobile app before the governance layer is anchored. Those are commodities
and would dilute the contribution.

---

## Success metrics (how to judge the next phase)

| Metric | Target | Why |
|---|---|---|
| Chain verification pass rate | 100% outside the tamper demo | Core evidence claim |
| Time to fulfil a DSAR | < 7 days (target), < 30 days (hard) | Statutory-style SLA |
| % sensitive reads through an approved grant | > 95% for HR roles | Proves JIT is used, not bypassed |
| Consent coverage | 100% of active employees with a notice version | Evidence of lawful processing |
| Overdue DSARs | 0 | Operational discipline |
| Failed-login alerts acknowledged | < 15 min | Detection, not just logging |
| Authorisation test coverage | every route has a 401/403 test | Prevents silent scope regressions |
| Restore-from-backup drill | quarterly, with chain verification after restore | Proves the evidence survives operations |

---

## Presentation framing

If asked "what next?", answer in this order:

1. **Anchor the chain** — the single biggest credibility upgrade.
2. **Move keys to KMS** — the single biggest breach-risk reduction.
3. **Passkeys for admins** — the single biggest account-takeover reduction.
4. **Automate retention/DSAR** — turns policy into enforcement.
5. **Multi-tenancy** — turns a project into a product.

Then stop. A short, ordered roadmap is more convincing than a long wish list.
