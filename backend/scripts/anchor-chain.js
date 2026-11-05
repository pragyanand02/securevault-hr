/* eslint-disable no-console */
// Audit-chain anchor runbook.
//
//   npm run anchor:chain                 -> create a receipt for the current chain
//   npm run anchor:chain -- --to=42      -> create a receipt for sequence 1..42
//   npm run anchor:verify -- <file>      -> re-check a saved receipt against MongoDB
//
// The receipt is a small JSON document containing a Merkle root over the audit
// hashes. Commit it (or publish it to S3 Object Lock / an RFC 3161 timestamp)
// to close the "delete the newest audit rows" gap: a later truncation can no
// longer reproduce the published root.
const path = require('path');
const fs = require('fs');
const dns = require('dns');

dns.setServers((process.env.DNS_SERVERS || '8.8.8.8,8.8.4.4').split(','));
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { buildAnchorReceipt, verifyAnchorReceipt } = require('../utils/auditChain');

const ANCHOR_DIR = path.join(__dirname, '..', '..', 'docs', 'anchors');

const argument = (name) => {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
};

const createAnchor = async () => {
  const to = argument('to');
  const receipt = await buildAnchorReceipt(to ? { to: Number(to) } : {});

  if (!receipt.merkleRoot) {
    console.log('No audit records found. Nothing to anchor.');
    return;
  }

  fs.mkdirSync(ANCHOR_DIR, { recursive: true });
  const filename = `chain-anchor-${String(receipt.sequenceTo).padStart(6, '0')}.json`;
  const target = path.join(ANCHOR_DIR, filename);
  fs.writeFileSync(target, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');

  console.log('Audit chain anchored.');
  console.log(`  Records:        ${receipt.recordCount} (sequence #${receipt.sequenceFrom}-#${receipt.sequenceTo})`);
  console.log(`  Merkle root:    ${receipt.merkleRoot}`);
  console.log(`  Chain valid:    ${receipt.chainValid}`);
  console.log(`  Written to:     ${target}`);
  console.log('\nCommit or publish this receipt. To verify later:');
  console.log(`  npm run anchor:verify -- "${target}"`);
};

const verifyAnchor = async () => {
  const file = process.argv[3];
  if (!file) {
    console.error('Usage: npm run anchor:verify -- <path-to-anchor.json>');
    process.exitCode = 1;
    return;
  }

  const receipt = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const result = await verifyAnchorReceipt(receipt);

  console.log(`Anchor file:      ${file}`);
  console.log(`Sequence:         #${receipt.sequenceFrom}-#${receipt.sequenceTo} (${receipt.recordCount} records)`);
  console.log(`Expected root:    ${result.expectedRoot}`);
  console.log(`Recomputed root:  ${result.recomputedRoot}`);
  console.log(`Chain valid:      ${result.chainValid}`);
  console.log(`RESULT:           ${result.valid ? 'ANCHOR MATCHES' : 'ANCHOR MISMATCH'}`);
  if (!result.valid) console.log(`Reason:           ${result.reason}`);

  if (!result.valid) process.exitCode = 1;
};

const run = async () => {
  await connectDB();
  try {
    if (process.argv[2] === 'verify' || process.argv[2] === '--verify') {
      await verifyAnchor();
    } else {
      await createAnchor();
    }
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error('Anchor command failed:', error.message);
  process.exit(1);
});
