const { body, param, validationResult } = require('express-validator');
const Consent = require('../models/Consent');
const { isStrongEnoughPassword } = require('../utils/request');

exports.handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map(({ path, msg }) => ({ field: path, message: msg })),
    });
  }
  next();
};

const passwordRule = (field = 'password') =>
  body(field)
    .isString()
    .custom((value) => {
      if (!isStrongEnoughPassword(value)) {
        throw new Error('Password must be 10+ characters with upper, lower, number and symbol');
      }
      return true;
    });

const salaryRule = body('salary')
  .optional({ values: 'falsy' })
  .isFloat({ min: 0, max: 100000000 })
  .withMessage('Salary must be a positive number');

exports.registerRules = [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 characters'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  passwordRule('password'),
  body('department').optional().trim().isLength({ max: 80 }),
  body('acceptNotice').optional().isBoolean().toBoolean(),
];

exports.loginRules = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isString().notEmpty().withMessage('Password is required'),
];

exports.changePasswordRules = [
  body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
  passwordRule('newPassword'),
];

exports.leaveRules = [
  body('startDate').isISO8601().withMessage('Valid start date is required').toDate(),
  body('endDate')
    .isISO8601()
    .withMessage('Valid end date is required')
    .toDate()
    .custom((endDate, { req }) => {
      if (req.body.startDate && endDate < req.body.startDate) {
        throw new Error('End date cannot be before start date');
      }
      return true;
    }),
  body('reason').trim().isLength({ min: 5, max: 500 }).withMessage('Reason must be 5-500 characters'),
];

exports.createEmployeeRules = [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 characters'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  passwordRule('password'),
  body('role').optional().isIn(['admin', 'hr_manager', 'employee']).withMessage('Invalid role'),
  body('department').optional().trim().isLength({ max: 80 }),
  body('designation').optional().trim().isLength({ max: 120 }),
  salaryRule,
  body('bankDetails').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
];

exports.updateEmployeeRules = [
  body('name').optional().trim().isLength({ min: 2, max: 120 }),
  body('department').optional().trim().isLength({ max: 80 }),
  body('designation').optional().trim().isLength({ max: 120 }),
  body('role').optional().isIn(['admin', 'hr_manager', 'employee']).withMessage('Invalid role'),
  salaryRule,
  body('bankDetails').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
];

exports.profileUpdateRules = [
  body('name').optional().trim().isLength({ min: 2, max: 120 }),
  body('department').optional().trim().isLength({ max: 80 }),
  body('designation').optional().trim().isLength({ max: 120 }),
];

exports.consentRules = [
  body('purpose').isIn(Consent.PURPOSES).withMessage('Unknown consent purpose'),
  body('granted').isBoolean().withMessage('granted must be true or false').toBoolean(),
];

exports.accessRequestRules = [
  body('reason').trim().isLength({ min: 10, max: 500 }).withMessage('Give a reason of 10-500 characters'),
  body('field').optional().isIn(['salary', 'bankDetails', 'sensitive_fields']),
  body('scope').optional().isIn(['department', 'all']),
];

exports.accessReviewRules = [
  body('status').isIn(['approved', 'denied']).withMessage('Status must be approved or denied'),
  body('durationMinutes').optional().isInt({ min: 5, max: 480 }).toInt(),
  body('reviewNote').optional().trim().isLength({ max: 500 }),
];

exports.erasureRules = [
  body('reason').optional().trim().isLength({ max: 1000 }),
];

exports.dataRequestReviewRules = [
  body('status').isIn(['in_review', 'completed', 'rejected', 'deferred']).withMessage('Invalid status'),
  body('resolutionNote').optional().trim().isLength({ max: 1000 }),
];

exports.objectIdParam = (name = 'id') => [
  param(name).isMongoId().withMessage('Invalid record id'),
];
