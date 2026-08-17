const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || 'localhost';
const RESERVED_SUBDOMAINS = ['app', 'www', 'admin', 'api'];

/**
 * Extracts the tenant subdomain from the browser's current hostname.
 *   acme.localhost:3000        -> "acme"
 *   acme.cognisphere.com       -> "acme"
 *   app.cognisphere.com        -> null   (reserved -> Super Admin space)
 *   localhost:3000             -> null   (root domain, no subdomain)
 *
 * Mirrors the backend's tenant.middleware.js extractSubdomain() logic so
 * the frontend and backend always agree on which "space" a URL belongs to.
 */
export function getSubdomain() {
  const hostname = window.location.hostname;

  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
    return null;
  }

  if (!hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    return null; // custom domain case is out of scope for the frontend dev server
  }

  const subdomain = hostname.replace(`.${ROOT_DOMAIN}`, '').toLowerCase();

  if (!subdomain || RESERVED_SUBDOMAINS.includes(subdomain)) {
    return null;
  }

  return subdomain;
}

export function isSuperAdminSpace() {
  return getSubdomain() === null;
}
