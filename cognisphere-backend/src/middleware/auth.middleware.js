const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/user.model');
const Tenant = require('../models/tenant.model');

/**
 * verifyJWT
 * -----------
 * Reads the access token from either the Authorization header
 * ("Bearer <token>") or an httpOnly cookie, verifies it, loads the
 * user, and attaches `req.user`.
 *
 * Also cross-checks the token's tenant claim against `req.tenantId`
 * (set earlier by tenant.middleware.js) so a user from Company A can
 * NEVER authenticate successfully on Company B's subdomain, even with
 * a technically-valid JWT. This is the second layer of tenant isolation
 * on top of the DB-query-level scoping.
 */
const verifyJWT = asyncHandler(async (req, res, next) => {
  const tokenFromHeader = req.headers.authorization?.startsWith('Bearer')
    ? req.headers.authorization.split(' ')[1]
    : null;
  const token = req.cookies?.accessToken || tokenFromHeader;

  if (!token) {
    throw new ApiError(401, 'Not authenticated. No access token provided.');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch (err) {
    throw new ApiError(401, 'Access token is invalid or has expired.');
  }

  const user = await User.findById(decoded._id).select('-password -refreshToken');
  if (!user) {
    throw new ApiError(401, 'The user belonging to this token no longer exists.');
  }
  if (!user.isActive) {
    throw new ApiError(403, 'This account has been deactivated.');
  }

  // ---------- Tenant isolation check ----------
  // super_admin has tenantId=null and operates across tenants, so it is exempt.
  if (user.role !== 'super_admin') {
    const userTenantId = user.tenantId ? user.tenantId.toString() : null;
    let requestTenantId = req.tenantId ? req.tenantId.toString() : null;

    // Fallback: no subdomain (or x-tenant-slug/x-tenant-id header) was
    // resolved for this request — typically the app being used entirely
    // from the root domain, e.g. localhost:3000 in local dev with no
    // *.localhost subdomain configured. Rather than hard-fail every
    // authenticated call in that setup, trust the tenantId embedded in
    // THIS ALREADY-VERIFIED token. jwt.verify() above already confirmed
    // this token's signature, so an unauthenticated caller can never
    // forge this — it only ever promotes a tenant this exact user was
    // legitimately issued a token for, never an arbitrary one.
    if (!requestTenantId && userTenantId) {
      req.tenantId = user.tenantId;
      if (!req.tenant) {
        req.tenant = await Tenant.findById(user.tenantId);
      }
      requestTenantId = userTenantId;
    }

    if (!requestTenantId) {
      throw new ApiError(400, 'This account must be accessed via your company subdomain.');
    }
    if (userTenantId !== requestTenantId) {
      throw new ApiError(403, 'You do not have access to this company workspace.');
    }
  }

  req.user = user;
  next();
});

/**
 * authorizeRoles
 * ----------------
 * Factory middleware for RBAC. Usage:
 *   router.post('/courses', verifyJWT, authorizeRoles('hr_admin'), createCourse)
 *   router.get('/platform-stats', verifyJWT, authorizeRoles('super_admin'), getStats)
 */
const authorizeRoles = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Not authenticated.');
  }
  if (!allowedRoles.includes(req.user.role)) {
    throw new ApiError(403, `Role "${req.user.role}" is not permitted to perform this action.`);
  }
  next();
};

module.exports = { verifyJWT, authorizeRoles };
