import axios from 'axios';

const API_HOST = import.meta.env.VITE_API_HOST || 'localhost:5000';

/**
 * A separate, deliberately simple axios instance for public pages —
 * the Landing Page and /org/:slug. These never need tenant-subdomain
 * scoping (they always hit the root API host, since the whole point is
 * that they're reachable from anywhere) and never carry an auth token,
 * so they intentionally don't reuse src/api/axios.js's interceptors.
 */
const publicApi = axios.create({ baseURL: `http://${API_HOST}/api/v1` });

export const listPublicTenants = () => publicApi.get('/tenants/public');
export const getPublicTenant = (slug) => publicApi.get(`/tenants/public/${slug}`);
export const submitOnboardingRequest = (payload) => publicApi.post('/onboarding-requests', payload);
