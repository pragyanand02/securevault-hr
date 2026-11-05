// Central authorisation policy (attribute-based rules on top of RBAC).
// Deny-by-default: a missing department or unknown role never grants access.

const isSelf = (actor, target) =>
  String(actor.id) === String(target._id || target.id || target);

const sameDepartment = (actor, target) => {
  const actorDept = (actor.department || '').trim().toLowerCase();
  const targetDept = (target.department || '').trim().toLowerCase();
  return Boolean(actorDept) && Boolean(targetDept) && actorDept === targetDept;
};

const canViewSensitive = (actor) => actor.role === 'admin';

const canViewEmployee = (actor, target) => {
  if (actor.role === 'admin') return true;
  if (actor.role === 'hr_manager') return sameDepartment(actor, target);
  return isSelf(actor, target);
};

const canManageEmployee = (actor, target) => {
  if (actor.role === 'admin') return true;
  if (actor.role === 'hr_manager') return sameDepartment(actor, target);
  return false;
};

const canReviewLeave = (actor, leaveOwner) => {
  if (actor.role === 'admin') return true;
  if (actor.role !== 'hr_manager') return false;
  if (isSelf(actor, leaveOwner)) return false; // cannot approve your own leave
  return sameDepartment(actor, leaveOwner);
};

const employeeScope = (actor) => {
  if (actor.role === 'admin') return {};
  if (actor.role === 'hr_manager') {
    return { department: actor.department || '__no_department__' };
  }
  return { _id: actor.id };
};

const ACCESS_MATRIX = [
  {
    field: 'Name, email, department, role',
    admin: 'Read / write (all)',
    hr_manager: 'Read / write (own department only)',
    employee: 'Read / write (self only)',
    reason: 'Needed for the employment relationship.',
  },
  {
    field: 'Salary',
    admin: 'Read / write (decryption is audit-logged)',
    hr_manager: 'Masked by default; needs time-bound JIT grant',
    employee: 'Read own (self-service)',
    reason: 'Financial data: minimum necessary access + purpose limitation.',
  },
  {
    field: 'Bank account details',
    admin: 'Read / write (decryption is audit-logged)',
    hr_manager: 'Masked by default; needs time-bound JIT grant',
    employee: 'Read own (self-service)',
    reason: 'High-risk financial identifier.',
  },
  {
    field: 'Leave records',
    admin: 'Read / approve (all)',
    hr_manager: 'Read / approve (own department)',
    employee: 'Create / read own / cancel pending',
    reason: 'Manager needs operational visibility, not company-wide visibility.',
  },
  {
    field: 'Audit trail',
    admin: 'Read + verify integrity',
    hr_manager: 'No access',
    employee: 'No access',
    reason: 'Separation of duties: the operator is not the auditor.',
  },
  {
    field: 'Consent & privacy requests',
    admin: 'Read / resolve requests',
    hr_manager: 'No access',
    employee: 'Read / grant / withdraw own consents',
    reason: 'Data-principal rights must be handled independently of HR.',
  },
];

module.exports = {
  isSelf,
  sameDepartment,
  canViewSensitive,
  canViewEmployee,
  canManageEmployee,
  canReviewLeave,
  employeeScope,
  ACCESS_MATRIX,
};
