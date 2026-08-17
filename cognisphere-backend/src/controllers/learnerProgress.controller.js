const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const LearnerProgress = require('../models/learnerProgress.model');
const Course = require('../models/course.model');
const User = require('../models/user.model');
const Tenant = require('../models/tenant.model');
const { buildCertificatePdfBuffer } = require('../utils/certificateGenerator');
const { recalculateOverallProgress, checkLessonOnlyModuleCompletion, issueCertificateIfNeeded } = require('../utils/progressEngine');

/**
 * @desc    Enroll into a course. Learners enroll themselves; HR admins can
 *          instead pass { userId } in the body to assign the course to a
 *          specific employee (Learner & Dept Directory "Assign course" action).
 * @route   POST /api/v1/progress/enroll/:courseId
 * @access  Private (learner enrolls self; hr_admin assigns to a tenant user)
 */
const enrollInCourse = asyncHandler(async (req, res) => {
  let targetUserId = req.user._id;
  let enrolledBy = null;

  if (req.user.role === 'hr_admin') {
    if (!req.body.userId) throw new ApiError(400, 'userId is required when assigning a course as HR.');
    const targetUser = await User.findOne({ _id: req.body.userId, tenantId: req.tenantId, role: 'learner' });
    if (!targetUser) throw new ApiError(404, 'Learner not found in this organization.');
    targetUserId = targetUser._id;
    enrolledBy = req.user._id;
  }

  const course = await Course.findOne({ _id: req.params.courseId, tenantId: req.tenantId, status: 'published' });
  if (!course) throw new ApiError(404, 'Course not found.');

  const existing = await LearnerProgress.findOne({
    tenantId: req.tenantId,
    userId: targetUserId,
    courseId: course._id,
  });
  if (existing) {
    return res.status(200).json(new ApiResponse(200, existing, 'Already enrolled.'));
  }

  const sortedModules = [...course.modules].sort((a, b) => a.order - b.order);
  const modulesProgress = sortedModules.map((mod, index) => ({
    moduleId: mod._id,
    status: index === 0 ? 'in_progress' : 'locked',
    lessonsProgress: mod.lessons.map((lesson) => ({
      lessonId: lesson._id,
      status: index === 0 ? 'not_started' : 'locked',
    })),
    quizAttempts: [],
    unlockedAt: index === 0 ? new Date() : null,
  }));

  const progress = await LearnerProgress.create({
    tenantId: req.tenantId,
    userId: targetUserId,
    courseId: course._id,
    enrolledBy,
    status: 'in_progress',
    startedAt: new Date(),
    modulesProgress,
  });

  course.stats.enrolledCount += 1;
  await course.save();

  await User.findByIdAndUpdate(targetUserId, { $addToSet: { enrolledCourseIds: course._id } });

  return res.status(201).json(new ApiResponse(201, progress, 'Enrolled successfully.'));
});

/**
 * @desc    Mark a lesson as completed (or update watch/read progress).
 *          Only lessons in an unlocked ('in_progress' or already
 *          'completed') module can be marked — this is the second half
 *          of the lock/unlock enforcement (the first half is the quiz
 *          gate in quiz.controller.js).
 * @route   PATCH /api/v1/progress/:courseId/lessons/:lessonId
 * @access  Private (learner)
 */
const markLessonProgress = asyncHandler(async (req, res) => {
  const { courseId, lessonId } = req.params;
  const { status, lastWatchedPositionSeconds, watchedPercent, timeSpentSeconds = 0 } = req.body;

  if (status && !['in_progress', 'completed'].includes(status)) {
    throw new ApiError(400, 'status must be either "in_progress" or "completed".');
  }

  const progress = await LearnerProgress.findOne({ tenantId: req.tenantId, userId: req.user._id, courseId });
  if (!progress) throw new ApiError(404, 'You are not enrolled in this course.');

  const moduleProgress = progress.modulesProgress.find((m) =>
    m.lessonsProgress.some((l) => l.lessonId.toString() === lessonId)
  );
  if (!moduleProgress) throw new ApiError(404, 'Lesson not found in your progress record.');

  if (moduleProgress.status === 'locked') {
    throw new ApiError(403, 'This module is locked. Complete the previous module quiz first.');
  }

  const lessonProgress = moduleProgress.lessonsProgress.find((l) => l.lessonId.toString() === lessonId);
  if (lessonProgress.status === 'locked') {
    throw new ApiError(403, 'This lesson is locked.');
  }

  if (!lessonProgress.startedAt) lessonProgress.startedAt = new Date();
  if (lastWatchedPositionSeconds !== undefined) lessonProgress.lastWatchedPositionSeconds = lastWatchedPositionSeconds;
  if (watchedPercent !== undefined) lessonProgress.watchedPercent = watchedPercent;
  lessonProgress.timeSpentSeconds = (lessonProgress.timeSpentSeconds || 0) + timeSpentSeconds;

  if (status === 'completed') {
    lessonProgress.status = 'completed';
    lessonProgress.completedAt = new Date();
  } else if (lessonProgress.status === 'locked' || lessonProgress.status === 'not_started') {
    lessonProgress.status = 'in_progress';
  }

  progress.totalTimeSpentSeconds = (progress.totalTimeSpentSeconds || 0) + timeSpentSeconds;

  // ---------- Completion check for quiz-less modules ----------
  // A module gated by a quiz only completes via quiz.controller.js#submitQuiz.
  // A module with NO quiz has nothing else to gate it, so finishing every
  // lesson in it is what completes the module and unlocks the next one.
  let nextModuleUnlocked = null;
  if (status === 'completed') {
    const course = await Course.findOne({ _id: courseId, tenantId: req.tenantId });
    if (course) {
      nextModuleUnlocked = checkLessonOnlyModuleCompletion(course, progress, moduleProgress.moduleId);
      recalculateOverallProgress(progress);

      if (progress.status === 'completed') {
        await issueCertificateIfNeeded({ req, course, user: req.user, tenant: req.tenant, progress });
      }
    }
  }

  await progress.save();

  return res.status(200).json(
    new ApiResponse(200, { progress, nextModuleUnlocked, courseCompleted: progress.status === 'completed' }, 'Lesson progress updated.')
  );
});

/**
 * @desc    Learner's own progress dashboard for one course
 *          (drives the Course Player's lock icons + progress bar).
 * @route   GET /api/v1/progress/:courseId
 * @access  Private (learner)
 */
const getMyCourseProgress = asyncHandler(async (req, res) => {
  const progress = await LearnerProgress.findOne({
    tenantId: req.tenantId,
    userId: req.user._id,
    courseId: req.params.courseId,
  });

  if (!progress) throw new ApiError(404, 'You are not enrolled in this course.');

  return res.status(200).json(new ApiResponse(200, progress));
});

/**
 * @desc    Learner's dashboard summary across ALL enrolled courses.
 * @route   GET /api/v1/progress/me/summary
 * @access  Private (learner)
 */
const getMyProgressSummary = asyncHandler(async (req, res) => {
  const records = await LearnerProgress.find({ tenantId: req.tenantId, userId: req.user._id })
    .populate('courseId', 'title thumbnailUrl category stats.totalDurationMinutes')
    .sort({ updatedAt: -1 });

  const totalTimeSpentSeconds = records.reduce((sum, r) => sum + (r.totalTimeSpentSeconds || 0), 0);

  const summary = {
    totalEnrolled: records.length,
    completed: records.filter((r) => r.status === 'completed').length,
    inProgress: records.filter((r) => r.status === 'in_progress').length,
    notStarted: records.filter((r) => r.status === 'not_started').length,
    certificatesEarned: records.filter((r) => r.certificate?.isIssued).length,
    totalHoursSpent: Math.round((totalTimeSpentSeconds / 3600) * 10) / 10,
    courses: records,
  };

  return res.status(200).json(new ApiResponse(200, summary));
});

/**
 * @desc    Every certificate this learner has earned, with course title —
 *          powers the Learner Profile's Certificates Vault grid.
 * @route   GET /api/v1/progress/me/certificates
 * @access  Private (learner)
 */
const getMyCertificates = asyncHandler(async (req, res) => {
  const records = await LearnerProgress.find({
    tenantId: req.tenantId,
    userId: req.user._id,
    'certificate.isIssued': true,
  }).populate('courseId', 'title category');

  const certificates = records.map((r) => ({
    courseId: r.courseId?._id,
    courseTitle: r.courseId?.title,
    category: r.courseId?.category,
    certificateUrl: r.certificate.certificateUrl,
    certificateCode: r.certificate.certificateCode,
    issuedAt: r.certificate.issuedAt,
  }));

  return res.status(200).json(new ApiResponse(200, certificates));
});

// ---------------------------------------------------------------------------
// HR ANALYTICS
// ---------------------------------------------------------------------------

/**
 * @desc    HR analytics for a single course: completion rate, pass rate,
 *          and per-department breakdown (the "heatmap" data source —
 *          frontend renders the grid, this endpoint supplies the matrix).
 * @route   GET /api/v1/progress/analytics/course/:courseId
 * @access  Private (hr_admin)
 */
const getCourseAnalytics = asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  const course = await Course.findOne({ _id: courseId, tenantId: req.tenantId });
  if (!course) throw new ApiError(404, 'Course not found.');

  const records = await LearnerProgress.find({ tenantId: req.tenantId, courseId }).populate(
    'userId',
    'fullName department jobTitle'
  );

  const totalEnrolled = records.length;
  const totalCompleted = records.filter((r) => r.status === 'completed').length;
  const completionRatePercent = totalEnrolled > 0 ? Math.round((totalCompleted / totalEnrolled) * 100) : 0;

  // Quiz pass-rate: across every attempt ever made on this course's quizzes
  let totalAttempts = 0;
  let totalPassed = 0;
  const departmentMap = {}; // department -> { enrolled, completed, avgProgress }

  for (const record of records) {
    const dept = record.userId?.department || 'Unassigned';
    if (!departmentMap[dept]) {
      departmentMap[dept] = { department: dept, enrolled: 0, completed: 0, totalProgressPercent: 0 };
    }
    departmentMap[dept].enrolled += 1;
    departmentMap[dept].totalProgressPercent += record.overallProgressPercent;
    if (record.status === 'completed') departmentMap[dept].completed += 1;

    for (const mod of record.modulesProgress) {
      for (const attempt of mod.quizAttempts) {
        totalAttempts += 1;
        if (attempt.passed) totalPassed += 1;
      }
    }
  }

  const departmentBreakdown = Object.values(departmentMap).map((d) => ({
    department: d.department,
    enrolled: d.enrolled,
    completed: d.completed,
    completionRatePercent: d.enrolled > 0 ? Math.round((d.completed / d.enrolled) * 100) : 0,
    averageProgressPercent: d.enrolled > 0 ? Math.round(d.totalProgressPercent / d.enrolled) : 0,
  }));

  // Per-learner activity rows, used for the HR "employee heatmap" table
  const learnerActivity = records.map((r) => ({
    userId: r.userId?._id,
    fullName: r.userId?.fullName,
    department: r.userId?.department,
    status: r.status,
    overallProgressPercent: r.overallProgressPercent,
    totalTimeSpentSeconds: r.totalTimeSpentSeconds,
    lastActivityAt: r.updatedAt,
  }));

  return res.status(200).json(
    new ApiResponse(200, {
      courseId,
      courseTitle: course.title,
      totalEnrolled,
      totalCompleted,
      completionRatePercent,
      quizPassRatePercent: totalAttempts > 0 ? Math.round((totalPassed / totalAttempts) * 100) : 0,
      totalQuizAttempts: totalAttempts,
      departmentBreakdown,
      learnerActivity,
    })
  );
});

/**
 * @desc    Tenant-wide HR dashboard summary across all courses
 *          (top cards on the HR Dashboard screen).
 * @route   GET /api/v1/progress/analytics/overview
 * @access  Private (hr_admin)
 */
const getTenantAnalyticsOverview = asyncHandler(async (req, res) => {
  const tenantObjectId = new mongoose.Types.ObjectId(req.tenantId);

  const [courseCount, userCount, progressAgg, allProgress, tenant] = await Promise.all([
    Course.countDocuments({ tenantId: req.tenantId, status: 'published' }),
    User.countDocuments({ tenantId: req.tenantId, role: 'learner', isActive: true }),
    LearnerProgress.aggregate([
      { $match: { tenantId: tenantObjectId } },
      {
        $group: {
          _id: null,
          totalEnrollments: { $sum: 1 },
          totalCompleted: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          avgProgressPercent: { $avg: '$overallProgressPercent' },
        },
      },
    ]),
    // Full docs needed for the monthly trend + pass/fail breakdown below —
    // these aren't easily expressed as a single aggregation given
    // modulesProgress.quizAttempts is a nested array of arrays.
    LearnerProgress.find({ tenantId: req.tenantId }).select('status completedAt modulesProgress.quizAttempts'),
    Tenant.findById(req.tenantId).select('usage limits'),
  ]);

  const stats = progressAgg[0] || { totalEnrollments: 0, totalCompleted: 0, avgProgressPercent: 0 };

  // ---------- Monthly completions, last 6 months ----------
  const now = new Date();
  const monthBuckets = [];
  for (let i = 5; i >= 0; i--) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets.push({ year: bucketDate.getFullYear(), month: bucketDate.getMonth(), label: bucketDate.toLocaleString('en-US', { month: 'short' }) });
  }
  const monthlyProgress = monthBuckets.map((bucket) => {
    const completions = allProgress.filter(
      (p) => p.completedAt && p.completedAt.getFullYear() === bucket.year && p.completedAt.getMonth() === bucket.month
    ).length;
    return { month: bucket.label, completions };
  });

  // ---------- Pass / fail ratio + average score across every quiz attempt tenant-wide ----------
  let passed = 0;
  let failed = 0;
  let scoreSum = 0;
  let attemptCount = 0;
  for (const p of allProgress) {
    for (const mod of p.modulesProgress || []) {
      for (const attempt of mod.quizAttempts || []) {
        if (attempt.passed) passed += 1;
        else failed += 1;
        scoreSum += attempt.scorePercent || 0;
        attemptCount += 1;
      }
    }
  }
  const averageQuizScorePercent = attemptCount > 0 ? Math.round(scoreSum / attemptCount) : 0;

  return res.status(200).json(
    new ApiResponse(200, {
      publishedCourses: courseCount,
      activeLearners: userCount,
      totalEnrollments: stats.totalEnrollments,
      totalCompletions: stats.totalCompleted,
      overallCompletionRatePercent:
        stats.totalEnrollments > 0 ? Math.round((stats.totalCompleted / stats.totalEnrollments) * 100) : 0,
      averageProgressPercent: Math.round(stats.avgProgressPercent || 0),
      averageQuizScorePercent,
      totalQuizAttempts: attemptCount,
      monthlyProgress,
      passFailRatio: { passed, failed },
      seatUsage: { used: tenant?.usage?.currentUserCount || 0, limit: tenant?.limits?.maxUsers ?? -1 },
      storageUsage: { usedMB: tenant?.usage?.currentStorageUsedMB || 0, limitGB: tenant?.limits?.maxStorageGB ?? -1 },
    })
  );
});

// ---------------------------------------------------------------------------
// CERTIFICATE
// ---------------------------------------------------------------------------

/**
 * @desc    Generate (or re-fetch) the learner's PDF certificate for a
 *          course they have completed 100%. Idempotent: the first call
 *          issues and persists the certificate (via the storage adapter —
 *          S3/R2 or local disk, whichever is active); subsequent calls
 *          re-render the same certificate data on the fly rather than
 *          re-uploading.
 *
 *          By default streams the PDF directly (Content-Type: application/pdf)
 *          so the frontend can open it in a new tab / trigger a download.
 *          Pass ?format=json to instead get back { certificateUrl, certificateCode, issuedAt }.
 *
 * @route   GET /api/v1/progress/certificate/:courseId
 * @access  Private (learner)
 */
const getCourseCertificate = asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  const progress = await LearnerProgress.findOne({ tenantId: req.tenantId, userId: req.user._id, courseId });
  if (!progress) throw new ApiError(404, 'You are not enrolled in this course.');

  if (progress.status !== 'completed') {
    throw new ApiError(
      403,
      `Certificate is only available after 100% course completion. Current progress: ${progress.overallProgressPercent}%.`
    );
  }

  const course = await Course.findOne({ _id: courseId, tenantId: req.tenantId });
  if (!course) throw new ApiError(404, 'Course not found.');

  if (course.certificate?.isEnabled === false) {
    throw new ApiError(403, 'Certificates are not enabled for this course.');
  }

  // ---------- Issue once, persist the record (usually a no-op here now —
  // the certificate is normally already issued automatically the moment
  // the course was completed, via issueCertificateIfNeeded in
  // quiz.controller.js / markLessonProgress below. This call is a safety
  // net for older progress docs or courses where certificates were
  // re-enabled after being off). ----------
  if (!progress.certificate?.isIssued) {
    await issueCertificateIfNeeded({ req, course, user: req.user, tenant: req.tenant, progress });
    await progress.save();
  }

  // ---------- JSON mode: just return the record ----------
  if (req.query.format === 'json') {
    return res.status(200).json(new ApiResponse(200, progress.certificate));
  }

  // ---------- Stream mode (default): render fresh and pipe as the response ----------
  const pdfBuffer = await buildCertificatePdfBuffer({
    learnerName: req.user.fullName,
    courseTitle: course.title,
    companyName: req.tenant?.companyName || 'CogniSphere',
    completionDate: progress.completedAt || new Date(),
    certificateCode: progress.certificate.certificateCode,
    signatureName: course.certificate?.signatureName || null,
    signatureTitle: course.certificate?.signatureTitle || null,
  });

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="certificate-${course.title.replace(/\s+/g, '-')}.pdf"`,
    'Content-Length': pdfBuffer.length,
  });

  return res.send(pdfBuffer);
});

/**
 * @desc    Full detail for ONE learner's progress on ONE course — every
 *          module status, every quiz attempt with per-question answers.
 *          Powers the "Learner Results & Vault" detail view / answer
 *          breakdown drawer.
 * @route   GET /api/v1/progress/learner/:userId/course/:courseId
 * @access  Private (hr_admin, tenant-scoped)
 */
const getLearnerCourseDetail = asyncHandler(async (req, res) => {
  const { userId, courseId } = req.params;

  const [progress, learner] = await Promise.all([
    LearnerProgress.findOne({ tenantId: req.tenantId, userId, courseId }),
    User.findOne({ _id: userId, tenantId: req.tenantId }).select('fullName email department jobTitle'),
  ]);

  if (!learner) throw new ApiError(404, 'Learner not found in this organization.');
  if (!progress) throw new ApiError(404, 'This learner is not enrolled in that course.');

  return res.status(200).json(new ApiResponse(200, { learner, progress }));
});

/**
 * @desc    Every learner who has earned a certificate for one course —
 *          powers the "issued certificates" list on the HR Certificate
 *          Engine screen, which previously only showed the config form
 *          with no visibility into who had actually completed it.
 * @route   GET /api/v1/progress/course/:courseId/certificates
 * @access  Private (hr_admin, tenant-scoped)
 */
const getIssuedCertificatesForCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  const records = await LearnerProgress.find({
    tenantId: req.tenantId,
    courseId,
    'certificate.isIssued': true,
  }).populate('userId', 'fullName email department');

  const certificates = records.map((r) => ({
    userId: r.userId?._id,
    fullName: r.userId?.fullName,
    email: r.userId?.email,
    department: r.userId?.department,
    certificateCode: r.certificate.certificateCode,
    certificateUrl: r.certificate.certificateUrl,
    issuedAt: r.certificate.issuedAt,
  }));

  return res.status(200).json(new ApiResponse(200, certificates));
});

module.exports = {
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
};
