import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Megaphone,
  Inbox,
  Settings,
  ScrollText,
  BarChart3,
  BookOpen,
  Sparkles,
  Award,
  Users,
  LifeBuoy,
  GraduationCap,
  User,
  FileText,
  Globe,
  X,
} from 'lucide-react';

const NAV_BY_ROLE = {
  super_admin: [
    { to: '/superadmin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/superadmin/tenants', label: 'Organizations', icon: Building2 },
    { to: '/superadmin/billing', label: 'Billing & Plans', icon: CreditCard },
    { to: '/superadmin/broadcasts', label: 'System Broadcasts', icon: Megaphone },
    { to: '/superadmin/contact', label: 'Contact Requests', icon: Inbox },
    { to: '/superadmin/settings', label: 'Global Settings', icon: Settings },
    { to: '/superadmin/audit-logs', label: 'Audit Logs', icon: ScrollText },
  ],
  hr_admin: [
    { to: '/hr/dashboard', label: 'Overview & Analytics', icon: BarChart3 },
    { to: '/hr/organization', label: 'Organization Profile', icon: Building2 },
    { to: '/hr/profile', label: 'Public Profile', icon: Globe },
    { to: '/hr/courses', label: 'Course Manager', icon: BookOpen },
    { to: '/hr/quiz-architect', label: 'AI Quiz Architect', icon: Sparkles },
    { to: '/hr/results', label: 'Learner Results & Vault', icon: BarChart3 },
    { to: '/hr/certificates', label: 'Certificate Engine', icon: Award },
    { to: '/hr/instructors', label: 'Instructors', icon: GraduationCap },
    { to: '/hr/directory', label: 'Learner & Dept Directory', icon: Users },
    { to: '/hr/broadcasts', label: 'Broadcast Manager', icon: Megaphone },
    { to: '/hr/help', label: 'Help & Support', icon: LifeBuoy },
  ],
  learner: [
    { to: '/learner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/learner/courses', label: 'My Courses', icon: BookOpen },
    { to: '/learner/resources', label: 'Resource Hub', icon: FileText },
    { to: '/learner/instructors', label: 'Instructors', icon: GraduationCap },
    { to: '/learner/broadcasts', label: 'Notice Board', icon: Megaphone },
    { to: '/learner/performance', label: 'My Performance', icon: BarChart3 },
    { to: '/learner/profile', label: 'My Profile', icon: User },
  ],
};

/**
 * `mobileOpen` / `onClose` drive the drawer below the `lg` breakpoint —
 * the sidebar is `fixed` and slides in/out via `translate-x`, with a
 * backdrop that closes it on click, and closes itself when a nav link is
 * tapped. At `lg` and above it reverts to the original static, always-
 * visible, in-flow sidebar (the transform classes are neutralized there).
 */
export default function Sidebar({ role, dark = false, mobileOpen = false, onClose }) {
  const items = NAV_BY_ROLE[role] || [];

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r transform transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:h-screen lg:sticky lg:top-0 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${dark ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-white border-gray-200 text-gray-700'}`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className={`font-bold text-lg ${dark ? 'text-white' : 'text-gray-900'}`}>
            <span className="text-primary">Cogni</span>Sphere
            {dark && role === 'super_admin' && (
              <span className="ml-2 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-300 align-middle">
                ADMIN
              </span>
            )}
            {dark && role === 'hr_admin' && (
              <span className="ml-2 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-medium text-violet-300 align-middle">
                HR
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className={`lg:hidden p-1 rounded-md ${dark ? 'text-zinc-400 hover:bg-zinc-900' : 'text-gray-400 hover:bg-gray-100'}`}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? dark
                      ? 'bg-indigo-500/15 text-indigo-300'
                      : 'bg-primary/10 text-primary'
                    : dark
                    ? 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
