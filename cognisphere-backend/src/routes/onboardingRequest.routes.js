const express = require('express');
const { verifyJWT, authorizeRoles } = require('../middleware/auth.middleware');
const {
  createOnboardingRequest,
  listOnboardingRequests,
  approveOnboardingRequest,
  rejectOnboardingRequest,
} = require('../controllers/onboardingRequest.controller');

const router = express.Router();

// Public — submitted from the Landing Page's "Request Organization Onboarding" modal
router.post('/', createOnboardingRequest);

// Super Admin — Contact Manager's "Onboarding Requests" tab
router.get('/', verifyJWT, authorizeRoles('super_admin'), listOnboardingRequests);
router.post('/:id/approve', verifyJWT, authorizeRoles('super_admin'), approveOnboardingRequest);
router.patch('/:id/reject', verifyJWT, authorizeRoles('super_admin'), rejectOnboardingRequest);

module.exports = router;
