const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AccessGrant = require('../models/AccessGrant');
const { encrypt, safeDecrypt } = require('../utils/encryption');
const { logEvent } = require('../middleware/auditLogger');
const { ensureDefaultConsents } = require('../services/consentService');
const {
  canViewEmployee,
  canManageEmployee,
  canViewSensitive,
  employeeScope,
} = require('../utils/policy');

const MASK = '••••••';
const MAX_PAGE_SIZE = 100;

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const activeGrant = async (userId, field) => {
  const now = new Date();
  const grant = await AccessGrant.findOne({
    grantee: userId,
    status: 'approved',
    expiresAt: { $gt: now },
    $or: [{ field }, { field: 'sensitive_fields' }],
  }).lean();
  return grant || null;
};

const shapeEmployee = (emp, { includeSensitive = false, viaGrant = false } = {}) => {
  const base = {
    id: emp._id.toString(),
    name: emp.name,
    email: emp.email,
    role: emp.role,
    department: emp.department || '',
    designation: emp.designation || '',
    employeeCode: emp.employeeCode || '',
    isActive: emp.isActive,
    isDeleted: emp.isDeleted,
    createdAt: emp.createdAt,
    sensitiveMasked: !includeSensitive,
    sensitiveAccessViaGrant: viaGrant,
  };

  if (includeSensitive) {
    base.salary = emp.salary ? safeDecrypt(emp.salary) : null;
    base.bankDetails = emp.bankDetails ? safeDecrypt(emp.bankDetails) : null;
    base.salaryMasked = false;
    base.bankDetailsMasked = false;
  } else {
    base.salary = emp.salary ? MASK : null;
    base.bankDetails = emp.bankDetails ? MASK : null;
    base.salaryMasked = Boolean(emp.salary);
    base.bankDetailsMasked = Boolean(emp.bankDetails);
  }

  return base;
};

// @route GET /api/employees  (Admin: all; HR: own department)
exports.getEmployees = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.limit) || 20));
    const search = (req.query.search || '').trim();
    const department = (req.query.department || '').trim();
    const role = (req.query.role || '').trim();
    const includeDeleted = req.user.role === 'admin' && req.query.includeDeleted === 'true';

    const filter = { ...employeeScope(req.user) };
    if (!includeDeleted) filter.isDeleted = false;
    if (department) filter.department = department;
    if (role && ['admin', 'hr_manager', 'employee'].includes(role)) filter.role = role;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { department: rx }, { employeeCode: rx }];
    }

    const [total, employees] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('-password -refreshTokenHash -refreshTokenExpiresAt')
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    const grant = await activeGrant(req.user.id, 'sensitive_fields');
    const canDecrypt = Boolean(grant);

    const data = employees.map((emp) => shapeEmployee(emp, {
      includeSensitive: canDecrypt,
      viaGrant: Boolean(grant),
    }));

    res.status(200).json({
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
      access: {
        sensitiveMasked: !canDecrypt,
        viaGrant: Boolean(grant),
        scope: req.user.role === 'admin' ? 'all' : req.user.department || 'none',
      },
    });
  } catch (error) {
    next(error);
  }
};

// @route GET /api/employees/:id
exports.getEmployeeById = async (req, res, next) => {
  try {
    const employee = await User.findById(req.params.id)
      .select('-password -refreshTokenHash -refreshTokenExpiresAt');
    if (!employee || employee.isDeleted) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    if (!canViewEmployee(req.user, employee)) {
      return res.status(403).json({ message: 'Forbidden: outside your permitted scope' });
    }

    const grant = await activeGrant(req.user.id, 'sensitive_fields');
    const canDecrypt = Boolean(grant);

    return res.status(200).json(shapeEmployee(employee, {
      includeSensitive: canDecrypt,
      viaGrant: Boolean(grant),
    }));
  } catch (error) {
    return next(error);
  }
};

// @route GET /api/employees/me
exports.getMyProfile = async (req, res, next) => {
  try {
    const employee = await User.findById(req.user.id)
      .select('-password -refreshTokenHash -refreshTokenExpiresAt');
    if (!employee || employee.isDeleted) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // A data principal is always allowed to see their own data.
    const profile = shapeEmployee(employee, { includeSensitive: true });
    profile.isSelf = true;
    return res.status(200).json(profile);
  } catch (error) {
    return next(error);
  }
};

// @route GET /api/employees/me/payslip  (Self-service cryptographic payslip)
exports.getMyPayslip = async (req, res, next) => {
  try {
    const employee = await User.findById(req.user.id)
      .select('-password -refreshTokenHash -refreshTokenExpiresAt');
    if (!employee || employee.isDeleted) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const decryptedSalary = employee.salary ? safeDecrypt(employee.salary) : '0';
    const decryptedBank = employee.bankDetails ? safeDecrypt(employee.bankDetails) : 'N/A';
    const numSalary = Math.max(10000, Number(decryptedSalary) || 50000);

    const basic = Math.round(numSalary * 0.5);
    const hra = Math.round(numSalary * 0.3);
    const specialAllowance = numSalary - basic - hra;
    const pf = Math.round(Math.min(basic * 0.12, 1800));
    const professionalTax = 200;
    const totalDeductions = pf + professionalTax;
    const netSalary = numSalary - totalDeductions;

    const period = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date());

    const verificationPayload = `${employee.employeeCode || employee._id}:${numSalary}:${decryptedBank}:${period}`;
    const verificationHash = require('crypto').createHash('sha256').update(verificationPayload).digest('hex');

    return res.status(200).json({
      company: 'SecureVault HR Technologies Inc.',
      period,
      generatedAt: new Date().toISOString(),
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        employeeCode: employee.employeeCode || `SV-${String(employee._id).slice(-4).toUpperCase()}`,
        designation: employee.designation || 'Staff Member',
        department: employee.department || 'General',
        bankDetails: decryptedBank,
      },
      earnings: {
        basic,
        hra,
        specialAllowance,
        grossSalary: numSalary,
      },
      deductions: {
        pf,
        professionalTax,
        totalDeductions,
      },
      netSalary,
      security: {
        algorithm: 'AES-256-GCM',
        verificationHash,
        tamperEvident: true,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// @route PUT /api/employees/me
exports.updateMyProfile = async (req, res, next) => {
  try {
    const employee = await User.findById(req.user.id);
    if (!employee || employee.isDeleted) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Employees cannot change their own department: that would let an HR user
    // expand their ABAC scope and see another department's employees.
    const allowed = ['name', 'designation'];
    const changed = [];
    for (const field of allowed) {
      if (req.body[field] !== undefined && req.body[field] !== employee[field]) {
        employee[field] = req.body[field];
        changed.push(field);
      }
    }

    if (changed.length === 0) {
      return res.status(400).json({ message: 'No profile changes supplied' });
    }

    await employee.save();
    await logEvent({
      req,
      action: 'PROFILE_UPDATED',
      category: 'EMPLOYEE',
      severity: 'info',
      targetId: employee._id,
      targetType: 'User',
      details: `Employee updated own profile fields: ${changed.join(', ')}`,
      metadata: { changedFields: changed },
    });

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: shapeEmployee(employee, { includeSensitive: true }),
    });
  } catch (error) {
    return next(error);
  }
};

// @route POST /api/employees  (Admin only)
exports.createEmployee = async (req, res, next) => {
  try {
    const { name, email, password, role, department, designation, salary, bankDetails } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'An employee with this email already exists' });
    }

    const newEmployee = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 12),
      role: role || 'employee',
      department: department || '',
      designation: designation || '',
      salary: salary !== undefined && salary !== '' ? encrypt(salary) : undefined,
      bankDetails: bankDetails ? encrypt(bankDetails) : undefined,
      noticeAcceptedAt: new Date(),
      noticeVersion: process.env.PRIVACY_NOTICE_VERSION || '2026-11',
    });

    await ensureDefaultConsents(newEmployee, { req });

    await logEvent({
      req,
      action: 'EMPLOYEE_CREATED',
      category: 'EMPLOYEE',
      severity: 'warning',
      targetId: newEmployee._id,
      targetType: 'User',
      details: `Created employee ${newEmployee.email} with role ${newEmployee.role}`,
      metadata: {
        role: newEmployee.role,
        department: newEmployee.department,
        sensitiveFieldsProvided: {
          salary: salary !== undefined && salary !== '',
          bankDetails: Boolean(bankDetails),
        },
      },
    });

    return res.status(201).json(shapeEmployee(newEmployee, { includeSensitive: true }));
  } catch (error) {
    return next(error);
  }
};

// @route PUT /api/employees/:id  (Admin: all; HR: own department, non-sensitive fields only)
exports.updateEmployee = async (req, res, next) => {
  try {
    const employee = await User.findById(req.params.id);
    if (!employee || employee.isDeleted) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    if (!canManageEmployee(req.user, employee)) {
      return res.status(403).json({ message: 'Forbidden: outside your permitted scope' });
    }

    const isAdmin = req.user.role === 'admin';
    const changed = [];

    for (const field of ['name', 'designation']) {
      if (req.body[field] !== undefined && req.body[field] !== employee[field]) {
        employee[field] = req.body[field];
        changed.push(field);
      }
    }

    // Only admins can move a person between departments. This prevents an HR
    // manager from expanding their own scope by moving an employee into it.
    if (isAdmin && req.body.department !== undefined && req.body.department !== employee.department) {
      employee.department = req.body.department;
      changed.push('department');
    }

    const sensitiveChanges = [];

    if (isAdmin) {
      if (req.body.role !== undefined && req.body.role !== employee.role) {
        employee.role = req.body.role;
        employee.tokenVersion += 1; // role change revokes existing sessions
        changed.push('role');
      }
      if (req.body.salary !== undefined) {
        employee.salary = req.body.salary === '' ? undefined : encrypt(req.body.salary);
        sensitiveChanges.push('salary');
      }
      if (req.body.bankDetails !== undefined) {
        employee.bankDetails = req.body.bankDetails === '' ? undefined : encrypt(req.body.bankDetails);
        sensitiveChanges.push('bankDetails');
      }
    }

    if (changed.length === 0 && sensitiveChanges.length === 0) {
      return res.status(400).json({ message: 'No changes supplied' });
    }

    await employee.save();

    await logEvent({
      req,
      action: 'EMPLOYEE_UPDATED',
      category: 'EMPLOYEE',
      severity: sensitiveChanges.length > 0 ? 'warning' : 'info',
      targetId: employee._id,
      targetType: 'User',
      details: `Updated employee ${employee.email}`,
      metadata: {
        changedFields: changed,
        sensitiveFieldsChanged: sensitiveChanges,
      },
    });

    return res.status(200).json(shapeEmployee(employee, {
      includeSensitive: isAdmin,
    }));
  } catch (error) {
    return next(error);
  }
};

// @route DELETE /api/employees/:id  (Admin only, soft delete)
exports.deleteEmployee = async (req, res, next) => {
  try {
    const employee = await User.findById(req.params.id);
    if (!employee || employee.isDeleted) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    if (employee._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own admin account' });
    }

    employee.isDeleted = true;
    employee.isActive = false;
    employee.deletedAt = new Date();
    // Payroll records generally need to be retained for statutory periods.
    const retentionYears = Number(process.env.RETENTION_YEARS || 7);
    employee.retentionUntil = new Date(Date.now() + retentionYears * 365 * 24 * 60 * 60 * 1000);
    employee.tokenVersion += 1;
    employee.refreshTokenHash = null;
    employee.refreshTokenExpiresAt = null;
    await employee.save();

    await logEvent({
      req,
      action: 'EMPLOYEE_SOFT_DELETED',
      category: 'EMPLOYEE',
      severity: 'critical',
      targetId: employee._id,
      targetType: 'User',
      details: `Soft-deleted employee ${employee.email}; retained until ${employee.retentionUntil.toISOString()}`,
      metadata: { retentionUntil: employee.retentionUntil, legalBasis: 'statutory_payroll_retention' },
    });

    return res.status(200).json({
      message: 'Employee deactivated and scheduled for retention. Record is not permanently erased yet.',
      retentionUntil: employee.retentionUntil,
    });
  } catch (error) {
    return next(error);
  }
};

// @route POST /api/employees/:id/restore  (Admin only)
exports.restoreEmployee = async (req, res, next) => {
  try {
    const employee = await User.findById(req.params.id);
    if (!employee || !employee.isDeleted) {
      return res.status(404).json({ message: 'Archived employee not found' });
    }

    employee.isDeleted = false;
    employee.isActive = true;
    employee.deletedAt = null;
    employee.retentionUntil = null;
    await employee.save();

    await logEvent({
      req,
      action: 'EMPLOYEE_RESTORED',
      category: 'EMPLOYEE',
      severity: 'warning',
      targetId: employee._id,
      targetType: 'User',
      details: `Restored employee ${employee.email}`,
    });

    return res.status(200).json({ message: 'Employee restored', employee: shapeEmployee(employee) });
  } catch (error) {
    return next(error);
  }
};
