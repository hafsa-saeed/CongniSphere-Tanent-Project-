const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const User = require('../models/user.model');
const LearnerProgress = require('../models/learnerProgress.model');

/**
 * @desc    List every user in the current tenant (HR's Learner & Department
 *          Directory). Optional filters for role and department.
 * @route   GET /api/v1/users?role=&department=
 * @access  Private (hr_admin, tenant-scoped)
 */
const listTenantUsers = asyncHandler(async (req, res) => {
  const { role, department } = req.query;

  const filter = { tenantId: req.tenantId };
  if (role) filter.role = role;
  if (department) filter.department = department;

  const users = await User.find(filter).select('-password -refreshToken').sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, users));
});

/**
 * @desc    Toggle a user's active status (HR removing/restoring a teammate's access).
 * @route   PATCH /api/v1/users/:id/status
 * @access  Private (hr_admin, tenant-scoped)
 */
const updateUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') throw new ApiError(400, 'isActive (boolean) is required.');

  const user = await User.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.tenantId },
    { $set: { isActive } },
    { new: true }
  ).select('-password -refreshToken');

  if (!user) throw new ApiError(404, 'User not found in this organization.');

  return res.status(200).json(new ApiResponse(200, user, `User ${isActive ? 'activated' : 'deactivated'}.`));
});

/**
 * @desc    Full learner profile + every course's progress and quiz scores —
 *          powers the HR Directory's Learner Inspector Drawer.
 * @route   GET /api/v1/users/:id/summary
 * @access  Private (hr_admin, tenant-scoped)
 */
const getUserSummary = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, tenantId: req.tenantId }).select('-password -refreshToken');
  if (!user) throw new ApiError(404, 'User not found in this organization.');

  const progressRecords = await LearnerProgress.find({ tenantId: req.tenantId, userId: user._id }).populate(
    'courseId',
    'title category'
  );

  let totalQuizAttempts = 0;
  let totalQuizPassed = 0;
  for (const p of progressRecords) {
    for (const mod of p.modulesProgress) {
      for (const attempt of mod.quizAttempts) {
        totalQuizAttempts += 1;
        if (attempt.passed) totalQuizPassed += 1;
      }
    }
  }

  return res.status(200).json(
    new ApiResponse(200, {
      user,
      progressRecords,
      stats: {
        totalCoursesEnrolled: progressRecords.length,
        totalCompleted: progressRecords.filter((p) => p.status === 'completed').length,
        totalQuizAttempts,
        totalQuizPassed,
        quizPassRatePercent: totalQuizAttempts > 0 ? Math.round((totalQuizPassed / totalQuizAttempts) * 100) : 0,
      },
    })
  );
});

module.exports = { listTenantUsers, updateUserStatus, getUserSummary };
