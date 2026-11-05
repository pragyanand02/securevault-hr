/* eslint-disable no-console */
// Demonstrates tamper-evidence.
// It edits an audit record directly in MongoDB (bypassing the application's
// append-only guards, exactly like an attacker with database access would),
// then verifies the chain. The verification MUST fail.
//
// Run: node scripts/tamper-demo.js
// Afterwards run: npm run seed:reset   (to restore a clean demo chain)
const path = require('path');
const dns = require('dns');

dns.setServers((process.env.DNS_SERVERS || '8.8.8.8,8.8.4.4').split(','));
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const AuditLog = require('../models/AuditLog');
const { verifyChain } = require('../utils/auditChain');

const run = async () => {
  await connectDB();

  const before = await verifyChain();
  console.log(`Before tampering: valid=${before.valid} (${before.total} records)`);

  const target = await AuditLog.findOne({ action: 'SENSITIVE_FIELDS_DECRYPTED' }).sort({ sequence: 1 }).lean();
  if (!target) {
    console.log('No sensitive-access record found. Run the app once (admin views salary) and try again.');
    process.exit(1);
  }

  // Direct driver write: bypasses Mongoose append-only hooks.
  await mongoose.connection.collection(AuditLog.collection.name).updateOne(
    { _id: target._id },
    { $set: { details: 'Nothing to see here - record quietly edited' } }
  );

  console.log(`Tampered with audit record sequence=${target.sequence} (action=${target.action})`);

  const after = await verifyChain();
  console.log(`After tampering:  valid=${after.valid}`);
  if (!after.valid) {
    console.log(`Detected at sequence ${after.brokenAtSequence}: ${after.reason}`);
  }

  await mongoose.connection.close();
  process.exit(after.valid ? 1 : 0);
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
