# Audit chain anchors

This directory holds **anchor receipts** produced by:

```powershell
cd backend
npm.cmd run anchor:chain
```

A receipt is a small JSON document that commits to the audit trail with a Merkle
root over the record hashes:

```json
{
  "anchorFormat": "securevault-anchor-v1",
  "sequenceFrom": 1,
  "sequenceTo": 42,
  "recordCount": 42,
  "merkleRoot": "…64 hex characters…",
  "chainValid": true
}
```

## Why it exists

The hash chain is **tamper-evident**: editing a stored row breaks verification.
It cannot, by itself, stop someone with database access from deleting the newest
rows and rolling the head back. Publishing the Merkle root somewhere the
database cannot rewrite (a git commit, S3 Object Lock, an RFC 3161 timestamp)
closes that gap.

## Verify a saved receipt later

```powershell
cd backend
npm.cmd run anchor:verify -- "..\docs\anchors\chain-anchor-000042.json"
```

- `ANCHOR MATCHES` — the stored chain still reproduces the published root.
- `ANCHOR MISMATCH` — records were altered, removed or truncated.

Generated `*.json` receipts are ignored by git by default so a demo does not
commit a stale root. For a real deployment, publish each receipt deliberately
(commit it, or upload it to an append-only store) and keep the timestamp.

> Note: receipts only cover the sequence range they were created for. Events
> written after `sequenceTo` are outside that receipt — create a new one.
