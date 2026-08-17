import { Link } from 'react-router-dom';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Access denied</h1>
      <p className="text-gray-500 mb-6">Your account doesn't have permission to view this page.</p>
      <Link to="/login" className="text-primary hover:underline text-sm">
        Back to login
      </Link>
    </div>
  );
}
