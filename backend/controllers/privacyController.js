const User = require('../models/User');
const Consent = require('../models/Consent');
const DataRequest = require('../models/DataRequest');
const Leave = require('../models/Leave');
const AuditLog = require('../models/AuditLog');
const AccessGrant = require('../models/AccessGrant');
const { safeDecrypt, encryptionInfo } = require('../utils/encryption');
const { verifyChain, getChainState, buildAnchorReceipt } = require('../utils/auditChain');
const { ACCESS_MATRIX } = require('../utils/policy');
const { purposeMeta } = require('../services/consentService');
const { anonymiseUser, RETENTION_YEARS } = require('../services/retentionService');
const { logEvent } = require('../middleware/auditLogger');

const RESPONSE_DAYS = Number(process.env.DSAR_RESPONSE_DAYS || 30);

const dueDate = () => new Date(Date.now() + RESPONSE_DAYS * 24 * 60 * 60 * 1000);

// @route GET /api/privacy/me
exports.getMyPrivacy = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password -refreshTokenHash -refreshTokenExpiresAt');
    if (!user || user.isDeleted) return res.status(404).json({ message: 'Account not found' });

    const [consents, requests, auditCount, recentAudit] = await Promise.all([
      Consent.find({ user: user._id }).sort({ purpose: 1 }).lean(),
      DataRequest.find({ user: user._id }).sort({ createdAt: -1 }).lean(),
      AuditLog.countDocuments({
        $or: [{ actor: user._id }, { targetId: user._id.toString() }],
      }),
      AuditLog.find({
        $or: [{ actor: user._id }, { targetId: user._id.toString() }],
      }).sort({ sequence: -1 }).limit(10).lean(),
    ]);

    const inventory = [
      {
        field: 'Name, email, role, department',
        value: `${user.name} · ${user.email} · ${user.role} · ${user.department || '—'}`,
        encryptedAtRest: false,
        purpose: 'core_hr',
        retention: 'While employed + statutory period',
      },
      {
        field: 'Salary',
        value: user.salary ? safeDecrypt(user.salary) : 'Not recorded',
        encryptedAtRest: Boolean(user.salary),
        purpose: 'payroll',
        retention: `${RETENTION_YEARS} years after exit (statutory)`,
      },
      {
        field: 'Bank account details',
        value: user.bankDetails ? safeDecrypt(user.bankDetails) : 'Not recorded',
        encryptedAtRest: Boolean(user.bankDetails),
        purpose: 'payroll',
        retention: `${RETENTION_YEARS} years after exit (statutory)`,
      },
      {
        field: 'Leave records',
        value: `${await Leave.countDocuments({ employee: user._id })} request(s)`,
        encryptedAtRest: false,
        purpose: 'core_hr',
        retention: `${RETENTION_YEARS} years after exit (statutory)`,
      },
      {
        field: 'Consent register',
        value: `${consents.length} purpose record(s)`,
        encryptedAtRest: false,
        purpose: 'statutory_compliance',
        retention: 'Life of consent + 3 years evidence',
      },
      {
        field: 'Security audit events about you',
        value: `${auditCount} event(s)`,
        encryptedAtRest: false,
        purpose: 'legitimate_use (accountability)',
        retention: 'Audit retention policy',
      },
    ];

    return res.status(200).json({
      dataPrincipal: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || '',
        noticeAcceptedAt: user.noticeAcceptedAt,
        noticeVersion: user.noticeVersion,
      },
      inventory,
      consents: consents.map((c) => ({
        ...c,
        purposeLabel: c.purpose.replace(/_/g, ' '),
        canWithdraw: !c.mandatory,
      })),
      requests,
      retentionPolicy: {
        activeEmployment: 'Core HR and payroll data retained while employed.',
        afterExit: `${RETENTION_YEARS} years for payroll/statutory records, then review for erasure.`,
        auditTrail: 'Security audit events retained for accountability; personal identifiers can be redacted on request.',
      },
      rights: [
        { right: 'Access', how: 'Use "Export my data" below for a machine-readable copy.' },
        { right: 'Correction', how: 'Raise a correction request from this page.' },
        { right: 'Erasure', how: 'Raise an erasure request; statutory payroll retention may apply.' },
        { right: 'Grievance', how: 'Raise a grievance; response target is 30 days.' },
        { right: 'Consent withdrawal', how: 'Toggle any optional purpose below.' },
      ],
      audit: { totalEventsAboutMe: auditCount, recent: recentAudit },
      encryption: encryptionInfo(),
      accessMatrix: ACCESS_MATRIX,
    });
  } catch (error) {
    return next(error);
  }
};

// @route PUT /api/privacy/consents
exports.updateConsent = async (req, res, next) => {
  try {
    const { purpose, granted } = req.body;
    const meta = purposeMeta(purpose);
    if (!meta) return res.status(400).json({ message: 'Unknown consent purpose' });

    const consent = await Consent.findOne({ user: req.user.id, purpose });
    if (!consent) return res.status(404).json({ message: 'Consent record not found' });

    if (consent.mandatory && !granted) {
      return res.status(409).json({
        message: 'This processing is required by contract/legal obligation and cannot be withdrawn while employed',
        lawfulBasis: consent.lawfulBasis,
      });
    }

    consent.granted = granted;
    consent.grantedAt = granted ? new Date() : consent.grantedAt;
    consent.withdrawnAt = granted ? null : new Date();
    await consent.save();

    await logEvent({
      req,
      action: granted ? 'CONSENT_GRANTED' : 'CONSENT_WITHDRAWN',
      category: 'PRIVACY',
      severity: 'warning',
      targetId: consent._id,
      targetType: 'Consent',
      details: `Consent ${granted ? 'granted' : 'withdrawn'} for purpose "${purpose}"`,
      metadata: { purpose, lawfulBasis: consent.lawfulBasis },
    });

    return res.status(200).json({ message: `Consent ${granted ? 'granted' : 'withdrawn'}`, consent });
  } catch (error) {
    return next(error);
  }
};

// @route GET /api/privacy/me/export
exports.exportMyData = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password -refreshTokenHash -refreshTokenExpiresAt');
    if (!user || user.isDeleted) return res.status(404).json({ message: 'Account not found' });

    const [leaves, consents, requests, audit] = await Promise.all([
      Leave.find({ employee: user._id }).lean(),
      Consent.find({ user: user._id }).lean(),
      DataRequest.find({ user: user._id }).lean(),
      AuditLog.find({
        $or: [{ actor: user._id }, { targetId: user._id.toString() }],
      }).sort({ sequence: 1 }).limit(1000).lean(),
    ]);

    const payload = {
      exportFormat: 'securevault-dsar-v1',
      exportedAt: new Date().toISOString(),
      dataPrincipal: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
        salary: user.salary ? safeDecrypt(user.salary) : null,
        bankDetails: user.bankDetails ? safeDecrypt(user.bankDetails) : null,
        noticeAcceptedAt: user.noticeAcceptedAt,
        noticeVersion: user.noticeVersion,
        createdAt: user.createdAt,
        retentionUntil: user.retentionUntil,
      },
      consents,
      leaveRecords: leaves,
      dataRequests: requests,
      auditEvents: audit.map((event) => ({
        sequence: event.sequence,
        action: event.action,
        category: event.category,
        severity: event.severity,
        details: event.details,
        createdAt: event.createdAt,
        hash: event.hash,
      })),
      notice: 'This export is generated for a data-principal access request under applicable data-protection law.',
    };

    await logEvent({
      req,
      action: 'DATA_EXPORTED',
      category: 'PRIVACY',
      severity: 'critical',
      targetId: user._id,
      targetType: 'User',
      details: 'Data principal exported their personal data (DSAR access request)',
      metadata: { format: payload.exportFormat, auditEvents: audit.length },
    });

    const filename = `securevault-export-${user._id}-${Date.now()}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (error) {
    return next(error);
  }
};

const createRequest = async (req, type, reason) => {
  const user = await User.findById(req.user.id);
  if (!user || user.isDeleted) return { error: { status: 404, message: 'Account not found' } };

  const now = new Date();
  const retentionActive = Boolean(user.retentionUntil && user.retentionUntil > now);
  const legalHold = type === 'erasure' && (user.isActive || retentionActive);

  const request = await DataRequest.create({
    user: user._id,
    type,
    reason: reason || '',
    dueAt: dueDate(),
    legalHold,
    legalHoldReason: legalHold
      ? 'Active employment and statutory payroll retention prevent immediate erasure'
      : null,
  });

  await logEvent({
    req,
    action: type === 'erasure' ? 'ERASURE_REQUESTED' : 'DATA_REQUEST_CREATED',
    category: 'PRIVACY',
    severity: 'warning',
    targetId: request._id,
    targetType: 'DataRequest',
    details: `Data principal created a ${type} request`,
    metadata: { type, legalHold, dueAt: request.dueAt },
  });

  return { request, legalHold };
};

// @route POST /api/privacy/erasure
exports.requestErasure = async (req, res, next) => {
  try {
    const result = await createRequest(req, 'erasure', req.body.reason);
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });

    return res.status(201).json({
      message: result.legalHold
        ? 'Erasure request recorded. Statutory payroll retention applies, so it will be reviewed after the retention period.'
        : 'Erasure request recorded and queued for review.',
      request: result.request,
      legalHold: result.legalHold,
      responseDueBy: result.request.dueAt,
    });
  } catch (error) {
    return next(error);
  }
};

// @route POST /api/privacy/requests
exports.createDataRequest = async (req, res, next) => {
  try {
    const { type, reason } = req.body;
    if (!['access', 'correction', 'grievance'].includes(type)) {
      return res.status(400).json({ message: 'Type must be access, correction or grievance' });
    }

    const result = await createRequest(req, type, reason);
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });

    return res.status(201).json({ message: 'Request recorded', request: result.request });
  } catch (error) {
    return next(error);
  }
};

// @route GET /api/privacy/requests/me
exports.getMyRequests = async (req, res, next) => {
  try {
    const requests = await DataRequest.find({ user: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json(requests);
  } catch (error) {
    return next(error);
  }
};

// @route GET /api/privacy/requests  (Admin)
exports.getAllRequests = async (_req, res, next) => {
  try {
    const requests = await DataRequest.find()
      .populate('user', 'name email department role isDeleted retentionUntil')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(500);
    return res.status(200).json(requests);
  } catch (error) {
    return next(error);
  }
};

// @route PUT /api/privacy/requests/:id  (Admin)
exports.reviewDataRequest = async (req, res, next) => {
  try {
    const { status, resolutionNote } = req.body;
    const request = await DataRequest.findById(req.params.id).populate('user');
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status === 'completed' || request.status === 'rejected') {
      return res.status(409).json({ message: `Request is already ${request.status}` });
    }

    if (status === 'completed' && request.type === 'erasure') {
      const user = request.user;
      const retentionActive = Boolean(user?.retentionUntil && user.retentionUntil > new Date());

      // Defence in depth: never anonymise an active employee or a record that is
      // still inside its statutory retention window. "deferred" is the correct
      // outcome for these requests; it keeps the obligation visible.
      if (!user || user.isActive || retentionActive) {
        return res.status(409).json({
          message: 'Statutory retention hold is active. Mark the request as deferred instead of completing it.',
          retentionUntil: user?.retentionUntil || null,
          legalHold: true,
        });
      }
      await anonymiseUser(user._id);
      await logEvent({
        req,
        action: 'DATA_ERASED',
        category: 'PRIVACY',
        severity: 'critical',
        targetId: user._id,
        targetType: 'User',
        details: 'Personal data anonymised following an approved erasure request',
      });
    }

    request.status = status;
    request.resolvedAt = status === 'completed' || status === 'rejected' ? new Date() : null;
    request.resolvedBy = req.user.id;
    request.resolutionNote = resolutionNote || '';
    await request.save();

    await logEvent({
      req,
      action: 'DATA_REQUEST_REVIEWED',
      category: 'PRIVACY',
      severity: 'warning',
      targetId: request._id,
      targetType: 'DataRequest',
      details: `Data request (${request.type}) marked ${status}`,
      metadata: { type: request.type, status },
    });

    return res.status(200).json({ message: `Request marked ${status}`, request });
  } catch (error) {
    return next(error);
  }
};

// @route GET /api/privacy/access-matrix
exports.getAccessMatrix = async (req, res) => {
  res.status(200).json({
    role: req.user.role,
    department: req.user.department || null,
    principles: [
      'Least privilege: access is scoped to the minimum data needed for the role.',
      'Purpose limitation: salary/bank fields are only decrypted for payroll administration.',
      'Separation of duties: HR cannot read the audit trail; admins cannot silently read salary data.',
      'Time-bound elevation: HR gets sensitive access only through an approved, expiring grant.',
      'Auditability: every decryption of sensitive fields creates a critical audit event.',
    ],
    matrix: ACCESS_MATRIX,
  });
};

// @route GET /api/privacy/compliance-pack  (Admin / DPO)
// A portable, machine-readable evidence pack: control status, chain proof,
// consent coverage, DSAR SLA and the access matrix. Contains counts and policy
// only - never salary/bank plaintext.
exports.getCompliancePack = async (req, res, next) => {
  try {
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      totalConsents,
      grantedConsents,
      pendingRequests,
      overdueRequests,
      deferredRequests,
      erasureRequests,
      pendingGrants,
      activeGrants,
      sensitiveReads,
      failedLogins,
      chain,
      verification,
      anchor,
    ] = await Promise.all([
      User.countDocuments({ isDeleted: false }),
      User.countDocuments({ isDeleted: false, isActive: true }),
      Consent.countDocuments(),
      Consent.countDocuments({ granted: true }),
      DataRequest.countDocuments({ status: { $in: ['pending', 'in_review'] } }),
      DataRequest.countDocuments({ status: { $in: ['pending', 'in_review'] }, dueAt: { $lt: now } }),
      DataRequest.countDocuments({ status: 'deferred' }),
      DataRequest.countDocuments({ type: 'erasure' }),
      AccessGrant.countDocuments({ status: 'pending' }),
      AccessGrant.countDocuments({ status: 'approved', expiresAt: { $gt: now } }),
      AuditLog.countDocuments({ action: 'SENSITIVE_FIELDS_DECRYPTED', createdAt: { $gte: since } }),
      AuditLog.countDocuments({ action: 'AUTH_LOGIN_FAILED', createdAt: { $gte: since } }),
      getChainState(),
      verifyChain(),
      buildAnchorReceipt(),
    ]);

    const coveragePercent = totalConsents === 0
      ? 0
      : Math.round((grantedConsents / totalConsents) * 100);

    const pack = {
      packFormat: 'securevault-compliance-pack-v1',
      generatedAt: now.toISOString(),
      generatedBy: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
      positioning: 'DPDP-ready employee data trust layer for Indian SMEs',
      disclaimer: 'Engineering evidence pack, not legal advice. Obligation mapping and known gaps are in docs/DPDP.md.',
      encryption: encryptionInfo(),
      auditTrail: {
        chain,
        verification: {
          valid: verification.valid,
          total: verification.total,
          checkedAt: verification.checkedAt,
          coversLatest: verification.coversLatest,
          brokenAtSequence: verification.brokenAtSequence || null,
          reason: verification.reason || null,
        },
        anchor: {
          format: anchor.anchorFormat,
          sequenceFrom: anchor.sequenceFrom,
          sequenceTo: anchor.sequenceTo,
          recordCount: anchor.recordCount,
          merkleRoot: anchor.merkleRoot,
          chainValid: anchor.chainValid,
        },
        sensitiveReadsLast24h: sensitiveReads,
        failedLoginsLast24h: failedLogins,
      },
      consent: {
        totalRecords: totalConsents,
        grantedRecords: grantedConsents,
        coveragePercent,
        note: 'Coverage counts all seven purpose records, including mandatory processing required by contract/legal obligation.',
      },
      dataPrincipalRequests: {
        open: pendingRequests,
        overdue: overdueRequests,
        deferredUnderLegalHold: deferredRequests,
        erasureRequests,
        responseSlaDays: RESPONSE_DAYS,
      },
      accessControl: {
        pendingTimeBoundGrants: pendingGrants,
        activeTimeBoundGrants: activeGrants,
        matrix: ACCESS_MATRIX,
        principles: [
          'Least privilege with deny-by-default policy',
          'Department-scoped ABAC for HR, self-only for employees',
          'Separation of duties: HR cannot read the audit trail; no self-approval',
          'Every sensitive decryption creates a critical audit event',
        ],
      },
      retention: {
        years: RETENTION_YEARS,
        totalActiveRecords: totalUsers,
        activeEmployees: activeUsers,
        erasureRule: 'Soft delete, then anonymise only after the statutory retention window; active employees are never purged.',
        command: 'npm run retention:run  (dry run)  |  npm run retention:apply',
      },
      evidence: {
        unitTests: 'npm test (node --test)',
        endToEnd: 'npm run smoke',
        tamperDemo: 'npm run tamper:demo',
        anchorWorkflow: 'npm run anchor:chain  |  npm run anchor:verify -- <receipt.json>',
      },
      knownLimitations: [
        'Tamper-evident, not tamper-proof: anchor the chain head externally to close the truncation gap.',
        'Keys live in the environment; KMS/HSM envelope encryption is roadmap work.',
        'No MFA/WebAuthn yet; privileged accounts are the first target.',
        'Single-instance audit-chain lock; multi-instance needs a distributed lock.',
        'No breach-notification workflow or SIEM alerting yet.',
        'Erasure anonymises the live record; cryptographic erasure of backups is roadmap work.',
      ],
    };

    await logEvent({
      req,
      action: 'COMPLIANCE_PACK_EXPORTED',
      category: 'PRIVACY',
      severity: 'critical',
      targetId: req.user.id,
      targetType: 'User',
      details: 'Admin exported the compliance evidence pack',
      metadata: {
        chainValid: verification.valid,
        merkleRoot: anchor.merkleRoot,
        openRequests: pendingRequests,
      },
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="securevault-compliance-pack-${now.toISOString().slice(0, 10)}.json"`);
    return res.status(200).send(JSON.stringify(pack, null, 2));
  } catch (error) {
    return next(error);
  }
};

// @route GET /api/privacy/stats  (Admin)
exports.getPrivacyStats = async (_req, res, next) => {
  try {
    const [totalConsents, grantedConsents, totalUsers, pendingRequests, overdueRequests, erasureRequests, deferredRequests] =
      await Promise.all([
        Consent.countDocuments(),
        Consent.countDocuments({ granted: true }),
        User.countDocuments({ isDeleted: false }),
        DataRequest.countDocuments({ status: { $in: ['pending', 'in_review'] } }),
        DataRequest.countDocuments({ status: { $in: ['pending', 'in_review'] }, dueAt: { $lt: new Date() } }),
        DataRequest.countDocuments({ type: 'erasure' }),
        DataRequest.countDocuments({ status: 'deferred' }),
      ]);

    return res.status(200).json({
      totalUsers,
      consentCoveragePercent: totalConsents === 0 ? 0 : Math.round((grantedConsents / totalConsents) * 100),
      totalConsents,
      grantedConsents,
      pendingRequests,
      overdueRequests,
      erasureRequests,
      deferredRequests,
      responseSlaDays: RESPONSE_DAYS,
      retentionYears: RETENTION_YEARS,
    });
  } catch (error) {
    return next(error);
  }
};
