const express = require('express');
const router = express.Router();
const {
  getEmployees,
  getEmployeeById,
  getMyProfile,
  updateMyProfile,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  restoreEmployee,
} = require('../controllers/employeeController');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createEmployeeRules,
  updateEmployeeRules,
  profileUpdateRules,
  objectIdParam,
  handleValidation,
} = require('../middleware/validators');

router.use(protect);

router.get('/me', getMyProfile);
router.put('/me', profileUpdateRules, handleValidation, updateMyProfile);

router.get('/', authorize('admin', 'hr_manager'), getEmployees);
router.post('/', authorize('admin'), createEmployeeRules, handleValidation, createEmployee);

router.get('/:id', authorize('admin', 'hr_manager'), objectIdParam('id'), handleValidation, getEmployeeById);
router.put('/:id', authorize('admin', 'hr_manager'), objectIdParam('id'), updateEmployeeRules, handleValidation, updateEmployee);
router.delete('/:id', authorize('admin'), objectIdParam('id'), handleValidation, deleteEmployee);
router.post('/:id/restore', authorize('admin'), objectIdParam('id'), handleValidation, restoreEmployee);

module.exports = router;
