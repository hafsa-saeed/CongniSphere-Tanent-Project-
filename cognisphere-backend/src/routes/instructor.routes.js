const express = require('express');
const { verifyJWT, authorizeRoles } = require('../middleware/auth.middleware');
const { requireTenant } = require('../middleware/tenant.middleware');
const {
  createInstructor,
  updateInstructor,
  listInstructors,
  getInstructorById,
  deleteInstructor,
} = require('../controllers/instructor.controller');

const router = express.Router();

router.use(verifyJWT, requireTenant);

router.post('/', authorizeRoles('hr_admin'), createInstructor);
router.get('/', authorizeRoles('hr_admin', 'learner'), listInstructors);
router.get('/:id', authorizeRoles('hr_admin', 'learner'), getInstructorById);
router.patch('/:id', authorizeRoles('hr_admin'), updateInstructor);
router.delete('/:id', authorizeRoles('hr_admin'), deleteInstructor);

module.exports = router;
