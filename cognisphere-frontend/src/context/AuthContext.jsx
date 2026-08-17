import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

/**
 * Owns the authenticated user's session. On mount, if an access token is
 * already in localStorage (returning visit), it hydrates the user by
 * calling GET /auth/me rather than trusting a possibly-stale localStorage
 * copy of the user object.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // sanitized User doc from /auth/me
  const [loading, setLoading] = useState(true);

  const hydrateFromToken = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.data.user);
    } catch {
      localStorage.removeItem('accessToken');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrateFromToken();
  }, [hydrateFromToken]);

  /**
   * `tenantSlug` is only needed when logging in from the root domain
   * (no subdomain in the URL to auto-scope the request) — the Unified
   * Login Portal collects it as "Company Code" for the Organization/
   * Learner tabs in that case. On a real tenant subdomain it's omitted;
   * the axios baseURL is already scoped there.
   */
  const login = useCallback(async (email, password, tenantSlug) => {
    const config = tenantSlug ? { headers: { 'x-tenant-slug': tenantSlug } } : undefined;
    const { data } = await api.post('/auth/login', { email, password }, config);
    localStorage.setItem('accessToken', data.data.accessToken);
    setUser(data.data.user);
    return data.data.user;
  }, []);

  /**
   * Re-hydrates the session from whatever token is currently in
   * localStorage (used by ImpersonatePage right after storing a
   * Super-Admin-issued impersonation token). Unlike hydrateFromToken,
   * this THROWS on failure so the caller can show its own error state
   * instead of silently landing on the login page.
   */
  const refreshSession = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.data.user);
    return data.data.user;
  }, []);

  /**
   * Same root-domain tenant-scoping need as login() — see its comment.
   * Registration itself does not log the user in; call login() right
   * after with the same tenantSlug to complete the sign-up flow.
   */
  const register = useCallback(async (payload, tenantSlug) => {
    const config = tenantSlug ? { headers: { 'x-tenant-slug': tenantSlug } } : undefined;
    const { data } = await api.post('/auth/register', payload, config);
    return data.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('accessToken');
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        login,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
