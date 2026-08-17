const mongoose = require('mongoose');

/**
 * Tenant = an Enterprise Company that has purchased CogniSphere.
 * This is the root of the entire multi-tenancy model — every other
 * collection (User, Course, Quiz, Progress) carries a `tenantId`
 * that points back here, and every query MUST be scoped by it.
 */
const tenantSchema = new mongoose.Schema(
  {
    // ---------- Identity ----------
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    // The unique slug used for subdomain routing: acme -> acme.cognisphere.com
    subdomain: {
      type: String,
      required: [true, 'Subdomain is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Subdomain can only contain lowercase letters, numbers and hyphens'],
      minlength: 3,
      maxlength: 63,
      index: true,
    },
    // Optional fully custom domain for enterprise tier (e.g. learning.acme.com)
    customDomain: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },

    // ---------- White-Labeling / Branding ----------
    branding: {
      logoUrl: { type: String, default: null },
      faviconUrl: { type: String, default: null },
      primaryColor: { type: String, default: '#4F46E5' },
      secondaryColor: { type: String, default: '#818CF8' },
      loginBackgroundUrl: { type: String, default: null },
      supportEmail: { type: String, default: null },
    },

    // ---------- Subscription / Billing ----------
    subscription: {
      tier: {
        type: String,
        enum: ['trial', 'starter', 'professional', 'enterprise'],
        default: 'trial',
      },
      status: {
        type: String,
        enum: ['active', 'past_due', 'canceled', 'expired', 'suspended'],
        default: 'active',
      },
      billingCycle: {
        type: String,
        enum: ['monthly', 'yearly'],
        default: 'monthly',
      },
      pricePerSeat: { type: Number, default: 0 },
      startDate: { type: Date, default: Date.now },
      currentPeriodEnd: { type: Date, default: null },
      trialEndsAt: { type: Date, default: null },
      canceledAt: { type: Date, default: null },
      // External payment provider references (Stripe, Paddle, etc.)
      paymentProvider: { type: String, default: null },
      paymentCustomerId: { type: String, default: null },
      paymentSubscriptionId: { type: String, default: null },
    },

    // ---------- Plan Limits (enforced in controllers/services) ----------
    limits: {
      maxUsers: { type: Number, default: 25 },
      maxCourses: { type: Number, default: 10 },
      maxStorageGB: { type: Number, default: 5 },
      maxAdmins: { type: Number, default: 2 },
    },

    // ---------- Usage counters (denormalized for fast dashboard reads) ----------
    usage: {
      currentUserCount: { type: Number, default: 0 },
      currentCourseCount: { type: Number, default: 0 },
      currentStorageUsedMB: { type: Number, default: 0 },
    },

    // ---------- Feature Flags (SaaS Super Admin controls these per tenant) ----------
    featureFlags: {
      certificatesEnabled: { type: Boolean, default: true },
      advancedAnalyticsEnabled: { type: Boolean, default: false },
      ssoEnabled: { type: Boolean, default: false },
      apiAccessEnabled: { type: Boolean, default: false },
      customBrandingEnabled: { type: Boolean, default: true },
      departmentReportsEnabled: { type: Boolean, default: true },
      bulkUserImportEnabled: { type: Boolean, default: true },
    },

    // ---------- Tenant-level integrations (optional overrides of global settings) ----------
    integrations: {
      smtp: {
        useCustom: { type: Boolean, default: false },
        host: { type: String, default: null },
        port: { type: Number, default: null },
        username: { type: String, default: null },
        // NOTE: store encrypted at rest / via secrets manager in production, never plaintext.
        passwordEncrypted: { type: String, default: null },
        fromEmail: { type: String, default: null },
      },
      sso: {
        provider: { type: String, enum: ['none', 'saml', 'okta', 'azure_ad', 'google_workspace'], default: 'none' },
        metadataUrl: { type: String, default: null },
      },
    },

    // ---------- Contact / Admin ----------
    primaryContact: {
      name: { type: String, default: null },
      email: { type: String, default: null },
      phone: { type: String, default: null },
    },

    industry: { type: String, default: null },
    companySize: {
      type: String,
      enum: ['1-50', '51-200', '201-500', '501-1000', '1000+'],
      default: null,
    },

    // ---------- Public showcase profile (Landing Page directory + /org/:slug) ----------
    // Editable by HR via PATCH /tenants/me/public-profile. Anything here is
    // returned by the PUBLIC (unauthenticated) endpoints, so nothing
    // sensitive belongs in this block.
    publicProfile: {
      aboutUs: { type: String, default: null },
      missionStatement: { type: String, default: null },
      featuredPrograms: [{ type: String }],
      primaryContactEmail: { type: String, default: null },
      primaryContactPhone: { type: String, default: null },
      portalGuidelines: { type: String, default: null },
      // HR can opt out of appearing in the public "Onboarded Organizations" showcase
      // without affecting the tenant's actual active/subscription status.
      isPubliclyListed: { type: Boolean, default: true },
    },

    // ---------- Status ----------
    isActive: { type: Boolean, default: true },
    suspendedReason: { type: String, default: null },

    // Reference to the SaaS Super Admin user who onboarded this tenant
    onboardedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

tenantSchema.index({ subdomain: 1 }, { unique: true });
tenantSchema.index({ 'subscription.status': 1 });
tenantSchema.index({ isActive: 1 });

module.exports = mongoose.model('Tenant', tenantSchema);
