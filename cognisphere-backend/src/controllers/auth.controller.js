const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const User = require('../models/user.model');
const Tenant = require('../models/tenant.model');

const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Signs the access token with userId, role AND tenantId baked in.
 * tenantId is null for super_admin. Embedding tenantId in the token
 * means downstream services can trust the claim without an extra DB
 * hop, while auth.middleware.js still re-verifies it against the
 * live user record and the request's resolved subdomain tenant.
 */
function signAccessToken(user) {
  return jwt.sign(
    {
      _id: user._id,
      role: user.role,
      tenantId: user.tenantId || null,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
}

function signRefreshToken(user) {
  return jwt.sign({ _id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
};

/**
 * @desc    Login. Tenant-scoped for HR/Learner accounts, but a Super
 *          Admin can authenticate from EITHER login tab, with or without
 *          a subdomain/company code present — see the fallback lookup
 *          below. This is what lets one login form serve all three
 *          roles without a dedicated "Super Admin" tab.
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required.');
  }

  const normalizedEmail = email.toLowerCase();

  // ---------- 1. Tenant-scoped lookup (HR / Learner, or Super Admin if req.tenantId happens to be null) ----------
  let user = await User.findOne({ email: normalizedEmail, tenantId: req.tenantId || null }).select('+password');

  // ---------- 2. Super Admin fallback ----------
  // Reached when either (a) a subdomain/company code WAS resolved but no
  // user matched it, or (b) none was provided at all. In both cases, try
  // the same email against the tenantId:null (Super Admin) space. This is
  // deliberately generic — it does not care which tab was active or
  // whether a subdomain was typed — a real Super Admin's credentials
  // always win regardless of tab, per the "Smart Dual-Tab Login" design.
  if (!user && req.tenantId) {
    const candidate = await User.findOne({ email: normalizedEmail, tenantId: null }).select('+password');
    if (candidate && candidate.role === 'super_admin') {
      user = candidate;
    }
  }

  if (!user) {
    // Same generic message whether the email doesn't exist, belongs to a
    // different tenant, or the Super Admin fallback also missed — never
    // leak which case it is.
    throw new ApiError(401, 'Invalid email or password.');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new ApiError(423, 'Account temporarily locked due to repeated failed login attempts. Try again later.');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'This account has been deactivated.');
  }

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 5) {
      user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lockout
    }
    await user.save({ validateBeforeSave: false });
    throw new ApiError(401, 'Invalid email or password.');
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  user.lastLoginIp = req.ip;

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  const safeUser = await User.findById(user._id); // password/refreshToken excluded by default select

  return res
    .status(200)
    .cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 })
    .cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 })
    .json(new ApiResponse(200, { user: safeUser, accessToken, refreshToken }, 'Login successful.'));
});

/**
 * @desc    Register a new HR or Learner user within the current tenant.
 *          (Self-registration for learners if the tenant allows it, or
 *          used by HR to add teammates — role permission enforced below.)
 * @route   POST /api/v1/auth/register
 * @access  Public for learner signup on a tenant subdomain;
 *          hr_admin creation should go through an authenticated invite
 *          flow in production — here we allow it directly for Phase 2 simplicity.
 */
const register = asyncHandler(async (req, res) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'Registration must happen on a valid company subdomain.');
  }

  const { fullName, email, password, role = 'learner', department, jobTitle, employeeId, cnic, phone, address } = req.body;

  if (!fullName || !email || !password) {
    throw new ApiError(400, 'fullName, email and password are required.');
  }

  if (cnic && !/^\d{5}-\d{7}-\d{1}$/.test(cnic)) {
    throw new ApiError(400, 'CNIC must be in the format XXXXX-XXXXXXX-X.');
  }

  if (phone && !/^(\+92|0)[\s-]?3\d{2}[\s-]?\d{7}$/.test(phone)) {
    throw new ApiError(400, 'Phone must be a valid Pakistani mobile number, e.g. 0301-1234567.');
  }

  if (!['learner', 'hr_admin'].includes(role)) {
    throw new ApiError(400, 'Invalid role for self-registration.');
  }

  const tenant = await Tenant.findById(req.tenantId);
  if (!tenant) throw new ApiError(404, 'Company not found.');

  // Live count scoped to the role being created — not the denormalized
  // tenant.usage.currentUserCount counter, which only tracks total users
  // and can drift from reality over time (e.g. it's never decremented on
  // deactivation). Counting HR admins against a learner cap was also
  // wrong: they're a different population. `-1` means unlimited; a
  // missing/falsy limit defaults generously to 1000 rather than silently
  // blocking every signup at 0.
  const currentRoleCount = await User.countDocuments({ tenantId: req.tenantId, role });
  const effectiveLimit = tenant.limits.maxUsers === -1 ? Infinity : tenant.limits.maxUsers || 1000;
  if (currentRoleCount >= effectiveLimit) {
    throw new ApiError(403, `This company has reached its ${role === 'learner' ? 'learner' : 'user'} limit for the current plan.`);
  }

  const existing = await User.findOne({ tenantId: req.tenantId, email: email.toLowerCase() });
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists for this company.');
  }

  const user = await User.create({
    tenantId: req.tenantId,
    role,
    fullName,
    email: email.toLowerCase(),
    password,
    department,
    jobTitle,
    employeeId,
    cnic: cnic || null,
    phone: phone || null,
    address: address || null,
  });

  tenant.usage.currentUserCount += 1;
  await tenant.save();

  const safeUser = await User.findById(user._id);

  return res.status(201).json(new ApiResponse(201, safeUser, 'Registration successful.'));
});

/**
 * @desc    Get the currently authenticated user's sanitized profile,
 *          plus the tenant's branding info (for rendering the shell UI).
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res) => {
  const responseData = {
    user: req.user,
    tenant: req.tenant
      ? {
          companyName: req.tenant.companyName,
          subdomain: req.tenant.subdomain,
          branding: req.tenant.branding,
          featureFlags: req.tenant.featureFlags,
        }
      : null,
  };

  return res.status(200).json(new ApiResponse(200, responseData));
});

/**
 * @desc    Issue a new access token from a valid refresh token.
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public (requires valid refresh token cookie/body)
 */
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!incomingToken) {
    throw new ApiError(401, 'Refresh token is required.');
  }

  let decoded;
  try {
    decoded = jwt.verify(incomingToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    throw new ApiError(401, 'Refresh token is invalid or expired.');
  }

  const user = await User.findById(decoded._id).select('+refreshToken');
  if (!user || user.refreshToken !== incomingToken) {
    throw new ApiError(401, 'Refresh token is invalid or has been revoked.');
  }

  const newAccessToken = signAccessToken(user);

  return res
    .status(200)
    .cookie('accessToken', newAccessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 })
    .json(new ApiResponse(200, { accessToken: newAccessToken }, 'Access token refreshed.'));
});

/**
 * @desc    Log out — clears cookies and invalidates the stored refresh token.
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $set: { refreshToken: null } });

  return res
    .status(200)
    .clearCookie('accessToken', cookieOptions)
    .clearCookie('refreshToken', cookieOptions)
    .json(new ApiResponse(200, null, 'Logged out successfully.'));
});

/**
 * @desc    Update the current user's own profile — supports the Learner
 *          Detailed Profile screen (CNIC, phone, address, avatar) as well
 *          as HR/Super Admin editing their own basic info.
 * @route   PATCH /api/v1/auth/me
 * @access  Private
 */
const updateMyProfile = asyncHandler(async (req, res) => {
  const allowedFields = ['fullName', 'phone', 'cnic', 'address', 'avatarUrl', 'jobTitle', 'department'];

  if (req.body.cnic && !/^\d{5}-\d{7}-\d{1}$/.test(req.body.cnic)) {
    throw new ApiError(400, 'CNIC must be in the format XXXXX-XXXXXXX-X.');
  }

  if (req.body.phone && !/^(\+92|0)[\s-]?3\d{2}[\s-]?\d{7}$/.test(req.body.phone)) {
    throw new ApiError(400, 'Phone must be a valid Pakistani mobile number, e.g. 0301-1234567.');
  }

  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true });

  return res.status(200).json(new ApiResponse(200, user, 'Profile updated.'));
});

/**
 * @desc    Change the current user's own password.
 * @route   PATCH /api/v1/auth/change-password
 * @access  Private
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'currentPassword and newPassword are required.');
  }
  if (newPassword.length < 8) {
    throw new ApiError(400, 'New password must be at least 8 characters.');
  }

  const user = await User.findById(req.user._id).select('+password');
  const isCorrect = await user.comparePassword(currentPassword);
  if (!isCorrect) throw new ApiError(401, 'Current password is incorrect.');

  user.password = newPassword; // re-hashed by the pre('save') hook
  await user.save();

  return res.status(200).json(new ApiResponse(200, null, 'Password changed successfully.'));
});

module.exports = { login, register, getMe, refreshAccessToken, logout, updateMyProfile, changePassword };
