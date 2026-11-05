const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canViewEmployee,
  canManageEmployee,
  canReviewLeave,
  canViewSensitive,
  sameDepartment,
} = require('../utils/policy');

const admin = { id: '1', role: 'admin', department: 'Leadership' };
const hrEng = { id: '2', role: 'hr_manager', department: 'Engineering' };
const hrNoDept = { id: '3', role: 'hr_manager', department: '' };
const employeeEng = { id: '4', role: 'employee', department: 'Engineering' };
const employeeFin = { id: '5', role: 'employee', department: 'Finance' };

test('admin can view everyone; sensitive access is admin-only', () => {
  assert.equal(canViewEmployee(admin, employeeFin), true);
  assert.equal(canViewSensitive(admin), true);
  assert.equal(canViewSensitive(hrEng), false);
});

test('HR is scoped to their own department (ABAC, not just role)', () => {
  assert.equal(canViewEmployee(hrEng, employeeEng), true);
  assert.equal(canViewEmployee(hrEng, employeeFin), false);
  assert.equal(canManageEmployee(hrEng, employeeFin), false);
});

test('an HR manager without a department is denied by default', () => {
  assert.equal(sameDepartment(hrNoDept, employeeEng), false);
  assert.equal(canViewEmployee(hrNoDept, employeeEng), false);
});

test('employees can only view themselves', () => {
  assert.equal(canViewEmployee(employeeEng, { id: '4', department: 'Engineering' }), true);
  assert.equal(canViewEmployee(employeeEng, employeeFin), false);
});

test('leave review respects department and prevents self-approval', () => {
  assert.equal(canReviewLeave(hrEng, employeeEng), true);
  assert.equal(canReviewLeave(hrEng, employeeFin), false);
  assert.equal(canReviewLeave(hrEng, { id: '2', department: 'Engineering' }), false);
  assert.equal(canReviewLeave(admin, employeeFin), true);
});
