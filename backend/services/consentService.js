const Consent = require('../models/Consent');
const { getClientIp, getUserAgent } = require('../utils/request');

const DEFAULTS = [
  { purpose: 'core_hr', lawfulBasis: 'contract', mandatory: true, granted: true },
  { purpose: 'payroll', lawfulBasis: 'legal_obligation', mandatory: true, granted: true },
  { purpose: 'statutory_compliance', lawfulBasis: 'legal_obligation', mandatory: true, granted: true },
  { purpose: 'benefits', lawfulBasis: 'consent', mandatory: false, granted: false },
  { purpose: 'background_verification', lawfulBasis: 'consent', mandatory: false, granted: false },
  { purpose: 'analytics', lawfulBasis: 'consent', mandatory: false, granted: false },
  { purpose: 'marketing', lawfulBasis: 'consent', mandatory: false, granted: false },
];

// Creates the seven-purpose consent register for a user. Existing records are
// left untouched, so this is safe to call more than once.
exports.ensureDefaultConsents = async (user, { req, optionalGranted = [] } = {}) => {
  const now = new Date();
  const operations = DEFAULTS.map((item) => {
    const granted = item.mandatory ? true : optionalGranted.includes(item.purpose);
    return {
      updateOne: {
        filter: { user: user._id, purpose: item.purpose },
        update: {
          $setOnInsert: {
            user: user._id,
            purpose: item.purpose,
            lawfulBasis: item.lawfulBasis,
            mandatory: item.mandatory,
            granted,
            noticeVersion: process.env.PRIVACY_NOTICE_VERSION || '2026-11',
            grantedAt: granted ? now : null,
            withdrawnAt: null,
            ip: req ? getClientIp(req) : null,
            userAgent: req ? getUserAgent(req) : null,
            evidence: req ? 'Accepted at registration' : 'System default (mandatory processing)',
          },
        },
        upsert: true,
      },
    };
  });

  if (operations.length > 0) {
    await Consent.bulkWrite(operations, { ordered: false });
  }
};

exports.PURPOSES = DEFAULTS.map((item) => item.purpose);

exports.purposeMeta = (purpose) => DEFAULTS.find((item) => item.purpose === purpose) || null;
