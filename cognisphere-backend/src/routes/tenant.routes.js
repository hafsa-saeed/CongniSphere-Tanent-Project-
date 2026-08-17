const express = require('express');
const { verifyJWT, authorizeRoles } = require('../middleware/auth.middleware');
const { requireTenant } = require('../middleware/tenant.middleware');
const {
  createTenant,
  getAllTenants,
  getTenantById,
  updateTenant,
  getTenantBranding,
  suspendTenant,
  activateTenant,
  impersonateTenant,
  getTenantAnalyticsOverview,
  getMyTenant,
  updateMyPublicProfile,
  listPublicTenants,
  getPublicTenantBySlug,
} = require('../controllers/tenant.controller');

const router = express.Router();

// ---------- Public (no auth) ----------
// Tenant-scoped via subdomain, resolved by tenant.middleware upstream in app.js —
// lets the frontend fetch logo/colors before the user has logged in.
router.get('/branding', getTenantBranding);
// Landing Page showcase directory + individual /org/:slug pages.
// Registered BEFORE /:id below so "/public" is never swallowed by the
// Super Admin single-segment :id route.
router.get('/public', listPublicTenants);
router.get('/public/:slug', getPublicTenantBySlug);

// ---------- HR — own tenant ----------
router.get('/me', verifyJWT, requireTenant, authorizeRoles('hr_admin'), getMyTenant);
router.patch('/me/public-profile', verifyJWT, requireTenant, authorizeRoles('hr_admin'), updateMyPublicProfile);

// ---------- Super Admin only — platform-wide tenant management ----------
router.post('/', verifyJWT, authorizeRoles('super_admin'), createTenant);
router.get('/', verifyJWT, authorizeRoles('super_admin'), getAllTenants);
router.get('/analytics/overview', verifyJWT, authorizeRoles('super_admin'), getTenantAnalyticsOverview);
router.get('/:id', verifyJWT, authorizeRoles('super_admin'), getTenantById);
router.patch('/:id', verifyJWT, authorizeRoles('super_admin'), updateTenant);
router.post('/:id/suspend', verifyJWT, authorizeRoles('super_admin'), suspendTenant);
router.post('/:id/activate', verifyJWT, authorizeRoles('super_admin'), activateTenant);
router.post('/:id/impersonate', verifyJWT, authorizeRoles('super_admin'), impersonateTenant);

module.exports = router;
