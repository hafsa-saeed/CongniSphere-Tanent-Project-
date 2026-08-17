const mongoose = require('mongoose');

/**
 * A course instructor/trainer/lecturer profile, tenant-scoped. Referenced
 * by Course.instructorId so the Learner Portal's Course Player and
 * Instructor Directory can both show "taught by" info from one source.
 */
const instructorSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

    fullName: { type: String, required: true, trim: true },
    title: { type: String, default: null }, // e.g. "Senior Compliance Trainer"
    avatarUrl: { type: String, default: null },

    bio: { type: String, default: null },
    academicBackground: { type: String, default: null },
    industryExperience: { type: String, default: null },
    missionStatement: { type: String, default: null },
    successStories: [{ type: String }],
    skills: [{ type: String }], // e.g. "Leadership", "Compliance" — rendered as badges on the Learner Instructor Directory

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

instructorSchema.index({ tenantId: 1 });

module.exports = mongoose.model('Instructor', instructorSchema);
