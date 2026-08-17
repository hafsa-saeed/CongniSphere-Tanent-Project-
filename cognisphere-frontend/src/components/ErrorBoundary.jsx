import { Component } from 'react';

/**
 * Last line of defense against blank white-screen crashes. If ANY
 * component in the tree throws during render — a bad subdomain lookup,
 * an unexpected null, a third-party library error — this catches it and
 * shows a recoverable screen instead of an unmounted, blank React tree.
 *
 * This is a class component because React's error boundary API
 * (getDerivedStateFromError / componentDidCatch) has no hook equivalent.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // In production this is where you'd forward to an error-tracking
    // service (Sentry, etc.) — logging to console keeps this dependency-free.
    console.error('[ErrorBoundary] Caught a render error:', error, errorInfo);
  }

  handleReturnToLogin = () => {
    // Full reload rather than client-side navigation — guarantees a
    // completely fresh React tree, clearing whatever state caused the crash.
    localStorage.removeItem('accessToken');
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="w-full max-w-sm text-center">
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-500 mb-6">
              This page hit an unexpected error. Your session hasn't been lost — try returning to login.
            </p>
            <button
              onClick={this.handleReturnToLogin}
              className="rounded-lg bg-primary text-white text-sm font-medium px-4 py-2.5 hover:opacity-90"
            >
              Return to login
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
