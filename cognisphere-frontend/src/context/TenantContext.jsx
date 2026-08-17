import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import { getSubdomain, isSuperAdminSpace } from '../api/subdomain';

const TenantContext = createContext(null);

const DEFAULT_BRANDING = {
  primaryColor: '#4F46E5',
  secondaryColor: '#818CF8',
  logoUrl: null,
  faviconUrl: null,
};

/**
 * Fetches the current tenant's public branding on first load (from the
 * subdomain-scoped GET /tenants/branding endpoint) and injects it as CSS
 * custom properties on :root — every Tailwind class using `primary` /
 * `secondary` (see tailwind.config.js) picks the new colors up instantly,
 * with zero per-component logic needed.
 */
export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(null); // { companyName, subdomain, branding, featureFlags }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isSuperAdmin = isSuperAdminSpace();

  useEffect(() => {
    if (isSuperAdmin) {
      // Root domain: no company branding to fetch, Super Admin gets the
      // fixed dark-theme shell instead. Nothing to do here.
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get('/tenants/branding');
        if (cancelled) return;

        const branding = { ...DEFAULT_BRANDING, ...data.data.branding };
        setTenant({ ...data.data, branding });
        applyBrandingToDocument(data.data.companyName, branding);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Could not load company branding.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

  return (
    <TenantContext.Provider value={{ tenant, loading, error, isSuperAdmin, subdomain: getSubdomain() }}>
      {children}
    </TenantContext.Provider>
  );
}

function applyBrandingToDocument(companyName, branding) {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', branding.primaryColor);
  root.style.setProperty('--color-secondary', branding.secondaryColor);

  if (companyName) {
    document.title = `${companyName} · CogniSphere`;
  }
  if (branding.faviconUrl) {
    const favicon = document.getElementById('favicon');
    if (favicon) favicon.href = branding.faviconUrl;
  }
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within a TenantProvider');
  return ctx;
}
