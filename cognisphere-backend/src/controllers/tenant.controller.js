const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const Tenant = require('../models/tenant.model');
const User = require('../models/user.model');
const Course = require('../models/course.model');
const { logAction } = require('../utils/auditLogger');

/**
 * @desc    Create (onboard) a new tenant/company + its first HR admin user
 * @route   POST /api/v1/tenants
 * @access  Private (super_admin only)
 *
 * This is called from the SaaS Super Admin dashboard when a new company
 * purchases a subscription. It provisions:
 *   1. The Tenant document (subdomain, plan, limits, feature flags)
 *   2. The first hr_admin user for that tenant, who receives the
 *      "your own website" invite link mentioned in the product brief.
 */
const createTenant = asyncHandler(async (req, res) => {
  const {
    companyName,
    subdomain,
    subscriptionTier = 'trial',
    billingCycle = 'monthly',
    industry,
    companySize,
    primaryContact, // { name, email, phone }
    branding, // optional initial branding overrides
  } = req.body;

  if (!companyName || !subdomain || !primaryContact?.email || !primaryContact?.name) {
    throw new ApiError(400, 'companyName, subdomain and primaryContact (name, email) are required.');
  }

  const normalizedSubdomain = subdomain.toLowerCase().trim();

  const existing = await Tenant.findOne({ subdomain: normalizedSubdomain });
  if (existing) {
    throw new ApiError(409, `Subdomain "${normalizedSubdomain}" is already taken.`);
  }

  const tenant = await Tenant.create({
    companyName,
    subdomain: normalizedSubdomain,
    industry,
    companySize,
    primaryContact,
    branding: branding || undefined,
    subscription: {
      tier: subscriptionTier,
      billingCycle,
      status: 'active',
      startDate: new Date(),
    },
    onboardedBy: req.user._id,
  });

  // Provision the first HR / Tenant Admin account for this company.
  // A temporary password is generated; in production this should be
  // replaced by a signed invitation-link + "set your password" flow.
  const temporaryPassword = `Welcome${Math.random().toString(36).slice(-8)}!`;

  const hrAdmin = await User.create({
    tenantId: tenant._id,
    role: 'hr_admin',
    fullName: primaryContact.name,
    email: primaryContact.email.toLowerCase(),
    password: temporaryPassword,
    invitationStatus: 'pending',
  });

  tenant.usage.currentUserCount = 1;
  await tenant.save();

  await logAction({
    actor: req.user,
    action: 'tenant.onboard',
    targetType: 'Tenant',
    targetId: tenant._id,
    metadata: { companyName: tenant.companyName, subdomain: tenant.subdomain, tier: subscriptionTier },
    ipAddress: req.ip,
  });

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        tenant,
        hrAdmin: { _id: hrAdmin._id, email: hrAdmin.email, fullName: hrAdmin.fullName },
        // The onboarding link the Super Admin shares with the company,
        // matching the "feels like their own website" requirement.
        onboardingUrl: `https://${tenant.subdomain}.${process.env.ROOT_DOMAIN}/setup?uid=${hrAdmin._id}`,
        temporaryPassword, // returned once; deliver via email in production, never log this
      },
      'Tenant onboarded successfully.'
    )
  );
});

/**
 * @desc    List all tenants with key SaaS metrics (for Super Admin dashboard table)
 * @route   GET /api/v1/tenants
 * @access  Private (super_admin only)
 */
const getAllTenants = asyncHandler(async (req, res) => {
  const { status, tier, search, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (status) filter['subscription.status'] = status;
  if (tier) filter['subscription.tier'] = tier;
  if (search) filter.companyName = { $regex: search, $options: 'i' };

  const skip = (Number(page) - 1) * Number(limit);

  const [tenants, total] = await Promise.all([
    Tenant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Tenant.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponse(200, {
      tenants,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    })
  );
});

/**
 * @desc    Get a single tenant's full detail (Super Admin)
 * @route   GET /api/v1/tenants/:id
 * @access  Private (super_admin only)
 */
const getTenantById = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.params.id);
  if (!tenant) throw new ApiError(404, 'Tenant not found.');
  return res.status(200).json(new ApiResponse(200, tenant));
});

/**
 * @desc    Update tenant plan, limits or feature flags (Super Admin)
 * @route   PATCH /api/v1/tenants/:id
 * @access  Private (super_admin only)
 */
const updateTenant = asyncHandler(async (req, res) => {
  const allowedUpdates = ['subscription', 'limits', 'featureFlags', 'isActive', 'suspendedReason', 'branding'];
  const updates = {};
  for (const key of allowedUpdates) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const tenant = await Tenant.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
  if (!tenant) throw new ApiError(404, 'Tenant not found.');

  return res.status(200).json(new ApiResponse(200, tenant, 'Tenant updated successfully.'));
});

/**
 * @desc    Fetch the current tenant's public branding config (logo, colors)
 *          Used by the frontend on page load, BEFORE login, to render
 *          the white-labeled subdomain shell correctly.
 * @route   GET /api/v1/tenants/branding
 * @access  Public (but tenant-scoped via subdomain)
 */
const getTenantBranding = asyncHandler(async (req, res) => {
  if (!req.tenant) {
    throw new ApiError(400, 'No company context found for this domain.');
  }

  const { companyName, subdomain, branding, featureFlags } = req.tenant;

  return res.status(200).json(
    new ApiResponse(200, {
      companyName,
      subdomain,
      branding,
      featureFlags,
    })
  );
});

/**
 * @desc    Suspend a tenant (blocks all logins/API access for its users
 *          except the audit trail this action itself creates).
 * @route   POST /api/v1/tenants/:id/suspend
 * @access  Private (super_admin only)
 */
const suspendTenant = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const tenant = await Tenant.findByIdAndUpdate(
    req.params.id,
    { $set: { isActive: false, suspendedReason: reason || 'Suspended by platform administrator.' } },
    { new: true }
  );
  if (!tenant) throw new ApiError(404, 'Tenant not found.');

  await logAction({
    actor: req.user,
    action: 'tenant.suspend',
    targetType: 'Tenant',
    targetId: tenant._id,
    metadata: { companyName: tenant.companyName, reason: tenant.suspendedReason },
    ipAddress: req.ip,
  });

  return res.status(200).json(new ApiResponse(200, tenant, 'Tenant suspended.'));
});

/**
 * @desc    Reactivate a previously suspended tenant.
 * @route   POST /api/v1/tenants/:id/activate
 * @access  Private (super_admin only)
 */
const activateTenant = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findByIdAndUpdate(
    req.params.id,
    { $set: { isActive: true, suspendedReason: null } },
    { new: true }
  );
  if (!tenant) throw new ApiError(404, 'Tenant not found.');

  await logAction({
    actor: req.user,
    action: 'tenant.activate',
    targetType: 'Tenant',
    targetId: tenant._id,
    metadata: { companyName: tenant.companyName },
    ipAddress: req.ip,
  });

  return res.status(200).json(new ApiResponse(200, tenant, 'Tenant reactivated.'));
});

/**
 * @desc    Issue an access token that lets the Super Admin view the
 *          product as the tenant's HR admin ("Login As Tenant"). The
 *          token is scoped to that HR user's real identity and tenant —
 *          auth.middleware.js's tenant cross-check treats it exactly like
 *          a normal HR session once opened on the tenant's subdomain.
 *          Every impersonation is audit-logged.
 * @route   POST /api/v1/tenants/:id/impersonate
 * @access  Private (super_admin only)
 */
const impersonateTenant = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.params.id);
  if (!tenant) throw new ApiError(404, 'Tenant not found.');

  const hrUser = await User.findOne({ tenantId: tenant._id, role: 'hr_admin', isActive: true }).sort({ createdAt: 1 });
  if (!hrUser) {
    throw new ApiError(404, 'This company has no active HR admin account to impersonate.');
  }

  const impersonationToken = jwt.sign(
    { _id: hrUser._id, role: hrUser.role, tenantId: hrUser.tenantId, impersonatedBy: req.user._id.toString() },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '30m' } // deliberately short-lived — this is a support tool, not a persistent session
  );

  await logAction({
    actor: req.user,
    action: 'tenant.impersonate',
    targetType: 'Tenant',
    targetId: tenant._id,
    metadata: { companyName: tenant.companyName, impersonatedUserId: hrUser._id.toString(), impersonatedEmail: hrUser.email },
    ipAddress: req.ip,
  });

  return res.status(200).json(
    new ApiResponse(200, {
      accessToken: impersonationToken,
      tenant: { subdomain: tenant.subdomain, companyName: tenant.companyName },
      impersonatedUser: { fullName: hrUser.fullName, email: hrUser.email, role: hrUser.role },
    })
  );
});

/**
 * @desc    Platform-wide analytics for the Super Admin Dashboard: MRR
 *          trend, storage usage per tenant, plan distribution, and
 *          month-over-month growth indicators.
 *
 *          NOTE: MRR trend is approximated from current tenant records
 *          (cumulative active-tenant revenue as of each tenant's
 *          onboarding month) since there is no historical billing-events
 *          ledger yet. A production build would source this from a
 *          dedicated billing/invoice collection instead.
 * @route   GET /api/v1/tenants/analytics/overview
 * @access  Private (super_admin only)
 */
const getTenantAnalyticsOverview = asyncHandler(async (req, res) => {
  const [tenants, totalSystemUsers] = await Promise.all([
    Tenant.find({}).select('companyName subscription usage limits createdAt isActive'),
    // Every account on the platform — super admins, HR admins, and learners
    // across every tenant — a genuine $count aggregation, not a denormalized field.
    User.countDocuments({}),
  ]);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const activeTenants = tenants.filter((t) => t.subscription.status === 'active');
  const currentMrr = activeTenants.reduce(
    (sum, t) => sum + (t.usage?.currentUserCount || 0) * (t.subscription.pricePerSeat || 0),
    0
  );

  const tenantsThisMonth = tenants.filter((t) => t.createdAt >= thirtyDaysAgo).length;
  const tenantsLastMonth = tenants.filter((t) => t.createdAt >= sixtyDaysAgo && t.createdAt < thirtyDaysAgo).length;
  const tenantGrowthPercent =
    tenantsLastMonth > 0 ? Math.round(((tenantsThisMonth - tenantsLastMonth) / tenantsLastMonth) * 100) : tenantsThisMonth > 0 ? 100 : 0;

  const mrrExcludingThisMonth = activeTenants
    .filter((t) => t.createdAt < thirtyDaysAgo)
    .reduce((sum, t) => sum + (t.usage?.currentUserCount || 0) * (t.subscription.pricePerSeat || 0), 0);
  const mrrGrowthPercent =
    mrrExcludingThisMonth > 0 ? Math.round(((currentMrr - mrrExcludingThisMonth) / mrrExcludingThisMonth) * 100) : currentMrr > 0 ? 100 : 0;

  // ---------- Plan distribution ----------
  const planDistribution = ['trial', 'starter', 'professional', 'enterprise'].map((tier) => ({
    tier,
    count: tenants.filter((t) => t.subscription.tier === tier).length,
  }));

  // ---------- Storage usage per tenant (top 10, for the bar chart) ----------
  const storageUsage = [...tenants]
    .sort((a, b) => (b.usage?.currentStorageUsedMB || 0) - (a.usage?.currentStorageUsedMB || 0))
    .slice(0, 10)
    .map((t) => ({
      companyName: t.companyName,
      usedMB: t.usage?.currentStorageUsedMB || 0,
      limitGB: t.limits.maxStorageGB,
    }));

  // ---------- MRR trend: cumulative active-tenant revenue by onboarding month, last 6 months ----------
  const monthBuckets = [];
  for (let i = 5; i >= 0; i--) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets.push({ date: bucketDate, label: bucketDate.toLocaleString('en-US', { month: 'short' }) });
  }
  const mrrTrend = monthBuckets.map((bucket) => {
    const cutoff = new Date(bucket.date.getFullYear(), bucket.date.getMonth() + 1, 1);
    const mrrAtCutoff = activeTenants
      .filter((t) => t.createdAt < cutoff)
      .reduce((sum, t) => sum + (t.usage?.currentUserCount || 0) * (t.subscription.pricePerSeat || 0), 0);
    return { month: bucket.label, mrr: mrrAtCutoff };
  });

  return res.status(200).json(
    new ApiResponse(200, {
      totalTenants: tenants.length,
      activeTenants: activeTenants.length,
      trialTenants: tenants.filter((t) => t.subscription.tier === 'trial').length,
      totalSystemUsers,
      totalStorageUsedMB: tenants.reduce((sum, t) => sum + (t.usage?.currentStorageUsedMB || 0), 0),
      currentMrr,
      tenantGrowthPercent,
      mrrGrowthPercent,
      planDistribution,
      storageUsage,
      mrrTrend,
    })
  );
});

/**
 * @desc    Get the CURRENT tenant's own profile — branding, usage, limits,
 *          subscription — for the HR "Organization Profile" screen.
 *          Unlike getTenantById (Super Admin only, any tenant), this is
 *          scoped strictly to req.tenant, resolved from the subdomain.
 * @route   GET /api/v1/tenants/me
 * @access  Private (hr_admin, tenant-scoped)
 */
const getMyTenant = asyncHandler(async (req, res) => {
  if (!req.tenant) throw new ApiError(400, 'No company context found for this domain.');
  return res.status(200).json(new ApiResponse(200, req.tenant));
});

/**
 * @desc    HR updates their own company's PUBLIC showcase profile — About
 *          Us, mission statement, featured programs, support contact,
 *          portal guidelines. Changes are reflected immediately on the
 *          public /org/:slug page and the Landing Page directory since
 *          both read live from this same Tenant document.
 * @route   PATCH /api/v1/tenants/me/public-profile
 * @access  Private (hr_admin, tenant-scoped)
 */
const updateMyPublicProfile = asyncHandler(async (req, res) => {
  if (!req.tenant) throw new ApiError(400, 'No company context found for this domain.');

  const allowedFields = [
    'aboutUs',
    'missionStatement',
    'featuredPrograms',
    'primaryContactEmail',
    'primaryContactPhone',
    'portalGuidelines',
    'isPubliclyListed',
  ];

  const tenant = await Tenant.findById(req.tenant._id);
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      tenant.publicProfile[field] = req.body[field];
    }
  }
  await tenant.save();

  return res.status(200).json(new ApiResponse(200, tenant, 'Public profile updated.'));
});

/**
 * @desc    Directory of every publicly-listed, active tenant — powers the
 *          Landing Page's "Onboarded Organizations & Partners" showcase.
 *          Deliberately returns only non-sensitive fields: no billing, no
 *          user counts, no internal usage data.
 * @route   GET /api/v1/tenants/public
 * @access  Public (no auth)
 */
const listPublicTenants = asyncHandler(async (req, res) => {
  const tenants = await Tenant.find({
    isActive: true,
    'publicProfile.isPubliclyListed': true,
  }).select('companyName subdomain industry branding.logoUrl branding.primaryColor publicProfile.aboutUs');

  const showcase = tenants.map((t) => ({
    companyName: t.companyName,
    subdomain: t.subdomain,
    industry: t.industry,
    logoUrl: t.branding?.logoUrl || null,
    primaryColor: t.branding?.primaryColor || null,
    aboutUsExcerpt: t.publicProfile?.aboutUs ? t.publicProfile.aboutUs.slice(0, 140) : null,
  }));

  return res.status(200).json(new ApiResponse(200, showcase));
});

/**
 * @desc    One company's full public documentation page — company
 *          details, mission statement, published course overview, and
 *          the support contact info HR configured. Looked up directly by
 *          subdomain slug in the URL path, independent of the request's
 *          own Host header, so /org/:slug works correctly from any
 *          origin (the root domain landing page, a search engine, etc.)
 *          without needing tenant-subdomain resolution.
 * @route   GET /api/v1/tenants/public/:slug
 * @access  Public (no auth)
 */
const getPublicTenantBySlug = asyncHandler(async (req, res) => {
  const slug = req.params.slug.toLowerCase().trim();

  const tenant = await Tenant.findOne({
    subdomain: slug,
    isActive: true,
    'publicProfile.isPubliclyListed': true,
  }).select('companyName subdomain industry companySize branding publicProfile primaryContact');

  if (!tenant) {
    throw new ApiError(404, 'This organization does not have a public page.');
  }

  const courses = await Course.find({ tenantId: tenant._id, status: 'published' }).select('title category shortDescription');

  return res.status(200).json(
    new ApiResponse(200, {
      companyName: tenant.companyName,
      subdomain: tenant.subdomain,
      industry: tenant.industry,
      companySize: tenant.companySize,
      branding: tenant.branding,
      publicProfile: tenant.publicProfile,
      // Fall back to the internal primary contact only if HR hasn't set
      // dedicated public contact info yet, so the page is never empty.
      supportEmail: tenant.publicProfile?.primaryContactEmail || tenant.primaryContact?.email || null,
      supportPhone: tenant.publicProfile?.primaryContactPhone || tenant.primaryContact?.phone || null,
      courses: courses.map((c) => ({ title: c.title, category: c.category, shortDescription: c.shortDescription })),
    })
  );
});

module.exports = {
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
};
