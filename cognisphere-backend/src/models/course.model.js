const mongoose = require('mongoose');

/**
 * A single piece of content inside a module: a video lecture or a PDF.
 * Lessons are ordered and can be locked until the previous lesson
 * (or its quiz) is completed — this drives the "Course Player" UI.
 */
const lessonSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    order: { type: Number, required: true }, // drag-and-drop position within the module

    contentType: {
      type: String,
      enum: ['video', 'pdf', 'text', 'scorm'],
      required: true,
    },

    // Video-specific metadata
    video: {
      url: { type: String, default: null }, // storage/CDN URL
      durationSeconds: { type: Number, default: 0 },
      thumbnailUrl: { type: String, default: null },
      provider: { type: String, enum: ['s3', 'youtube', 'vimeo', 'cloudflare_stream'], default: 's3' },
    },

    // PDF / notes-specific metadata
    pdf: {
      url: { type: String, default: null },
      fileSizeKB: { type: Number, default: 0 },
      pageCount: { type: Number, default: 0 },
    },

    // Free-text/rich-text lesson body (alternative to video/pdf)
    textContent: { type: String, default: null },

    isPreview: { type: Boolean, default: false }, // viewable without enrollment (marketing preview)
    estimatedMinutes: { type: Number, default: 0 },
  },
  { _id: true, timestamps: false }
);

/**
 * A Module groups lessons together and optionally ends with a Quiz
 * that gates progression into the next module.
 */
const moduleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    order: { type: Number, required: true },

    lessons: [lessonSchema],

    // Reference to the Quiz that must be passed to unlock the next module.
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', default: null },

    // Lock/unlock configuration set by HR in the Course Builder
    lockSettings: {
      isLockedByDefault: { type: Boolean, default: true },
      // Which module must be completed first (null = unlocked from course start / previous module in order)
      prerequisiteModuleId: { type: mongoose.Schema.Types.ObjectId, default: null },
      requireQuizPassToUnlockNext: { type: Boolean, default: true },
    },
  },
  { _id: true, timestamps: false }
);

const courseSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    title: { type: String, required: [true, 'Course title is required'], trim: true },
    description: { type: String, default: null },
    shortDescription: { type: String, default: null },
    thumbnailUrl: { type: String, default: null },

    category: { type: String, default: null },
    tags: [{ type: String }],

    // Which department(s)/roles this course is meant for (used in reporting/heatmaps)
    targetDepartments: [{ type: String }],
    isMandatory: { type: Boolean, default: false }, // e.g. compliance / onboarding courses

    modules: [moduleSchema],

    // Denormalized totals, recalculated whenever modules/lessons change
    stats: {
      totalModules: { type: Number, default: 0 },
      totalLessons: { type: Number, default: 0 },
      totalDurationMinutes: { type: Number, default: 0 },
      enrolledCount: { type: Number, default: 0 },
      completedCount: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
    },

    certificate: {
      isEnabled: { type: Boolean, default: true }, // doubles as the "auto-issue on 100% completion" toggle
      templateUrl: { type: String, default: null },
      passingRequirement: {
        type: String,
        enum: ['all_lessons_complete', 'all_quizzes_passed'],
        default: 'all_quizzes_passed',
      },
      // Dynamic-token certificate template config (Certificate Engine).
      // The PDF renderer (utils/certificateGenerator.js) substitutes
      // {learner_name}, {course_name}, {completion_date} at issue time.
      signatureName: { type: String, default: null },
      signatureTitle: { type: String, default: null },
      signatureImageUrl: { type: String, default: null },
    },

    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },

    // Course Player / Instructor Directory "taught by" reference
    instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Instructor', default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

courseSchema.index({ tenantId: 1, status: 1 });
courseSchema.index({ tenantId: 1, title: 'text', description: 'text' });

module.exports = mongoose.model('Course', courseSchema);
