import axios from 'axios';
import { getSubdomain } from './subdomain';

const API_HOST = import.meta.env.VITE_API_HOST || 'localhost:5000';

/**
 * The API base URL is built from the CURRENT browser subdomain, not a
 * fixed value — this is what makes multi-tenancy work end-to-end:
 *
 *   Frontend at acme.localhost:3000  -> API calls go to acme.localhost:5000
 *   Frontend at localhost:3000        -> API calls go to localhost:5000 (root/Super Admin)
 *
 * The backend's tenant.middleware.js reads the Host header of THAT request
 * to resolve req.tenantId, so the subdomain must be part of the actual
 * request origin — an `x-tenant-id` header alone would not be enough once
 * the frontend and backend are on different subdomains from the browser's
 * point of view.
 */
function buildBaseUrl() {
  const subdomain = getSubdomain();
  const host = subdomain ? `${subdomain}.${API_HOST}` : API_HOST;
  return `http://${host}/api/v1`;
}

const api = axios.create({
  baseURL: buildBaseUrl(),
  withCredentials: true, // send/receive the httpOnly refresh-token cookie
});

// ---------- Attach JWT access token automatically ----------
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------- Auto-refresh on 401, once ----------
let isRefreshing = false;
let refreshQueue = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/')) {
      if (isRefreshing) {
        // Queue this request until the in-flight refresh resolves
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post('/auth/refresh-token');
        const newToken = data.data.accessToken;
        localStorage.setItem('accessToken', newToken);

        refreshQueue.forEach(({ resolve }) => resolve(newToken));
        refreshQueue = [];

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        refreshQueue.forEach(({ reject }) => reject(refreshError));
        refreshQueue = [];
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
