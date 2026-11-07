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

// Plain-language answer to "who controls access, why, and what do we gain?".
// Shown in the app (Access Policy page) so the answers live with the system.
const ROLE_GUIDE = [
  {
    role: 'admin',
    title: 'Admin (Company owner / Compliance head)',
    who: '1-2 senior, trusted people. In a 200-person company: the owner, the IT head or the compliance officer.',
    handles: [
      'Creates and deactivates accounts',
      'Approves or rejects HR requests for salary/bank access',
      'Resolves employee privacy requests (access, correction, erasure, grievance)',
      'Reviews the audit trail and registers data-breach incidents',
    ],
    why: 'The law holds the company (Data Fiduciary) accountable. Someone senior must own that responsibility, and every action they take is recorded, so that responsibility is provable.',
    cannot: [
      'Approve their own access request',
      'Edit or delete the audit trail (it is hash-chained)',
      'Read salary without leaving a critical audit event',
    ],
    benefit: 'One clearly accountable owner. If a regulator or employee asks "who saw what?", there is a verifiable answer.',
  },
  {
    role: 'hr_manager',
    title: 'HR Manager (department HR)',
    who: 'The HR person responsible for one department, for example HR-Engineering or HR-Finance.',
    handles: [
      'Day-to-day records of employees in their own department',
      'Leave approvals for their own department',
      'Requests temporary salary/bank access when payroll work genuinely needs it',
    ],
    why: 'HR needs enough data to do the job and no more (need-to-know). Salary and bank details are masked by default because most HR tasks do not need them.',
    cannot: [
      'See other departments',
      'See salary/bank without an admin-approved, auto-expiring grant',
      'Read the audit trail or approve their own leave',
    ],
    benefit: 'If one HR account is misused or hacked, the damage is limited to one department and, by default, no salary data.',
  },
  {
    role: 'employee',
    title: 'Employee (data principal)',
    who: 'Every staff member. It is their personal data.',
    handles: [
      'Views and updates their own profile',
      'Grants or withdraws optional consents',
      'Exports their data, requests correction or erasure, raises a grievance',
    ],
    why: 'The DPDP Act gives the person the rights over their own data. The system makes those rights usable instead of an email to HR.',
    cannot: [
      'See any other employee',
      'Change their own department or role',
    ],
    benefit: 'Trust and transparency: employees can see what is held about them and why, and exercise rights within a 30-day target.',
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
  ROLE_GUIDE,
};
