const crypto = require('crypto');
const { buildCertificatePdfBuffer } = require('./certificateGenerator');
const { saveFile } = require('../config/storage');

/**
 * Recalculates progress.overallProgressPercent and progress.status from
 * the current state of progress.modulesProgress. Mutates `progress` in
 * place; the caller is responsible for progress.save().
 *
 * Shared by quiz.controller.js (after a quiz-gated module completes) and
 * learnerProgress.controller.js (after a quiz-less module completes via
 * lessons alone) — previously this only lived in quiz.controller.js,
 * which meant a course made entirely of lesson content with no quizzes
 * could never be marked complete.
 */
function recalculateOverallProgress(progress) {
  const total = progress.modulesProgress.length;
  if (total === 0) return;

  const completed = progress.modulesProgress.filter((m) => m.status === 'completed').length;
  progress.overallProgressPercent = Math.round((completed / total) * 100);

  if (completed === total) {
    progress.status = 'completed';
    progress.completedAt = progress.completedAt || new Date();
  } else if (completed > 0 || progress.modulesProgress.some((m) => m.status === 'in_progress')) {
    progress.status = 'in_progress';
  }
}

/**
 * Called after a lesson is marked complete. If the module that lesson
 * belongs to has NO quiz gating it, and every lesson in that module is
 * now complete, the module itself is marked 'completed' and the next
 * module (by order) is unlocked — mirroring quiz.controller.js's
 * quiz-pass unlock logic, but for quiz-less modules.
 *
 * Returns the unlocked-module info (or null) so the caller can surface
 * it the same way submitQuiz does.
 */
function checkLessonOnlyModuleCompletion(course, progress, moduleId) {
  const moduleDef = course.modules.find((m) => m._id.toString() === moduleId.toString());
  const moduleProgress = progress.modulesProgress.find((m) => m.moduleId.toString() === moduleId.toString());
  if (!moduleDef || !moduleProgress) return null;

  // A quiz-gated module is only ever marked complete by passing that quiz
  // (see quiz.controller.js#submitQuiz) — finishing the lessons alone
  // isn't sufficient when a quiz is attached.
  if (moduleDef.quizId) return null;

  if (moduleProgress.status === 'completed') return null;
  const allLessonsDone =
    moduleProgress.lessonsProgress.length > 0 && moduleProgress.lessonsProgress.every((l) => l.status === 'completed');
  if (!allLessonsDone) return null;

  moduleProgress.status = 'completed';
  moduleProgress.completedAt = new Date();

  const sortedModules = [...course.modules].sort((a, b) => a.order - b.order);
  const currentIndex = sortedModules.findIndex((m) => m._id.toString() === moduleId.toString());
  const nextModuleDef = sortedModules[currentIndex + 1];

  let nextModuleUnlocked = null;
  if (nextModuleDef) {
    let nextModuleProgress = progress.modulesProgress.find((m) => m.moduleId.toString() === nextModuleDef._id.toString());
    if (!nextModuleProgress) {
      progress.modulesProgress.push({ moduleId: nextModuleDef._id, status: 'locked', lessonsProgress: [], quizAttempts: [] });
      nextModuleProgress = progress.modulesProgress[progress.modulesProgress.length - 1];
    }
    if (nextModuleProgress.status === 'locked') {
      nextModuleProgress.status = 'in_progress';
      nextModuleProgress.unlockedAt = new Date();
      nextModuleProgress.lessonsProgress = nextModuleDef.lessons.map((lesson) => ({ lessonId: lesson._id, status: 'not_started' }));
      nextModuleUnlocked = { moduleId: nextModuleDef._id, title: nextModuleDef.title };
    }
  }

  return nextModuleUnlocked;
}

/**
 * Auto-issues a certificate the instant a course flips to 'completed' —
 * called right after recalculateOverallProgress from BOTH the quiz
 * submission path and the lesson-completion path, so a learner's
 * certificate is ready the moment they finish, not only when they
 * happen to open the Certificates Vault. Idempotent: safe to call even
 * when a certificate was already issued, or when the course isn't
 * actually complete yet — it just no-ops.
 */
async function issueCertificateIfNeeded({ req, course, user, tenant, progress }) {
  if (progress.status !== 'completed') return;
  if (progress.certificate?.isIssued) return;
  if (course.certificate?.isEnabled === false) return;

  const certificateCode = crypto.randomBytes(6).toString('hex').toUpperCase();

  const pdfBuffer = await buildCertificatePdfBuffer({
    learnerName: user.fullName,
    courseTitle: course.title,
    companyName: tenant?.companyName || 'CogniSphere',
    completionDate: progress.completedAt || new Date(),
    certificateCode,
    signatureName: course.certificate?.signatureName || null,
    signatureTitle: course.certificate?.signatureTitle || null,
  });

  const filename = `certificate-${progress._id}.pdf`;
  const url = await saveFile({
    req,
    buffer: pdfBuffer,
    kind: 'certificate',
    tenantFolder: tenant._id.toString(),
    filename,
    mimetype: 'application/pdf',
  });

  progress.certificate = {
    isIssued: true,
    issuedAt: new Date(),
    certificateUrl: url,
    certificateCode,
  };
}

module.exports = { recalculateOverallProgress, checkLessonOnlyModuleCompletion, issueCertificateIfNeeded };
