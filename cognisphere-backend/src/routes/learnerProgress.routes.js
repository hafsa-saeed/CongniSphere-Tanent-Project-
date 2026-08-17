const express = require('express');
const { verifyJWT, authorizeRoles } = require('../middleware/auth.middleware');
const { requireTenant } = require('../middleware/tenant.middleware');
const {
  enrollInCourse,
  markLessonProgress,
  getMyCourseProgress,
  getMyProgressSummary,
  getMyCertificates,
  getCourseAnalytics,
  getTenantAnalyticsOverview,
  getCourseCertificate,
  getLearnerCourseDetail,
  getIssuedCertificatesForCourse,
} = require('../controllers/learnerProgress.controller');

const router = express.Router();

router.use(verifyJWT, requireTenant);

// ---------- Learner ----------
router.post('/enroll/:courseId', authorizeRoles('learner', 'hr_admin'), enrollInCourse);
router.patch('/:courseId/lessons/:lessonId', authorizeRoles('learner'), markLessonProgress);
router.get('/me/summary', authorizeRoles('learner'), getMyProgressSummary);
router.get('/me/certificates', authorizeRoles('learner'), getMyCertificates);
router.get('/certificate/:courseId', authorizeRoles('learner'), getCourseCertificate);

// ---------- HR Analytics & Results Vault ----------
router.get('/analytics/overview', authorizeRoles('hr_admin'), getTenantAnalyticsOverview);
router.get('/analytics/course/:courseId', authorizeRoles('hr_admin'), getCourseAnalytics);
router.get('/learner/:userId/course/:courseId', authorizeRoles('hr_admin'), getLearnerCourseDetail);
router.get('/course/:courseId/certificates', authorizeRoles('hr_admin'), getIssuedCertificatesForCourse);

router.get('/:courseId', authorizeRoles('learner', 'hr_admin'), getMyCourseProgress);

module.exports = router;
