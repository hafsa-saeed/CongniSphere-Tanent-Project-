const express = require('express');
const { verifyJWT, authorizeRoles } = require('../middleware/auth.middleware');
const { requireTenant } = require('../middleware/tenant.middleware');
const {
  createBroadcast,
  listBroadcasts,
  listBroadcastsForHr,
  getActiveBroadcastsForUser,
  deactivateBroadcast,
} = require('../controllers/broadcast.controller');

const router = express.Router();

router.use(verifyJWT);

// ---------- Creation (both roles, routing enforced in the controller) ----------
router.post('/', authorizeRoles('super_admin', 'hr_admin'), createBroadcast);

// ---------- Super Admin management ----------
router.get('/', authorizeRoles('super_admin'), listBroadcasts);

// ---------- HR Broadcast Manager ----------
router.get('/hr', requireTenant, authorizeRoles('hr_admin'), listBroadcastsForHr);

// ---------- Tenant-side consumption (Learner Notice Board + HR banner) ----------
router.get('/active', requireTenant, authorizeRoles('hr_admin', 'learner'), getActiveBroadcastsForUser);

// ---------- Deactivate (ownership enforced in controller) ----------
router.patch('/:id/deactivate', authorizeRoles('super_admin', 'hr_admin'), deactivateBroadcast);

module.exports = router;
