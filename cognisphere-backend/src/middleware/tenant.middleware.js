const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Tenant = require('../models/tenant.model');

const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'cognisphere.com';
const RESERVED_SUBDOMAINS = (process.env.RESERVED_SUBDOMAINS || 'app,www,admin,api')
  .split(',')
  .map((s) => s.trim().toLowerCase());

/**
 * Extracts the subdomain from a request hostname.
 * Handles:
 *   - acme.cognisphere.com        -> "acme"
 *   - acme.localhost:5000         -> "acme"   (local dev)
 *   - app.cognisphere.com         -> null      (reserved -> super admin / main site)
 *   - cognisphere.com             -> null      (root domain itself)
 */
function extractSubdomain(hostname) {
  if (!hostname) return null;

  // Strip port if present (e.g. "acme.localhost:5000")
  const hostWithoutPort = hostname.split(':')[0];

  // Local dev convenience: "acme.localhost"
  if (hostWithoutPort.endsWith('.localhost')) {
    const parts = hostWithoutPort.split('.');
    return parts.length > 1 ? parts[0].toLowerCase() : null;
  }

  if (!hostWithoutPort.endsWith(ROOT_DOMAIN)) {
    // Custom domain case (e.g. learning.acme.com) is resolved separately
    // by customDomainLookup below, so we return null here.
    return null;
  }

  const withoutRoot = hostWithoutPort.replace(`.${ROOT_DOMAIN}`, '');
  if (withoutRoot === hostWithoutPort || withoutRoot === ROOT_DOMAIN) {
    return null; // no subdomain present, i.e. bare root domain
  }

  return withoutRoot.toLowerCase();
}

/**
 * resolveTenant
 * ---------------
 * Determines the active tenant for the incoming request from, in priority order:
 *   1. `x-tenant-id` header (server-to-server calls, mobile apps, testing)
 *   2. `x-tenant-slug` header (human-readable company code — used by the
 *      unified login page when a user logs in from the root domain and
 *      manually enters their company code, since there's no subdomain to
 *      resolve from in that case)
 *   3. Subdomain parsed from the Host header
 *   4. A fully custom domain matched against Tenant.customDomain
 *
 * Attaches `req.tenant` (full Tenant doc) and `req.tenantId` (ObjectId) for
 * every downstream controller to use in queries — e.g. Course.find({ tenantId: req.tenantId }).
 *
 * Routes under the main/reserved domain (super admin, marketing) will have
 * `req.tenant = null` and `req.tenantId = null`; those routes must NOT touch
 * tenant-scoped collections without a tenant context.
 */
const resolveTenant = asyncHandler(async (req, res, next) => {
  let tenant = null;

  // ---------- 1. Explicit header override (by ID) ----------
  const headerTenantId = req.headers['x-tenant-id'];
  if (headerTenantId) {
    tenant = await Tenant.findById(headerTenantId);
    if (!tenant) {
      throw new ApiError(404, 'Tenant specified in x-tenant-id header was not found');
    }
  }

  // ---------- 2. Explicit header override (by human-readable slug) ----------
  if (!tenant) {
    const headerSlug = req.headers['x-tenant-slug'];
    if (headerSlug) {
      const normalizedSlug = String(headerSlug).toLowerCase().trim();
      tenant = await Tenant.findOne({ subdomain: normalizedSlug });
      if (!tenant) {
        throw new ApiError(404, `No company found for code "${normalizedSlug}"`);
      }
    }
  }

  // ---------- 3. Subdomain resolution ----------
  if (!tenant) {
    const hostname = req.hostname; // Express already strips port when 'trust proxy' is configured correctly
    const subdomain = extractSubdomain(hostname);

    if (subdomain && !RESERVED_SUBDOMAINS.includes(subdomain)) {
      tenant = await Tenant.findOne({ subdomain });
      if (!tenant) {
        throw new ApiError(404, `No company found for subdomain "${subdomain}"`);
      }
    }
  }

  // ---------- 4. Custom domain resolution (enterprise tier) ----------
  if (!tenant) {
    const hostWithoutPort = (req.hostname || '').split(':')[0];
    if (hostWithoutPort && hostWithoutPort !== ROOT_DOMAIN) {
      const byCustomDomain = await Tenant.findOne({ customDomain: hostWithoutPort });
      if (byCustomDomain) tenant = byCustomDomain;
    }
  }

  // ---------- Tenant health checks ----------
  if (tenant) {
    if (!tenant.isActive) {
      throw new ApiError(403, 'This company account has been deactivated. Please contact support.');
    }
    if (['canceled', 'expired', 'suspended'].includes(tenant.subscription.status)) {
      throw new ApiError(
        402,
        `This company's subscription is ${tenant.subscription.status}. Please contact your administrator.`
      );
    }
  }

  req.tenant = tenant; // null on the main/root domain (super admin space)
  req.tenantId = tenant ? tenant._id : null;

  next();
});

/**
 * requireTenant
 * ---------------
 * Use on any route that MUST be scoped to a company (courses, quizzes,
 * progress, HR routes, learner routes). Rejects requests hitting the
 * root/reserved domain with no resolvable tenant.
 */
const requireTenant = (req, res, next) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'This action requires a valid company (tenant) context.');
  }
  next();
};

module.exports = { resolveTenant, requireTenant, extractSubdomain };
