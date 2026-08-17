const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema(
  {
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    attemptNumber: { type: Number, required: true },
    // Per-question answer log, useful for review screens and analytics
    answers: [
      {
        questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
        selectedOptionIds: [{ type: mongoose.Schema.Types.ObjectId }],
        answerText: { type: String, default: null }, // for short_answer
        isCorrect: { type: Boolean, default: false },
        pointsAwarded: { type: Number, default: 0 },
      },
    ],
    scorePercent: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    timeSpentSeconds: { type: Number, default: 0 },
    startedAt: { type: Date, required: true },
    submittedAt: { type: Date, required: true },
  },
  { _id: true }
);

const lessonProgressSchema = new mongoose.Schema(
  {
    lessonId: { type: mongoose.Schema.Types.ObjectId, required: true },
    status: {
      type: String,
      enum: ['locked', 'not_started', 'in_progress', 'completed'],
      default: 'locked',
    },
    // For videos: last watched position, used to resume playback
    lastWatchedPositionSeconds: { type: Number, default: 0 },
    watchedPercent: { type: Number, default: 0 },
    timeSpentSeconds: { type: Number, default: 0 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const moduleProgressSchema = new mongoose.Schema(
  {
    moduleId: { type: mongoose.Schema.Types.ObjectId, required: true },
    status: {
      type: String,
      enum: ['locked', 'not_started', 'in_progress', 'completed'],
      default: 'locked',
    },
    lessonsProgress: [lessonProgressSchema],
    quizAttempts: [quizAttemptSchema],
    bestQuizScorePercent: { type: Number, default: 0 },
    unlockedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

/**
 * One document per (tenant, learner, course) enrollment.
 * This is the single source of truth for:
 *  - which modules/lessons are locked vs unlocked for this learner
 *  - quiz attempt history and scores
 *  - overall completion % used in HR heatmaps and department reports
 */
const learnerProgressSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },

    enrolledAt: { type: Date, default: Date.now },
    enrolledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = self-enrolled

    modulesProgress: [moduleProgressSchema],

    overallProgressPercent: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed', 'overdue'],
      default: 'not_started',
      index: true,
    },

    dueDate: { type: Date, default: null }, // for mandatory/compliance training
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    totalTimeSpentSeconds: { type: Number, default: 0 },

    certificate: {
      isIssued: { type: Boolean, default: false },
      issuedAt: { type: Date, default: null },
      certificateUrl: { type: String, default: null },
      certificateCode: { type: String, default: null }, // for public verification
    },
  },
  { timestamps: true }
);

// A learner can only have one progress record per course, per tenant
learnerProgressSchema.index({ tenantId: 1, userId: 1, courseId: 1 }, { unique: true });
// Powers HR "completion heatmap" and department reports
learnerProgressSchema.index({ tenantId: 1, courseId: 1, status: 1 });

module.exports = mongoose.model('LearnerProgress', learnerProgressSchema);
