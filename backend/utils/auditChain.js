const crypto = require('crypto');
const AuditLog = require('../models/AuditLog');
const AuditChainState = require('../models/AuditChainState');

const GENESIS = 'GENESIS';

// Deterministic JSON so the same record always produces the same hash,
// regardless of key insertion order.
const normalize = (value) => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object') {
    if (value._bsontype === 'ObjectId' || value.constructor?.name === 'ObjectId') {
      return value.toString();
    }
    const keys = Object.keys(value);
    // An empty object and a missing field must hash identically: MongoDB may
    // omit an empty Mixed field from the stored document.
    if (keys.length === 0) return null;
    const out = {};
    for (const key of keys.sort()) out[key] = normalize(value[key]);
    return out;
  }
  return value;
};

const canonicalize = (value) => JSON.stringify(normalize(value));

const hashPayload = (entry) => ({
  sequence: entry.sequence,
  actor: entry.actor ? entry.actor.toString() : null,
  actorName: entry.actorName,
  actorEmail: entry.actorEmail,
  actorRole: entry.actorRole,
  action: entry.action,
  category: entry.category,
  severity: entry.severity,
  targetId: entry.targetId,
  targetType: entry.targetType,
  details: entry.details,
  metadata: entry.metadata,
  ip: entry.ip,
  userAgent: entry.userAgent,
  createdAt: new Date(entry.createdAt).toISOString(),
  prevHash: entry.prevHash,
});

const computeHash = (entry) =>
  crypto.createHash('sha256').update(canonicalize(hashPayload(entry))).digest('hex');

// The chain is serialised in-process so two concurrent requests cannot read the
// same lastHash. A multi-instance deployment needs a distributed lock; this is
// documented as a scale-up step in docs/SECURITY.md.
let tail = Promise.resolve();
const enqueue = (task) => {
  const result = tail.then(task, task);
  tail = result.then(() => undefined, () => undefined);
  return result;
};

const appendAudit = (entry) => enqueue(async () => {
  const state = await AuditChainState.findOneAndUpdate(
    { _id: 'primary' },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const sequence = state.sequence;
  const prevHash = state.lastHash || GENESIS;
  const createdAt = entry.createdAt ? new Date(entry.createdAt) : new Date();

  const record = {
    sequence,
    actor: entry.actor || null,
    actorName: entry.actorName || 'System',
    actorEmail: entry.actorEmail || null,
    actorRole: entry.actorRole || 'system',
    action: entry.action,
    category: entry.category || 'SYSTEM',
    severity: entry.severity || 'info',
    targetId: entry.targetId ? String(entry.targetId) : null,
    targetType: entry.targetType || null,
    details: entry.details || '',
    metadata: entry.metadata || {},
    ip: entry.ip || null,
    userAgent: entry.userAgent || null,
    createdAt,
    prevHash,
  };

  record.hash = computeHash(record);

  try {
    const created = await AuditLog.create(record);
    await AuditChainState.updateOne({ _id: 'primary' }, { $set: { lastHash: record.hash } });
    return created;
  } catch (error) {
    // Roll the sequence back so the next append does not create a gap.
    await AuditChainState.updateOne({ _id: 'primary' }, { $inc: { sequence: -1 } });
    throw error;
  }
});

// Merkle root over an ordered list of record hashes.
// A single 32-byte value commits to every record in the window, which is what
// makes external anchoring practical: publish one root instead of N hashes.
// Odd nodes are promoted unchanged (the last node is paired with itself).
const hashPair = (left, right) => crypto
  .createHash('sha256')
  .update(`${left}:${right}`)
  .digest('hex');

const computeMerkleRoot = (hashes = []) => {
  if (!Array.isArray(hashes) || hashes.length === 0) return null;

  let level = hashes.map((hash) => String(hash).toLowerCase());
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = index + 1 < level.length ? level[index + 1] : left;
      next.push(hashPair(left, right));
    }
    level = next;
  }
  return level[0];
};

const verifyChain = async ({ limit = 10000, to = null } = {}) => {
  const query = to ? { sequence: { $lte: Number(to) } } : {};
  const logs = await AuditLog.find(query)
    .sort({ sequence: 1 })
    .limit(limit)
    .lean();

  if (logs.length === 0) {
    return { valid: true, total: 0, checkedAt: new Date().toISOString(), message: 'No audit records yet' };
  }

  let previousHash = GENESIS;
  let expectedSequence = 1;

  for (const log of logs) {
    if (log.sequence !== expectedSequence) {
      return {
        valid: false,
        total: logs.length,
        checkedAt: new Date().toISOString(),
        brokenAtSequence: log.sequence,
        reason: `Sequence gap: expected ${expectedSequence}, found ${log.sequence}`,
      };
    }

    if (log.prevHash !== previousHash) {
      return {
        valid: false,
        total: logs.length,
        checkedAt: new Date().toISOString(),
        brokenAtSequence: log.sequence,
        reason: 'Broken chain link: prevHash does not match the previous record',
      };
    }

    const recomputed = computeHash(log);
    if (recomputed !== log.hash) {
      return {
        valid: false,
        total: logs.length,
        checkedAt: new Date().toISOString(),
        brokenAtSequence: log.sequence,
        reason: 'Hash mismatch: this record was altered after it was written',
      };
    }

    previousHash = log.hash;
    expectedSequence += 1;
  }

  const state = await AuditChainState.findById('primary').lean();
  const truncated = logs.length === limit;
  const coversLatest = !to && !truncated && state ? state.lastHash === previousHash : false;

  return {
    valid: true,
    total: logs.length,
    checkedAt: new Date().toISOString(),
    latestHash: previousHash,
    sequenceTo: logs[logs.length - 1].sequence,
    coversLatest,
    truncated,
    message: coversLatest
      ? 'All audit records verified. The chain is intact.'
      : 'Verified the checked range. Older/newer records may exist beyond this window.',
  };
};

// Builds a portable anchor receipt for the chain (or a prefix of it).
// Publishing this small JSON outside MongoDB (git, S3 Object Lock, an RFC 3161
// timestamp) closes the "delete the newest rows" gap: the stored root can no
// longer be recomputed from a truncated trail.
const buildAnchorReceipt = async ({ to = null } = {}) => {
  const verification = await verifyChain(to ? { to } : {});
  const query = to ? { sequence: { $lte: Number(to) } } : {};
  const logs = await AuditLog.find(query)
    .sort({ sequence: 1 })
    .select('sequence hash')
    .lean();

  return {
    anchorFormat: 'securevault-anchor-v1',
    generatedAt: new Date().toISOString(),
    sequenceFrom: logs[0]?.sequence ?? 0,
    sequenceTo: logs[logs.length - 1]?.sequence ?? 0,
    recordCount: logs.length,
    merkleRoot: computeMerkleRoot(logs.map((log) => log.hash)),
    latestHash: logs[logs.length - 1]?.hash ?? GENESIS,
    chainValid: verification.valid,
    coversLatest: verification.coversLatest,
    note: 'Publish this receipt outside the database. Recompute the Merkle root over the same sequence range to verify the trail later.',
  };
};

// Recomputes the root for the receipt's sequence range and compares it with the
// published value. Used by scripts/anchor-chain.js.
const verifyAnchorReceipt = async (receipt) => {
  if (!receipt || receipt.anchorFormat !== 'securevault-anchor-v1') {
    return { valid: false, reason: 'Unknown or missing anchor format' };
  }

  const verification = await verifyChain({ to: receipt.sequenceTo });
  const logs = await AuditLog.find({ sequence: { $lte: receipt.sequenceTo } })
    .sort({ sequence: 1 })
    .select('sequence hash')
    .lean();

  const merkleRoot = computeMerkleRoot(logs.map((log) => log.hash));
  const rootMatches = merkleRoot === receipt.merkleRoot;
  const countMatches = logs.length === receipt.recordCount;

  return {
    valid: Boolean(verification.valid && rootMatches && countMatches),
    checkedAt: new Date().toISOString(),
    sequenceTo: receipt.sequenceTo,
    expectedRoot: receipt.merkleRoot,
    recomputedRoot: merkleRoot,
    rootMatches,
    countMatches,
    chainValid: verification.valid,
    reason: rootMatches && countMatches && verification.valid
      ? 'Anchor matches the stored chain'
      : !verification.valid
        ? `Chain verification failed: ${verification.reason}`
        : !countMatches
          ? `Record count changed: receipt=${receipt.recordCount}, stored=${logs.length}`
          : 'Merkle root mismatch: records were altered or removed',
  };
};

const getChainState = async () => {
  const state = await AuditChainState.findById('primary').lean();
  const total = await AuditLog.countDocuments();
  return {
    sequence: state?.sequence || 0,
    lastHash: state?.lastHash || GENESIS,
    totalRecords: total,
  };
};

module.exports = {
  GENESIS,
  canonicalize,
  computeHash,
  computeMerkleRoot,
  buildAnchorReceipt,
  verifyAnchorReceipt,
  appendAudit,
  verifyChain,
  getChainState,
};
