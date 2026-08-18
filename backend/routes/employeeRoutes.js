const express = require('express');
const router = express.Router();
const {
  getEmployees,
  getMyProfile,
  updateMyProfile,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} = require('../controllers/employeeController');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createEmployeeRules,
  updateEmployeeRules,
  profileUpdateRules,
  handleValidation,
} = require('../middleware/validators');

router.use(protect); // all routes below require a valid JWT

router.get('/me', getMyProfile); // any logged-in user - own profile
router.put('/me', profileUpdateRules, handleValidation, updateMyProfile); // user update own profile
router.get('/', authorize('admin', 'hr_manager'), getEmployees);
router.post('/', authorize('admin'), createEmployeeRules, handleValidation, createEmployee);
router.put('/:id', authorize('admin', 'hr_manager'), updateEmployeeRules, handleValidation, updateEmployee);
router.delete('/:id', authorize('admin'), deleteEmployee);

module.exports = router;

