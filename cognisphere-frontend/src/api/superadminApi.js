import api from './axios';

// ---------- Organizations / Tenants ----------
export const getTenants = (params) => api.get('/tenants', { params });
export const getTenantById = (id) => api.get(`/tenants/${id}`);
export const suspendTenant = (id, reason) => api.post(`/tenants/${id}/suspend`, { reason });
export const activateTenant = (id) => api.post(`/tenants/${id}/activate`);
export const impersonateTenant = (id) => api.post(`/tenants/${id}/impersonate`);
export const updateTenantPlan = (id, payload) => api.patch(`/tenants/${id}`, payload);
export const getTenantAnalyticsOverview = () => api.get('/tenants/analytics/overview');

// ---------- Broadcasts ----------
export const listBroadcasts = () => api.get('/broadcasts');
export const createBroadcast = (payload) => api.post('/broadcasts', payload);
export const deactivateBroadcast = (id) => api.patch(`/broadcasts/${id}/deactivate`);

// ---------- Support Desk ----------
export const listSupportTickets = (params) => api.get('/support-tickets', { params });
export const getSupportTicket = (id) => api.get(`/support-tickets/${id}`);
export const replyToTicket = (id, payload) => api.patch(`/support-tickets/${id}/reply`, payload);
export const updateTicketStatus = (id, status) => api.patch(`/support-tickets/${id}/status`, { status });

// ---------- Settings ----------
export const getGlobalSettings = () => api.get('/settings');
export const updateGlobalSettings = (payload) => api.patch('/settings', payload);

// ---------- Audit Logs ----------
export const listAuditLogs = (params) => api.get('/audit-logs', { params });

// ---------- Onboarding Requests (Contact Manager) ----------
export const listOnboardingRequests = (params) => api.get('/onboarding-requests', { params });
export const approveOnboardingRequest = (id, payload) => api.post(`/onboarding-requests/${id}/approve`, payload);
export const rejectOnboardingRequest = (id, reason) => api.patch(`/onboarding-requests/${id}/reject`, { reason });
