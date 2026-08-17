const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const OnboardingRequest = require('../models/onboardingRequest.model');
const Tenant = require('../models/tenant.model');
const User = require('../models/user.model');
const { logAction } = require('../utils/auditLogger');

/**
 * @desc    Public "Request Organization Onboarding" submission from the
 *          Landing Page modal. No tenant exists yet for this company, so
 *          this is intentionally unauthenticated and not tenant-scoped.
 * @route   POST /api/v1/onboarding-requests
 * @access  Public (no auth)
 */
const createOnboardingRequest = asyncHandler(async (req, res) => {
  const { companyName, contactName, contactEmail, contactPhone, message } = req.body;

  if (!companyName || !contactName || !contactEmail) {
    throw new ApiError(400, 'companyName, contactName and contactEmail are required.');
  }

  const request = await OnboardingRequest.create({
    companyName,
    contactName,
    contactEmail: contactEmail.toLowerCase(),
    contactPhone,
    message,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, { _id: request._id }, 'Request received — our team will reach out to you shortly.'));
});

/**
 * @desc    List onboarding requests for the Super Admin Contact Manager's
 *          "Onboarding Requests" tab.
 * @route   GET /api/v1/onboarding-requests?status=
 * @access  Private (super_admin only)
 */
const listOnboardingRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const requests = await OnboardingRequest.find(filter)
    .populate('approvedTenantId', 'companyName subdomain')
    .sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, requests));
});

/**
 * @desc    One-click "Approve & Onboard": creates the Tenant + first HR
 *          admin from the request's details (mirrors tenant.controller.js
 *          #createTenant) and marks the request approved. HR chooses their
 *          own subdomain here since the request itself didn't collect one.
 *          The Super Admin can optionally set the HR admin's initial
 *          password directly (Onboarding Approval Modal); if omitted, one
 *          is generated the same way createTenant already does.
 * @route   POST /api/v1/onboarding-requests/:id/approve
 * @access  Private (super_admin only)
 */
const approveOnboardingRequest = asyncHandler(async (req, res) => {
  const { subdomain, subscriptionTier = 'trial', initialPassword } = req.body;

  if (!subdomain) {
    throw new ApiError(400, 'A subdomain is required to onboard this company.');
  }
  if (initialPassword && initialPassword.length < 8) {
    throw new ApiError(400, 'Initial password must be at least 8 characters.');
  }

  const request = await OnboardingRequest.findById(req.params.id);
  if (!request) throw new ApiError(404, 'Onboarding request not found.');
  if (request.status !== 'pending') {
    throw new ApiError(409, `This request has already been ${request.status}.`);
  }

  const normalizedSubdomain = subdomain.toLowerCase().trim();
  const existingTenant = await Tenant.findOne({ subdomain: normalizedSubdomain });
  if (existingTenant) {
    throw new ApiError(409, `Subdomain "${normalizedSubdomain}" is already taken.`);
  }

  const tenant = await Tenant.create({
    companyName: request.companyName,
    subdomain: normalizedSubdomain,
    primaryContact: { name: request.contactName, email: request.contactEmail, phone: request.contactPhone },
    subscription: { tier: subscriptionTier, status: 'active', startDate: new Date() },
    onboardedBy: req.user._id,
  });

  const finalPassword = initialPassword || `Welcome${Math.random().toString(36).slice(-8)}!`;
  const hrAdmin = await User.create({
    tenantId: tenant._id,
    role: 'hr_admin',
    fullName: request.contactName,
    email: request.contactEmail,
    password: finalPassword,
    invitationStatus: 'pending',
  });

  tenant.usage.currentUserCount = 1;
  await tenant.save();

  request.status = 'approved';
  request.approvedTenantId = tenant._id;
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();
  await request.save();

  await logAction({
    actor: req.user,
    action: 'tenant.onboard',
    targetType: 'Tenant',
    targetId: tenant._id,
    metadata: { companyName: tenant.companyName, subdomain: tenant.subdomain, viaOnboardingRequest: request._id.toString() },
    ipAddress: req.ip,
  });

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        tenant,
        hrAdmin: { _id: hrAdmin._id, email: hrAdmin.email, fullName: hrAdmin.fullName },
        onboardingUrl: `https://${tenant.subdomain}.${process.env.ROOT_DOMAIN}/setup?uid=${hrAdmin._id}`,
        // Kept as `temporaryPassword` for backward compatibility with the
        // existing createTenant response shape the frontend already reads.
        temporaryPassword: finalPassword,
      },
      'Onboarding request approved and company onboarded.'
    )
  );
});

/**
 * @desc    Reject an onboarding request.
 * @route   PATCH /api/v1/onboarding-requests/:id/reject
 * @access  Private (super_admin only)
 */
const rejectOnboardingRequest = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const request = await OnboardingRequest.findById(req.params.id);
  if (!request) throw new ApiError(404, 'Onboarding request not found.');
  if (request.status !== 'pending') {
    throw new ApiError(409, `This request has already been ${request.status}.`);
  }

  request.status = 'rejected';
  request.rejectionReason = reason || null;
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();
  await request.save();

  return res.status(200).json(new ApiResponse(200, request, 'Request rejected.'));
});

module.exports = { createOnboardingRequest, listOnboardingRequests, approveOnboardingRequest, rejectOnboardingRequest };
