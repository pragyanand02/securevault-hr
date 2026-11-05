/* eslint-disable no-console */
// Demo seed for SecureVault HR.
// Usage:
//   npm run seed        -> adds demo data (safe to re-run)
//   npm run seed:reset  -> drops the demo collections first, then seeds
const path = require('path');
const dns = require('dns');
const crypto = require('crypto');

dns.setServers((process.env.DNS_SERVERS || '8.8.8.8,8.8.4.4').split(','));
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const { validateEnv } = require('../config/env');
validateEnv();

const connectDB = require('../config/db');
const User = require('../models/User');
const Leave = require('../models/Leave');
const Consent = require('../models/Consent');
const DataRequest = require('../models/DataRequest');
const AccessGrant = require('../models/AccessGrant');
const AuditLog = require('../models/AuditLog');
const AuditChainState = require('../models/AuditChainState');
const { encrypt } = require('../utils/encryption');
const { ensureDefaultConsents } = require('../services/consentService');
const { logEvent } = require('../middleware/auditLogger');

const PASSWORD = 'Demo@2026!';

const people = [
  { name: 'Aarav Mehta', email: 'admin@securevault.demo', role: 'admin', department: 'Leadership', designation: 'System Administrator', salary: 185000, bank: 'HDFC0000123 / 50100234567891' },
  { name: 'Priya Sharma', email: 'hr@securevault.demo', role: 'hr_manager', department: 'Engineering', designation: 'HR Business Partner', salary: 92000, bank: 'ICIC0000456 / 002101234567' },
  { name: 'Rohan Verma', email: 'hr.finance@securevault.demo', role: 'hr_manager', department: 'Finance', designation: 'HR Operations', salary: 88000, bank: 'AXIS0000789 / 918020012345' },
  { name: 'Neha Iyer', email: 'neha@securevault.demo', role: 'employee', department: 'Engineering', designation: 'Backend Engineer', salary: 78000, bank: 'SBIN0000111 / 320145678901' },
  { name: 'Kabir Khan', email: 'kabir@securevault.demo', role: 'employee', department: 'Engineering', designation: 'Frontend Engineer', salary: 72000, bank: 'HDFC0000222 / 501009876543' },
  { name: 'Ananya Rao', email: 'ananya@securevault.demo', role: 'employee', department: 'Finance', designation: 'Financial Analyst', salary: 68000, bank: 'ICIC0000333 / 002109876543' },
  { name: 'Vikram Singh', email: 'vikram@securevault.demo', role: 'employee', department: 'Sales', designation: 'Account Executive', salary: 61000, bank: 'AXIS0000444 / 918020098765' },
  { name: 'Meera Nair', email: 'meera@securevault.demo', role: 'employee', department: 'Engineering', designation: 'QA Engineer', salary: 59000, bank: 'SBIN0000555 / 320198765432' },
];

const dropCollections = async () => {
  const collections = [
    User.collection.name,
    Leave.collection.name,
    Consent.collection.name,
    DataRequest.collection.name,
    AccessGrant.collection.name,
    AuditLog.collection.name,
    AuditChainState.collection.name,
  ];
  for (const name of collections) {
    try {
      await mongoose.connection.db.dropCollection(name);
      console.log(`  dropped ${name}`);
    } catch (error) {
      if (error.codeName !== 'NamespaceNotFound') throw error;
    }
  }
};

const run = async () => {
  const reset = process.argv.includes('--reset');
  await connectDB();

  if (reset) {
    console.log('Resetting demo collections...');
    await dropCollections();
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const users = {};

  for (const person of people) {
    const user = await User.findOneAndUpdate(
      { email: person.email },
      {
        $set: {
          name: person.name,
          role: person.role,
          department: person.department,
          designation: person.designation,
          salary: encrypt(person.salary),
          bankDetails: encrypt(person.bank),
          isActive: true,
          isDeleted: false,
          deletedAt: null,
          retentionUntil: null,
          noticeAcceptedAt: new Date(),
          noticeVersion: process.env.PRIVACY_NOTICE_VERSION || '2026-11',
        },
        $setOnInsert: {
          email: person.email,
          password: passwordHash,
          tokenVersion: 0,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    users[person.email] = user;
    await ensureDefaultConsents(user, {
      optionalGranted: person.role === 'employee' ? ['analytics', 'benefits'] : ['analytics'],
    });
  }

  // A pending elevation request from Engineering HR (demo of JIT access).
  const existingGrant = await AccessGrant.findOne({ grantee: users['hr@securevault.demo']._id, status: 'pending' });
  if (!existingGrant) {
    await AccessGrant.create({
      grantee: users['hr@securevault.demo']._id,
      field: 'sensitive_fields',
      scope: 'department',
      reason: 'Compensation review for the Engineering team (Q3 cycle)',
    });
  }

  // Leave records for the employee portal.
  const leaveCount = await Leave.countDocuments();
  if (leaveCount === 0) {
    const today = new Date();
    const inDays = (n) => new Date(today.getTime() + n * 24 * 60 * 60 * 1000);
    await Leave.create([
      {
        employee: users['neha@securevault.demo']._id,
        leaveType: 'casual',
        startDate: inDays(2),
        endDate: inDays(3),
        days: 2,
        reason: 'Family function out of town',
        status: 'pending',
      },
      {
        employee: users['kabir@securevault.demo']._id,
        leaveType: 'sick',
        startDate: inDays(-4),
        endDate: inDays(-3),
        days: 2,
        reason: 'Viral fever, doctor advised rest',
        status: 'approved',
        reviewedBy: users['hr@securevault.demo']._id,
        reviewedAt: new Date(),
      },
      {
        employee: users['ananya@securevault.demo']._id,
        leaveType: 'earned',
        startDate: inDays(10),
        endDate: inDays(14),
        days: 5,
        reason: 'Annual vacation with family',
        status: 'pending',
      },
    ]);
  }

  // A sample data-principal erasure request (statutory hold applies).
  const existingRequest = await DataRequest.findOne({ type: 'erasure' });
  if (!existingRequest) {
    await DataRequest.create({
      user: users['vikram@securevault.demo']._id,
      type: 'erasure',
      reason: 'I want my personal data removed after I leave the company',
      dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      legalHold: true,
      legalHoldReason: 'Active employment and statutory payroll retention prevent immediate erasure',
    });
  }

  // Seed audit trail (also proves the hash chain is populated for the demo).
  const seedEvents = [
    ['ADMIN_ACCOUNT_SEEDED', 'SYSTEM', 'warning', 'Demo environment initialised'],
    ['CONSENT_REGISTER_CREATED', 'PRIVACY', 'info', 'Consent registers created for demo users'],
    ['DEMO_DATA_SEEDED', 'SYSTEM', 'info', `${people.length} demo accounts, ${await Leave.countDocuments()} leave records`],
  ];

  for (const [action, category, severity, details] of seedEvents) {
    await logEvent({
      actor: { id: users['admin@securevault.demo']._id.toString(), name: 'Aarav Mehta', email: 'admin@securevault.demo', role: 'admin' },
      action,
      category,
      severity,
      details,
    });
  }

  console.log('\nDemo data ready.\n');
  console.log('Accounts (all use the same password):');
  console.log(`  Password: ${PASSWORD}`);
  console.log('  Admin:        admin@securevault.demo');
  console.log('  HR (Engg):    hr@securevault.demo');
  console.log('  HR (Finance): hr.finance@securevault.demo');
  console.log('  Employee:     neha@securevault.demo');
  console.log('\nTry the demo:');
  console.log('  1. Sign in as HR -> salary is masked -> request access -> approve as admin.');
  console.log('  2. Admin views salary -> Security Center shows a critical decryption event.');
  console.log('  3. Security Center -> "Verify chain" -> shows intact.');
  console.log('  4. Employee -> My Data -> export JSON / raise erasure request.\n');

  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (error) => {
  console.error('Seed failed:', error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});

// Keep a deterministic-looking hash seed around for future fixture generation.
void crypto;
