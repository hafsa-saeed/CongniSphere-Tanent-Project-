import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Landing page opened by the Super Admin's "Login as tenant" action, e.g.:
 *   http://acme.localhost:3000/impersonate?token=<jwt>
 *
 * Stores the impersonation token exactly like a normal login, then hands
 * off to AuthContext's session hydration (GET /auth/me) before routing
 * into the HR dashboard for that tenant.
 */
export default function ImpersonatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Missing impersonation token.');
      return;
    }

    localStorage.setItem('accessToken', token);

    (async () => {
      try {
        const user = await refreshSession();
        if (user?.role === 'hr_admin') {
          navigate('/hr/dashboard', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } catch {
        setError('This impersonation session has expired or is invalid.');
      }
    })();
  }, [searchParams, navigate, refreshSession]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 text-center">
      {error ? (
        <div>
          <p className="text-red-600 font-medium mb-2">{error}</p>
          <p className="text-sm text-gray-500">Ask the Super Admin to start a new impersonation session.</p>
        </div>
      ) : (
        <p className="text-gray-500">Signing you in as the tenant admin…</p>
      )}
    </div>
  );
}
