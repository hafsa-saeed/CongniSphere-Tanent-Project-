const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const Quiz = require('../models/quiz.model');
const Course = require('../models/course.model');
const LearnerProgress = require('../models/learnerProgress.model');
const { recalculateOverallProgress, issueCertificateIfNeeded } = require('../utils/progressEngine');
const { generateAIText } = require('../services/aiService');

// ---------------------------------------------------------------------------
// AI QUIZ ARCHITECT — real model-backed generation
// ---------------------------------------------------------------------------

/**
 * @desc    Generates a quiz draft with a real Gemini API call, grounded in
 *          the ACTUAL selected course module's content (its title,
 *          description, and every lesson's title/text/media) rather than
 *          a free-text topic string. This is what makes the output
 *          genuinely module-relevant instead of generic — the model
 *          never sees anything except this specific module's real
 *          content and is instructed to answer strictly from it.
 *          HR still reviews and edits the draft before saving it as a
 *          real Quiz; nothing here saves anything itself.
 * @route   POST /api/v1/quizzes/generate-draft
 * @access  Private (hr_admin, tenant-scoped)
 */
const generateQuizDraft = asyncHandler(async (req, res) => {
  const { courseId, moduleId, questionCount = 10 } = req.body;

  if (!courseId || !moduleId) {
    throw new ApiError(400, 'courseId and moduleId are required.');
  }
  const count = Math.min(Math.max(parseInt(questionCount, 10) || 10, 1), 30);

  const course = await Course.findOne({ _id: courseId, tenantId: req.tenantId });
  if (!course) throw new ApiError(404, 'Course not found.');

  const moduleDef = course.modules.find((m) => m._id.toString() === moduleId);
  if (!moduleDef) throw new ApiError(404, 'Module not found in this course.');

  const lessonSummaries = (moduleDef.lessons || [])
    .map((l, i) => {
      const parts = [`Lesson ${i + 1}: "${l.title}"`];
      if (l.textContent) parts.push(`Content: ${l.textContent.slice(0, 600)}`);
      if (l.video?.url) parts.push('(this lesson includes a video)');
      if (l.pdf?.url) parts.push('(this lesson includes a PDF resource)');
      return parts.join(' — ');
    })
    .join('\n');

  const context =
    `Course: "${course.title}"\n` +
    (course.description ? `Course description: ${course.description}\n` : '') +
    `Module: "${moduleDef.title}"\n` +
    (moduleDef.description ? `Module description: ${moduleDef.description}\n` : '') +
    `Lessons in this module:\n${lessonSummaries || '(this module has no lesson content yet — base questions on the module and course title/description only)'}`;

  const systemPrompt =
    'You are an instructional designer writing a multiple-choice quiz for a corporate training module. ' +
    'You are given the EXACT course, module, and lesson content below — every question must be answerable ' +
    'strictly from this content. Never invent facts it does not imply, and never include any instructional ' +
    'or meta text (e.g. a restated prompt) inside a question — only genuine quiz content.\n\n' +
    'Respond with ONLY a valid JSON array, no markdown code fences, no commentary before or after it. ' +
    'Each array element must have exactly this shape:\n' +
    '{"question": string, "options": [string, string, string, string], "correctAnswerIndex": number, "explanation": string}\n\n' +
    `Generate exactly ${count} questions. Each question must have exactly 4 options — one clearly correct, ` +
    'three plausible but incorrect. correctAnswerIndex is the 0-based index of the correct option. ' +
    'explanation is 1-2 sentences justifying why that option is correct.';

  let raw;
  try {
    raw = await generateAIText({
      system: systemPrompt,
      messages: [{ role: 'user', content: context + '\n\nGenerate the quiz now as a JSON array only.' }],
      maxTokens: Math.min(700 * count, 8000),
    });
  } catch (err) {
    throw new ApiError(err.statusCode || 502, err.message);
  }

  const cleaned = raw
    .trim()
    .replace(/^```(json)?\s*/i, '')
    .replace(/```\s*$/i, '');

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new ApiError(502, 'The AI response was not valid JSON — please try generating again.');
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new ApiError(502, 'The AI did not return any questions — please try generating again.');
  }

  const questions = parsed
    .filter((q) => q && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length === 4)
    .map((q) => ({
      question: q.question,
      options: q.options.map(String),
      correctAnswerIndex:
        Number.isInteger(q.correctAnswerIndex) && q.correctAnswerIndex >= 0 && q.correctAnswerIndex <= 3
          ? q.correctAnswerIndex
          : 0,
      explanation: typeof q.explanation === 'string' ? q.explanation : '',
    }));

  if (questions.length === 0) {
    throw new ApiError(502, 'The AI response did not contain any usable questions — please try again.');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { questions, moduleTitle: moduleDef.title, courseTitle: course.title }));
});

// ---------------------------------------------------------------------------
// HR QUIZ MANAGEMENT (CRUD)
// ---------------------------------------------------------------------------

/**
 * @desc    Create a quiz attached to a course module (Quiz Creator screen)
 * @route   POST /api/v1/quizzes
 * @access  Private (hr_admin)
 */
const createQuiz = asyncHandler(async (req, res) => {
  const {
    courseId,
    moduleId,
    title,
    description,
    questions = [],
    passingThresholdPercent = 80,
    timeLimitMinutes,
    isTimed = false,
    maxAttempts = 3,
    cooldownMinutesBetweenAttempts = 0,
    shuffleQuestions = true,
    shuffleOptions = true,
    showCorrectAnswersAfterSubmit = true,
    showExplanations = true,
    questionsPerAttempt,
  } = req.body;

  if (!courseId || !moduleId || !title) {
    throw new ApiError(400, 'courseId, moduleId and title are required.');
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new ApiError(400, 'A quiz must have at least one question.');
  }

  const course = await Course.findOne({ _id: courseId, tenantId: req.tenantId });
  if (!course) throw new ApiError(404, 'Course not found.');

  const targetModule = course.modules.id(moduleId);
  if (!targetModule) throw new ApiError(404, 'Module not found on this course.');

  const normalizedQuestions = questions.map((q, index) => ({ ...q, order: q.order ?? index }));

  const quiz = await Quiz.create({
    tenantId: req.tenantId,
    courseId,
    moduleId,
    title,
    description,
    questions: normalizedQuestions,
    passingThresholdPercent,
    timeLimitMinutes,
    isTimed,
    maxAttempts,
    cooldownMinutesBetweenAttempts,
    shuffleQuestions,
    shuffleOptions,
    showCorrectAnswersAfterSubmit,
    showExplanations,
    questionsPerAttempt,
    createdBy: req.user._id,
  });

  // Link the quiz back onto the module so the course player knows which quiz gates it
  targetModule.quizId = quiz._id;
  await course.save();

  return res.status(201).json(new ApiResponse(201, quiz, 'Quiz created successfully.'));
});

/**
 * @desc    Update a quiz (questions, threshold, timing, retake policy)
 * @route   PATCH /api/v1/quizzes/:id
 * @access  Private (hr_admin)
 */
const updateQuiz = asyncHandler(async (req, res) => {
  const allowedFields = [
    'title',
    'description',
    'questions',
    'passingThresholdPercent',
    'timeLimitMinutes',
    'isTimed',
    'maxAttempts',
    'cooldownMinutesBetweenAttempts',
    'shuffleQuestions',
    'shuffleOptions',
    'showCorrectAnswersAfterSubmit',
    'showExplanations',
    'questionsPerAttempt',
    'isActive',
  ];

  const quiz = await Quiz.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!quiz) throw new ApiError(404, 'Quiz not found.');

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) quiz[field] = req.body[field];
  }

  await quiz.save();

  return res.status(200).json(new ApiResponse(200, quiz, 'Quiz updated successfully.'));
});

/**
 * @desc    Get a single quiz (HR editing view — includes correct answers)
 * @route   GET /api/v1/quizzes/:id
 * @access  Private (hr_admin)
 */
const getQuizById = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!quiz) throw new ApiError(404, 'Quiz not found.');
  return res.status(200).json(new ApiResponse(200, quiz));
});

/**
 * @desc    List all quizzes for a course
 * @route   GET /api/v1/quizzes?courseId=...
 * @access  Private (hr_admin)
 */
const getQuizzesForCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.query;
  if (!courseId) throw new ApiError(400, 'courseId query param is required.');

  const quizzes = await Quiz.find({ tenantId: req.tenantId, courseId }).sort({ createdAt: 1 });
  return res.status(200).json(new ApiResponse(200, quizzes));
});

/**
 * @desc    Delete a quiz
 * @route   DELETE /api/v1/quizzes/:id
 * @access  Private (hr_admin)
 */
const deleteQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
  if (!quiz) throw new ApiError(404, 'Quiz not found.');
  return res.status(200).json(new ApiResponse(200, null, 'Quiz deleted successfully.'));
});

/**
 * @desc    Learner-facing quiz fetch — question list WITHOUT correct answers exposed.
 * @route   GET /api/v1/quizzes/:id/take
 * @access  Private (learner)
 */
const getQuizForLearner = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findOne({ _id: req.params.id, tenantId: req.tenantId, isActive: true });
  if (!quiz) throw new ApiError(404, 'Quiz not found.');

  await enforceAttemptEligibility(quiz, req.user._id, req.tenantId);

  const sanitized = {
    _id: quiz._id,
    title: quiz.title,
    description: quiz.description,
    timeLimitMinutes: quiz.timeLimitMinutes,
    isTimed: quiz.isTimed,
    passingThresholdPercent: quiz.passingThresholdPercent,
    maxAttempts: quiz.maxAttempts,
    questions: quiz.questions.map((q) => ({
      _id: q._id,
      questionText: q.questionText,
      questionType: q.questionType,
      imageUrl: q.imageUrl,
      points: q.points,
      order: q.order,
      options: (q.options || []).map((o) => ({ _id: o._id, text: o.text })), // isCorrect stripped
    })),
  };

  return res.status(200).json(new ApiResponse(200, sanitized));
});

// ---------------------------------------------------------------------------
// LEARNER SUBMISSION + AUTOMATIC UNLOCK LOGIC
// ---------------------------------------------------------------------------

/**
 * Throws if the learner has exhausted attempts or is in a retake cooldown.
 */
async function enforceAttemptEligibility(quiz, userId, tenantId) {
  if (!quiz.maxAttempts) return; // 0/null = unlimited

  const progress = await LearnerProgress.findOne({ tenantId, userId, courseId: quiz.courseId });
  if (!progress) return;

  const moduleProgress = progress.modulesProgress.find((m) => m.moduleId.toString() === quiz.moduleId.toString());
  if (!moduleProgress) return;

  const attemptsUsed = moduleProgress.quizAttempts.filter((a) => a.quizId.toString() === quiz._id.toString()).length;

  if (attemptsUsed >= quiz.maxAttempts) {
    throw new ApiError(403, `Maximum attempts (${quiz.maxAttempts}) reached for this quiz.`);
  }

  if (quiz.cooldownMinutesBetweenAttempts > 0 && attemptsUsed > 0) {
    const lastAttempt = moduleProgress.quizAttempts
      .filter((a) => a.quizId.toString() === quiz._id.toString())
      .sort((a, b) => b.submittedAt - a.submittedAt)[0];

    const cooldownEndsAt = new Date(lastAttempt.submittedAt.getTime() + quiz.cooldownMinutesBetweenAttempts * 60000);
    if (cooldownEndsAt > new Date()) {
      throw new ApiError(429, `Please wait until ${cooldownEndsAt.toISOString()} before retaking this quiz.`);
    }
  }
}

/**
 * Grades a single question against the learner's submitted answer.
 */
function gradeQuestion(question, submittedAnswer) {
  if (!submittedAnswer) return { isCorrect: false, pointsAwarded: 0 };

  if (question.questionType === 'short_answer') {
    const isCorrect =
      (submittedAnswer.answerText || '').trim().toLowerCase() ===
      (question.correctAnswerText || '').trim().toLowerCase();
    return { isCorrect, pointsAwarded: isCorrect ? question.points : 0 };
  }

  // single_choice / true_false: exactly one correct option expected
  // multiple_choice: all correct options must be selected and no incorrect ones
  const correctOptionIds = question.options.filter((o) => o.isCorrect).map((o) => o._id.toString());
  const selectedIds = (submittedAnswer.selectedOptionIds || []).map((id) => id.toString());

  const isCorrect =
    correctOptionIds.length === selectedIds.length &&
    correctOptionIds.every((id) => selectedIds.includes(id));

  return { isCorrect, pointsAwarded: isCorrect ? question.points : 0 };
}

/**
 * Finds or creates the module's progress entry for this learner+course,
 * creating the parent LearnerProgress document if this is a first-ever
 * interaction with the course (defensive — normally created at enrollment).
 */
async function getOrCreateModuleProgress(tenantId, userId, courseId, moduleId, course) {
  let progress = await LearnerProgress.findOne({ tenantId, userId, courseId });

  if (!progress) {
    // Bootstrap progress doc: first module unlocked, rest locked — matches
    // the course's declared module order and each module's lockSettings.
    const modulesProgress = course.modules
      .sort((a, b) => a.order - b.order)
      .map((mod, index) => ({
        moduleId: mod._id,
        status: index === 0 ? 'in_progress' : 'locked',
        lessonsProgress: mod.lessons.map((lesson) => ({
          lessonId: lesson._id,
          status: index === 0 ? 'not_started' : 'locked',
        })),
        quizAttempts: [],
        unlockedAt: index === 0 ? new Date() : null,
      }));

    progress = await LearnerProgress.create({
      tenantId,
      userId,
      courseId,
      status: 'in_progress',
      startedAt: new Date(),
      modulesProgress,
    });
  }

  let moduleProgress = progress.modulesProgress.find((m) => m.moduleId.toString() === moduleId.toString());
  if (!moduleProgress) {
    // Module exists on the course but not yet tracked for this learner (e.g. added after enrollment)
    progress.modulesProgress.push({ moduleId, status: 'locked', lessonsProgress: [], quizAttempts: [] });
    moduleProgress = progress.modulesProgress[progress.modulesProgress.length - 1];
  }

  return { progress, moduleProgress };
}

/**
 * @desc    Submit a quiz attempt. Grades it, records the attempt, and —
 *          THE CORE UNLOCK LOGIC — if scorePercent >= passingThresholdPercent,
 *          flips the current module to 'completed' and the next module
 *          (by order) from 'locked' to 'in_progress'.
 * @route   POST /api/v1/quizzes/:id/submit
 * @access  Private (learner)
 */
const submitQuiz = asyncHandler(async (req, res) => {
  const { answers = [], startedAt, timeSpentSeconds = 0 } = req.body;

  const quiz = await Quiz.findOne({ _id: req.params.id, tenantId: req.tenantId, isActive: true });
  if (!quiz) throw new ApiError(404, 'Quiz not found.');

  await enforceAttemptEligibility(quiz, req.user._id, req.tenantId);

  const course = await Course.findOne({ _id: quiz.courseId, tenantId: req.tenantId });
  if (!course) throw new ApiError(404, 'Course not found.');

  // ---------- Grade the submission ----------
  let totalPointsAwarded = 0;
  const gradedAnswers = quiz.questions.map((question) => {
    const submitted = answers.find((a) => a.questionId === question._id.toString());
    const { isCorrect, pointsAwarded } = gradeQuestion(question, submitted);
    totalPointsAwarded += pointsAwarded;

    return {
      questionId: question._id,
      selectedOptionIds: submitted?.selectedOptionIds || [],
      answerText: submitted?.answerText || null,
      isCorrect,
      pointsAwarded,
    };
  });

  const scorePercent = quiz.totalPoints > 0 ? Math.round((totalPointsAwarded / quiz.totalPoints) * 100) : 0;
  const passed = scorePercent >= quiz.passingThresholdPercent;

  // ---------- Load/bootstrap progress + record the attempt ----------
  const { progress, moduleProgress } = await getOrCreateModuleProgress(
    req.tenantId,
    req.user._id,
    quiz.courseId,
    quiz.moduleId,
    course
  );

  const attemptNumber =
    moduleProgress.quizAttempts.filter((a) => a.quizId.toString() === quiz._id.toString()).length + 1;

  moduleProgress.quizAttempts.push({
    quizId: quiz._id,
    attemptNumber,
    answers: gradedAnswers,
    scorePercent,
    passed,
    timeSpentSeconds,
    startedAt: startedAt ? new Date(startedAt) : new Date(),
    submittedAt: new Date(),
  });

  moduleProgress.bestQuizScorePercent = Math.max(moduleProgress.bestQuizScorePercent || 0, scorePercent);

  let nextModuleUnlocked = null;

  // ---------- THE UNLOCK TRIGGER ----------
  if (passed) {
    moduleProgress.status = 'completed';
    moduleProgress.completedAt = new Date();

    const sortedModules = [...course.modules].sort((a, b) => a.order - b.order);
    const currentIndex = sortedModules.findIndex((m) => m._id.toString() === quiz.moduleId.toString());
    const nextModuleDef = sortedModules[currentIndex + 1];

    if (nextModuleDef) {
      let nextModuleProgress = progress.modulesProgress.find(
        (m) => m.moduleId.toString() === nextModuleDef._id.toString()
      );

      if (!nextModuleProgress) {
        progress.modulesProgress.push({ moduleId: nextModuleDef._id, status: 'locked', lessonsProgress: [], quizAttempts: [] });
        nextModuleProgress = progress.modulesProgress[progress.modulesProgress.length - 1];
      }

      if (nextModuleProgress.status === 'locked') {
        nextModuleProgress.status = 'in_progress';
        nextModuleProgress.unlockedAt = new Date();
        nextModuleProgress.lessonsProgress = nextModuleDef.lessons.map((lesson) => ({
          lessonId: lesson._id,
          status: 'not_started',
        }));
        nextModuleUnlocked = { moduleId: nextModuleDef._id, title: nextModuleDef.title };
      }
    }
  }

  recalculateOverallProgress(progress);

  if (progress.status === 'completed') {
    await issueCertificateIfNeeded({ req, course, user: req.user, tenant: req.tenant, progress });
  }

  await progress.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        scorePercent,
        passed,
        passingThresholdPercent: quiz.passingThresholdPercent,
        attemptNumber,
        attemptsRemaining: quiz.maxAttempts ? Math.max(quiz.maxAttempts - attemptNumber, 0) : null,
        moduleStatus: moduleProgress.status,
        nextModuleUnlocked,
        courseCompleted: progress.status === 'completed',
        certificateIssued: Boolean(progress.certificate?.isIssued),
        correctAnswers: quiz.showCorrectAnswersAfterSubmit
          ? quiz.questions.map((q) => ({
              questionId: q._id,
              correctOptionIds: (q.options || []).filter((o) => o.isCorrect).map((o) => o._id),
              explanation: quiz.showExplanations ? q.explanation : undefined,
            }))
          : undefined,
      },
      passed ? 'Quiz passed! Progress updated.' : 'Quiz submitted. Threshold not met.'
    )
  );
});

module.exports = {
  generateQuizDraft,
  createQuiz,
  updateQuiz,
  getQuizById,
  getQuizzesForCourse,
  deleteQuiz,
  getQuizForLearner,
  submitQuiz,
};
