import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Gate a route (or a whole nested route tree, via <Outlet/>) behind
 * authentication and, optionally, a specific set of roles.
 *
 * Usage:
 *   <Route element={<ProtectedRoute allowedRoles={['hr_admin']} />}>
 *     <Route path="/hr/dashboard" element={<HrDashboard />} />
 *   </Route>
 */
export default function ProtectedRoute({ allowedRoles }) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Loading your session…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
