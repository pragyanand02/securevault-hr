/* eslint-disable no-console */
// Retention sweep runbook.
//
//   npm run retention:run            -> dry run (no data changed)
//   npm run retention:apply          -> anonymise eligible records
//   npm run retention:apply -- --now=2027-01-01T00:00:00Z
//
// Eligibility: a soft-deleted employee whose retentionUntil has passed.
// Active employees and records inside their statutory payroll window are never
// touched. The sweep also reports overdue DSARs so an operator can act on them.
const path = require('path');
const dns = require('dns');

dns.setServers((process.env.DNS_SERVERS || '8.8.8.8,8.8.4.4').split(','));
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { runRetentionSweep } = require('../services/retentionService');

const argument = (name) => {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
};

const run = async () => {
  const dryRun = !process.argv.includes('--apply');
  const nowValue = argument('now');
  const now = nowValue ? new Date(nowValue) : new Date();

  if (Number.isNaN(now.getTime())) {
    console.error(`Invalid --now value: ${nowValue}`);
    process.exit(1);
  }

  await connectDB();

  try {
    const result = await runRetentionSweep({ dryRun, now });

    console.log(`Retention sweep (${dryRun ? 'DRY RUN' : 'APPLY'}) at ${result.ranAt}`);
    console.log(`  Retention policy:   ${result.retentionYears} year(s) after exit`);
    console.log(`  Eligible records:   ${result.eligible}`);
    console.log(`  Anonymised:         ${result.anonymised}`);
    console.log(`  Overdue DSARs:      ${result.overdueRequests}`);

    for (const record of result.records) {
      console.log(`    - ${record.name} <${record.email}> retention ended ${new Date(record.retentionUntil).toISOString()}`);
    }
    for (const requestId of result.overdueRequestIds) {
      console.log(`    ! overdue data request ${requestId}`);
    }

    if (dryRun && result.eligible > 0) {
      console.log('\nNo data was changed. Re-run with --apply to anonymise eligible records.');
    }
    if (!dryRun && result.overdueRequests > 0) {
      console.log('\nOverdue DSARs were reported but not modified; resolve them in the Security Center.');
    }
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error('Retention sweep failed:', error.message);
  process.exit(1);
});
