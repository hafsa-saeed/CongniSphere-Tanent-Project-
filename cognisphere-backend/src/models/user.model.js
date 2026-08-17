const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User covers all three roles in the system:
 *   - super_admin : platform owner staff, tenantId is null
 *   - hr_admin    : Company HR / Tenant Admin, scoped to one tenantId
 *   - learner     : Employee, scoped to one tenantId
 *
 * Email is unique PER TENANT (compound index), not globally — so
 * "john@company.com" can exist independently inside two different
 * tenants. Super admins (tenantId: null) are unique globally.
 */
const userSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null, // null ONLY for super_admin role
      index: true,
    },

    role: {
      type: String,
      enum: ['super_admin', 'hr_admin', 'learner'],
      required: true,
      default: 'learner',
      index: true,
    },

    // ---------- Identity ----------
    fullName: { type: String, required: [true, 'Full name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false, // never returned by default in queries
    },
    avatarUrl: { type: String, default: null },
    phone: {
      type: String,
      default: null,
      // Pakistani mobile format: 0301-1234567, 03011234567, or +923011234567
      match: [/^(\+92|0)[\s-]?3\d{2}[\s-]?\d{7}$/, 'Phone must be a valid Pakistani mobile number, e.g. 0301-1234567'],
    },
    cnic: {
      type: String,
      default: null,
      // Format: XXXXX-XXXXXXX-X (13 digits with separators)
      match: [/^\d{5}-\d{7}-\d{1}$/, 'CNIC must be in the format XXXXX-XXXXXXX-X'],
    },
    address: { type: String, default: null },

    // ---------- Enterprise / HR profile fields ----------
    employeeId: { type: String, default: null },
    department: { type: String, default: null },
    jobTitle: { type: String, default: null },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    dateJoinedCompany: { type: Date, default: null },

    // ---------- Account status ----------
    isActive: { type: Boolean, default: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    invitationStatus: {
      type: String,
      enum: ['pending', 'accepted', 'expired'],
      default: 'accepted',
    },

    // ---------- Auth / security ----------
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false, default: null },
    passwordResetToken: { type: String, select: false, default: null },
    passwordResetExpires: { type: Date, select: false, default: null },
    refreshToken: { type: String, select: false, default: null },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },

    // ---------- Learner-facing convenience fields ----------
    // Enrollment/progress detail lives in LearnerProgress; this is a
    // lightweight denormalized list for quick "My Courses" queries.
    enrolledCourseIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  },
  { timestamps: true }
);

// Email unique per tenant (a super_admin with tenantId=null is unique on email alone)
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

// ---------- Hooks ----------
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ---------- Instance methods ----------
userSchema.methods.comparePassword = async function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
