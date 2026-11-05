/* eslint-disable no-console */
// Re-encrypts every sensitive field with the current key id.
//
// Rotation procedure:
//   1. Set in .env:
//        AES_KEY_ID=k2
//        AES_SECRET_KEY=<new secret>
//        AES_KEY_ID_PREVIOUS=k1
//        AES_SECRET_KEY_PREVIOUS=<old secret>
//   2. Run: npm run rotate:encryption
//   3. Remove AES_KEY_ID_PREVIOUS / AES_SECRET_KEY_PREVIOUS after all rows are migrated.
//
// Note: legacy CBC values (from v1) are decrypted with the CURRENT secret; rotate
// those before changing AES_SECRET_KEY if you still have v1 data.
const path = require('path');
const dns = require('dns');

dns.setServers((process.env.DNS_SERVERS || '8.8.8.8,8.8.4.4').split(','));
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const { decrypt, encrypt, isEncrypted, encryptionInfo } = require('../utils/encryption');
const { logEvent } = require('../middleware/auditLogger');

const run = async () => {
  await connectDB();
  console.log('Target key:', encryptionInfo());

  const users = await User.find({
    $or: [{ salary: { $type: 'string' } }, { bankDetails: { $type: 'string' } }],
  });

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    let changed = false;

    for (const field of ['salary', 'bankDetails']) {
      const value = user[field];
      if (!value) continue;
      if (!isEncrypted(value)) {
        console.log(`  skip ${user.email} ${field}: not encrypted`);
        skipped += 1;
        continue;
      }
      try {
        user[field] = encrypt(decrypt(value));
        changed = true;
      } catch (error) {
        console.error(`  FAILED ${user.email} ${field}: ${error.message}`);
        skipped += 1;
      }
    }

    if (changed) {
      await user.save();
      migrated += 1;
    }
  }

  await logEvent({
    action: 'ENCRYPTION_KEY_ROTATED',
    category: 'SYSTEM',
    severity: 'critical',
    details: `Re-encrypted sensitive fields for ${migrated} record(s) using key id ${process.env.AES_KEY_ID || 'k1'}`,
    metadata: { migrated, skipped },
  });

  console.log(`Done. Migrated ${migrated} record(s); skipped ${skipped} field(s).`);
  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
