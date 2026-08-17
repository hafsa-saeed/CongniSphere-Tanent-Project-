const express = require('express');
const { verifyJWT, authorizeRoles } = require('../middleware/auth.middleware');
const { requireTenant } = require('../middleware/tenant.middleware');
const {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  getResourceLibrary,
} = require('../controllers/course.controller');

const router = express.Router();

// Every course route operates within a company subdomain.
router.use(verifyJWT, requireTenant);

router.post('/', authorizeRoles('hr_admin'), createCourse);
router.get('/', authorizeRoles('hr_admin', 'learner'), getCourses);
router.get('/resources/pdfs', authorizeRoles('learner', 'hr_admin'), getResourceLibrary);
router.get('/:id', authorizeRoles('hr_admin', 'learner'), getCourseById);
router.patch('/:id', authorizeRoles('hr_admin'), updateCourse);
router.delete('/:id', authorizeRoles('hr_admin'), deleteCourse);

module.exports = router;
