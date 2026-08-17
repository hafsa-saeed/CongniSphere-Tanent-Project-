const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: true }
);

const questionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true },
    questionType: {
      type: String,
      enum: ['single_choice', 'multiple_choice', 'true_false', 'short_answer'],
      default: 'single_choice',
    },
    options: [optionSchema], // not used for short_answer
    correctAnswerText: { type: String, default: null }, // used only for short_answer
    explanation: { type: String, default: null }, // shown after answering, if enabled
    points: { type: Number, default: 1 },
    order: { type: Number, required: true },
    imageUrl: { type: String, default: null },
  },
  { _id: true }
);

/**
 * A Quiz belongs to a tenant and is attached to a Course module.
 * The passing threshold + retake policy here directly drive the
 * lock/unlock logic evaluated in learnerProgress.model.js.
 */
const quizSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    moduleId: { type: mongoose.Schema.Types.ObjectId, required: true }, // subdocument _id within Course.modules

    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },

    questions: [questionSchema],
    totalPoints: { type: Number, default: 0 }, // recalculated on save from questions

    // ---------- Threshold / Grading ----------
    passingThresholdPercent: {
      type: Number,
      required: true,
      default: 80, // e.g. "80% to unlock next lesson"
      min: 0,
      max: 100,
    },

    // ---------- Timing ----------
    timeLimitMinutes: { type: Number, default: null }, // null = untimed
    isTimed: { type: Boolean, default: false },

    // ---------- Retake policy ----------
    maxAttempts: { type: Number, default: 3 }, // 0/null = unlimited
    cooldownMinutesBetweenAttempts: { type: Number, default: 0 },

    // ---------- Display / behavior settings ----------
    shuffleQuestions: { type: Boolean, default: true },
    shuffleOptions: { type: Boolean, default: true },
    showCorrectAnswersAfterSubmit: { type: Boolean, default: true },
    showExplanations: { type: Boolean, default: true },
    questionsPerAttempt: { type: Number, default: null }, // null = show all questions

    isActive: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

quizSchema.pre('save', function recalcTotalPoints(next) {
  this.totalPoints = this.questions.reduce((sum, q) => sum + (q.points || 0), 0);
  next();
});

quizSchema.index({ tenantId: 1, courseId: 1 });

module.exports = mongoose.model('Quiz', quizSchema);
