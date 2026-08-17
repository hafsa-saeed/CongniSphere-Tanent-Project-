import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, GraduationCap, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { notify } from '../../lib/toast';

const ROLE_HOME = {
  super_admin: '/superadmin/dashboard',
  hr_admin: '/hr/dashboard',
  learner: '/learner/dashboard',
};

const TABS = [
  { id: 'hr', label: 'Organization', icon: Building2 },
  { id: 'learner', label: 'Learner', icon: GraduationCap },
];

function formatCnic(value) {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  const part1 = digits.slice(0, 5);
  const part2 = digits.slice(5, 12);
  const part3 = digits.slice(12, 13);
  return [part1, part2, part3].filter(Boolean).join('-');
}

function formatPakPhone(value) {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('92')) digits = '0' + digits.slice(2);
  if (digits && !digits.startsWith('0')) digits = '0' + digits;
  digits = digits.slice(0, 11);
  const part1 = digits.slice(0, 4);
  const part2 = digits.slice(4, 11);
  return [part1, part2].filter(Boolean).join('-');
}

const initialSignupForm = { fullName: '', email: '', password: '', cnic: '', phone: '', address: '' };

/**
 * Dark split-screen Login/Sign Up portal — Organization and Learner tabs
 * only. There is no dedicated Super Admin tab: a Super Admin's own
 * credentials authenticate them straight into the Super Admin Dashboard
 * from EITHER tab, with or without a subdomain/company code filled in
 * (see AuthContext.login + the backend's fallback lookup in
 * auth.controller.js#login). The subdomain/company-code field is
 * deliberately never required client-side for exactly this reason —
 * blocking submission on an empty field would break that bypass.
 *
 * Reachable at both the root domain (http://localhost:3000/login) and
 * any tenant subdomain (http://globex.localhost:3000/login) without
 * ever throwing — this file never assumes tenant/subdomain data exists,
 * only reads it defensively.
 */
export default function Login() {
  const { login, register } = useAuth();
  const { tenant, isSuperAdmin, subdomain } = useTenant();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [activeTab, setActiveTab] = useState('hr');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [signupForm, setSignupForm] = useState(initialSignupForm);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onTenantSubdomain = !isSuperAdmin && Boolean(subdomain);

  // On a real tenant subdomain, the company is already known from the
  // URL — never ask for it again, even visually.
  const showCompanyCodeField = !onTenantSubdomain;

  useEffect(() => {
    setError('');
  }, [mode, activeTab]);

  const resolveTenantSlug = () => {
    if (onTenantSubdomain) return undefined; // already scoped via the subdomain itself
    const trimmed = companyCode.trim().toLowerCase();
    return trimmed || undefined; // intentionally optional — see Smart Super Admin Bypass above
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(email, password, resolveTenantSlug());
      navigate(ROLE_HOME[user.role] || '/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (signupForm.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (signupForm.cnic && !/^\d{5}-\d{7}-\d{1}$/.test(signupForm.cnic)) {
      setError('CNIC must be in the format XXXXX-XXXXXXX-X.');
      return;
    }
    if (signupForm.phone && !/^0[\s-]?3\d{2}[\s-]?\d{7}$/.test(signupForm.phone)) {
      setError('Phone must be a valid Pakistani mobile number, e.g. 0301-1234567.');
      return;
    }
    if (showCompanyCodeField && !companyCode.trim()) {
      setError('Enter your company code to create an account.');
      return;
    }

    setSubmitting(true);
    try {
      const tenantSlug = resolveTenantSlug();
      await register({ ...signupForm, role: activeTab === 'hr' ? 'hr_admin' : 'learner' }, tenantSlug);
      notify.success('Account created — signing you in…');
      const user = await login(signupForm.email, signupForm.password, tenantSlug);
      navigate(ROLE_HOME[user.role] || '/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Sign up failed. Please check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: '#0b0f19' }}>
      {/* ---------- Left panel: brand ---------- */}
      <div className="relative lg:w-1/2 flex flex-col items-center justify-center px-10 py-16 overflow-hidden">
        <motion.div
          animate={{ opacity: [0.25, 0.4, 0.25], scale: [1, 1.08, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-600/30 blur-3xl"
        />
        <motion.div
          animate={{ opacity: [0.2, 0.35, 0.2], scale: [1, 1.1, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl"
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 text-center"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-2xl shadow-indigo-900/50"
          >
            <Sparkles size={32} className="text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-2">
            <span className="text-indigo-400">Cogni</span>Sphere
          </h1>
          <p className="text-zinc-400 text-sm max-w-xs mx-auto">Enterprise Multi-Tenant Learning Platform</p>
        </motion.div>
      </div>

      {/* ---------- Right panel: form ---------- */}
      <div className="lg:w-1/2 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-full max-w-sm rounded-2xl border p-8"
          style={{ background: '#131c2e', borderColor: '#1e293b' }}
        >
          <div className="text-center mb-6">
            {tenant?.branding?.logoUrl && (
              <img src={tenant.branding.logoUrl} alt={tenant.companyName || 'Company logo'} className="h-10 mx-auto mb-3" />
            )}
            <h2 className="text-lg font-semibold text-white">
              {onTenantSubdomain && tenant?.companyName
                ? 'Sign in to ' + tenant.companyName
                : mode === 'signup'
                ? 'Create your account'
                : 'Welcome back'}
            </h2>
          </div>

          {/* ---------- Role tabs ---------- */}
          <div className="grid grid-cols-2 gap-1.5 mb-5 rounded-lg p-1" style={{ background: '#0b0f19' }}>
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={
                    'flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-colors ' +
                    (active ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200')
                  }
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ---------- Login / Sign Up toggle ---------- */}
          <div className="flex justify-center gap-4 mb-5 text-xs">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={mode === 'login' ? 'font-semibold text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'}
            >
              Log In
            </button>
            <span className="text-zinc-700">|</span>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={mode === 'signup' ? 'font-semibold text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'}
            >
              Sign Up
            </button>
          </div>

          {onTenantSubdomain && tenant?.companyName && (
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2 text-xs text-indigo-300 mb-4">
              Company: <span className="font-semibold">{tenant.companyName}</span>
            </div>
          )}

          <AnimatePresence mode="wait">
            {mode === 'login' ? (
              <motion.form
                key="login"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                {showCompanyCodeField && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      {activeTab === 'hr' ? 'Subdomain' : 'Company Code'}{' '}
                      <span className="text-zinc-600">(leave blank for platform admin)</span>
                    </label>
                    <FormInput value={companyCode} onChange={setCompanyCode} placeholder="e.g. acme" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    {activeTab === 'hr' ? 'Work Email' : 'Learner Email'}
                  </label>
                  <FormInput type="email" value={email} onChange={setEmail} placeholder="you@company.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Password</label>
                  <FormInput type="password" value={password} onChange={setPassword} placeholder="••••••••" />
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-indigo-600 text-white text-sm font-medium py-2.5 hover:bg-indigo-500 disabled:opacity-50"
                >
                  {submitting ? 'Signing in…' : 'Sign in'}
                </motion.button>
              </motion.form>
            ) : (
              <motion.form
                key="signup"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onSubmit={handleSignup}
                className="space-y-3"
              >
                {showCompanyCodeField && (
                  <FormInput value={companyCode} onChange={setCompanyCode} placeholder="Company code (e.g. acme)" />
                )}
                <FormInput value={signupForm.fullName} onChange={(v) => setSignupForm((f) => ({ ...f, fullName: v }))} placeholder="Full name" />
                <FormInput type="email" value={signupForm.email} onChange={(v) => setSignupForm((f) => ({ ...f, email: v }))} placeholder="Email" />
                <FormInput
                  type="password"
                  value={signupForm.password}
                  onChange={(v) => setSignupForm((f) => ({ ...f, password: v }))}
                  placeholder="Password (min 8 characters)"
                />
                <FormInput
                  value={signupForm.cnic}
                  onChange={(v) => setSignupForm((f) => ({ ...f, cnic: formatCnic(v) }))}
                  placeholder="CNIC (XXXXX-XXXXXXX-X)"
                  maxLength={15}
                  mono
                />
                <FormInput
                  value={signupForm.phone}
                  onChange={(v) => setSignupForm((f) => ({ ...f, phone: formatPakPhone(v) }))}
                  placeholder="Phone (03XX-XXXXXXX)"
                  maxLength={12}
                />
                <textarea
                  value={signupForm.address}
                  onChange={(e) => setSignupForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Address"
                  rows={2}
                  className="w-full rounded-lg border px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                  style={{ background: '#0b0f19', borderColor: '#1e293b' }}
                />

                {error && <p className="text-sm text-red-400">{error}</p>}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-indigo-600 text-white text-sm font-medium py-2.5 hover:bg-indigo-500 disabled:opacity-50"
                >
                  {submitting ? 'Creating account…' : 'Sign up'}
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

function FormInput({ type = 'text', value, onChange, placeholder, maxLength, mono = false }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className={
        'w-full rounded-lg border px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow ' +
        (mono ? 'font-mono' : '')
      }
      style={{ background: '#0b0f19', borderColor: '#1e293b' }}
    />
  );
}
