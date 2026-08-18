const express = require('express');
const { verifyJWT, authorizeRoles } = require('../middleware/auth.middleware');
const { requireTenant } = require('../middleware/tenant.middleware');
const {
  generateQuizDraft,
  createQuiz,
  updateQuiz,
  getQuizById,
  getQuizzesForCourse,
  deleteQuiz,
  getQuizForLearner,
  submitQuiz,
} = require('../controllers/quiz.controller');

const router = express.Router();

router.use(verifyJWT, requireTenant);

// ---------- HR management ----------
router.post('/generate-draft', authorizeRoles('hr_admin'), generateQuizDraft);
router.post('/', authorizeRoles('hr_admin'), createQuiz);
router.get('/', authorizeRoles('hr_admin'), getQuizzesForCourse);
router.get('/:id', authorizeRoles('hr_admin'), getQuizById);
router.patch('/:id', authorizeRoles('hr_admin'), updateQuiz);
router.delete('/:id', authorizeRoles('hr_admin'), deleteQuiz);

// ---------- Learner taking ----------
router.get('/:id/take', authorizeRoles('learner'), getQuizForLearner);
router.post('/:id/submit', authorizeRoles('learner'), submitQuiz);

module.exports = router;
