import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import CogniCopilot from '../CogniCopilot';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';

/**
 * Shared shell for all three authenticated dashboards. `dark` renders the
 * Super Admin dark theme (Zinc 900/950 + Indigo accents); HR and Learner
 * dashboards use the light theme (and additionally pick up the tenant's
 * brand colors via CSS variables).
 *
 * Owns the mobile sidebar-drawer open/closed state — Sidebar itself is
 * purely presentational for this (see its `mobileOpen`/`onClose` props).
 * Below the `lg` breakpoint the sidebar becomes a slide-in overlay
 * triggered by the header's hamburger button; at `lg` and above it's the
 * original always-visible static sidebar, and this state is simply unused.
 */
export default function DashboardLayout({ children, dark = false }) {
  const { user, logout } = useAuth();
  const { tenant } = useTenant();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={`min-h-screen flex ${dark ? 'bg-zinc-950' : 'bg-gray-50'}`}>
      <Sidebar role={user?.role} dark={dark} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className={`flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b ${
            dark ? 'bg-zinc-900/80 backdrop-blur-xl border-zinc-800' : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className={`lg:hidden shrink-0 p-1.5 rounded-md ${
                dark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <Menu size={20} />
            </button>
            {tenant?.branding?.logoUrl && (
              <img src={tenant.branding.logoUrl} alt={tenant.companyName} className="h-7 w-7 rounded object-cover shrink-0" />
            )}
            <span className={`font-semibold truncate ${dark ? 'text-white' : 'text-gray-900'}`}>
              {dark ? tenant?.companyName || 'Platform Administration' : tenant?.companyName || 'CogniSphere'}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.fullName} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  dark ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {user?.fullName?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="text-right hidden sm:block">
              <p className={`text-sm font-medium ${dark ? 'text-white' : 'text-gray-900'}`}>{user?.fullName}</p>
              <p className={`text-xs capitalize ${dark ? 'text-zinc-400' : 'text-gray-500'}`}>
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={logout}
              className={`text-sm rounded-lg px-2.5 sm:px-3 py-1.5 border whitespace-nowrap ${
                dark ? 'border-zinc-700 text-zinc-200 hover:bg-zinc-800' : 'border-gray-300 hover:bg-gray-100'
              }`}
            >
              Log out
            </motion.button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {user?.role === 'hr_admin' && <CogniCopilot />}
    </div>
  );
}
