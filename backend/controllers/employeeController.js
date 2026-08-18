const User = require('../models/User');
const { encrypt, decrypt } = require('../utils/encryption');
const { logAction } = require('../middleware/auditLogger');

// Helper: shapes an employee doc for the response based on requester's role
const shapeEmployee = (emp, requesterRole) => {
  const base = {
    id: emp._id,
    name: emp.name,
    email: emp.email,
    role: emp.role,
    department: emp.department,
  };
  // Only Admin can see decrypted salary/bank details
  if (requesterRole === 'admin') {
    base.salary = emp.salary ? decrypt(emp.salary) : undefined;
    base.bankDetails = emp.bankDetails ? decrypt(emp.bankDetails) : undefined;
  }
  return base;
};

// @route GET /api/employees   (Admin, HR Manager)
exports.getEmployees = async (req, res) => {
  try {
    const employees = await User.find().select('-password');
    const shaped = employees.map((e) => shapeEmployee(e, req.user.role));
    res.status(200).json(shaped);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route GET /api/employees/me   (logged-in user's own profile)
exports.getMyProfile = async (req, res) => {
  try {
    const employee = await User.findById(req.user.id).select('-password');
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.status(200).json(shapeEmployee(employee, req.user.role));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route PUT /api/employees/me   (logged-in user updates own profile)
exports.updateMyProfile = async (req, res) => {
  try {
    const employee = await User.findById(req.user.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const { name, department } = req.body;
    if (name) employee.name = name;
    if (department !== undefined) employee.department = department;

    await employee.save();
    await logAction(req.user.id, 'UPDATE_PROFILE', employee._id, `User updated profile (${employee.email})`);

    res.status(200).json({
      message: 'Profile updated successfully',
      user: shapeEmployee(employee, req.user.role),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route POST /api/employees   (Admin only)
exports.createEmployee = async (req, res) => {
  try {
    const { name, email, password, role, department, salary, bankDetails } = req.body;
    const bcrypt = require('bcryptjs');

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Employee with this email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newEmployee = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'employee',
      department,
      salary: salary ? encrypt(salary) : undefined,
      bankDetails: bankDetails ? encrypt(bankDetails) : undefined,
    });

    await logAction(req.user.id, 'CREATE_EMPLOYEE', newEmployee._id, `Created employee ${newEmployee.email}`);

    res.status(201).json(shapeEmployee(newEmployee, req.user.role));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route PUT /api/employees/:id   (Admin, HR Manager - HR cannot touch salary/bankDetails/role)
exports.updateEmployee = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const { name, department, role, salary, bankDetails } = req.body;

    if (name !== undefined) employee.name = name;
    if (department !== undefined) employee.department = department;

    // Only Admin is allowed to update sensitive fields and user role
    if (req.user.role === 'admin') {
      if (role !== undefined && ['admin', 'hr_manager', 'employee'].includes(role)) {
        employee.role = role;
      }
      if (salary !== undefined) employee.salary = encrypt(salary);
      if (bankDetails !== undefined) employee.bankDetails = encrypt(bankDetails);
    }

    await employee.save();
    await logAction(req.user.id, 'UPDATE_EMPLOYEE', employee._id, `Updated employee ${employee.email}`);

    res.status(200).json(shapeEmployee(employee, req.user.role));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route DELETE /api/employees/:id   (Admin only)
exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    await employee.deleteOne();
    await logAction(req.user.id, 'DELETE_EMPLOYEE', req.params.id, `Deleted employee ${employee.email}`);

    res.status(200).json({ message: 'Employee deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

