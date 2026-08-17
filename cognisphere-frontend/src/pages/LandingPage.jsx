import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Building2, GraduationCap, ArrowRight, Send, X, Sparkles } from 'lucide-react';
import { listPublicTenants, submitOnboardingRequest } from '../api/publicApi';
import { notify } from '../lib/toast';

const FEATURES = [
  {
    icon: Crown,
    title: 'Super Admin',
    description:
      'Platform-wide control: onboard organizations, manage subscription tiers and usage limits, push system-wide broadcasts, and monitor MRR, storage, and growth across every tenant from one dashboard.',
  },
  {
    icon: Building2,
    title: 'Organization (HR Admin)',
    description:
      'Build courses with a drag-and-drop module builder, generate AI-assisted quizzes with a human-in-the-loop editor, track learner results in real time, and auto-issue dynamic certificates on completion.',
  },
  {
    icon: GraduationCap,
    title: 'Learner / Employee',
    description:
      'A dedicated portal for enrolled courses, a full-featured video and PDF player, quizzes with instant scoring, a certificate vault, and org-wide announcements — all scoped strictly to your own company.',
  },
];

const initialForm = { companyName: '', contactName: '', contactEmail: '', contactPhone: '', message: '' };

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition: { duration: 0.5, delay, ease: 'easeOut' },
  };
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listPublicTenants()
      .then((res) => setOrganizations(res.data.data))
      .catch(() => {}) // showcase is optional decoration — a failed fetch shouldn't break the landing page
      .finally(() => setLoadingOrgs(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.companyName.trim() || !form.contactName.trim() || !form.contactEmail.trim()) {
      notify.error('Company name, contact name and email are required.');
      return;
    }
    setSubmitting(true);
    try {
      await submitOnboardingRequest(form);
      notify.success("Request received — our team will reach out to you shortly.");
      setForm(initialForm);
      setModalOpen(false);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      {/* ---------- Top nav ---------- */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <span className="font-bold text-lg text-white">
            <span className="text-indigo-400">Cogni</span>Sphere
          </span>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setModalOpen(true)}
              className="hidden sm:inline-flex text-sm font-medium text-zinc-300 hover:text-white px-3 py-2"
            >
              Request Organization Onboarding
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/login')}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Login / Portal Access <ArrowRight size={14} />
            </motion.button>
          </div>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-300 mb-6">
            <Sparkles size={12} /> Enterprise Multi-Tenant Learning Platform
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-5">
            One platform. Every organization's training, fully isolated.
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            CogniSphere gives each company its own branded portal, course library, quiz engine, and learner
            analytics — securely separated from every other tenant on the platform.
          </p>
        </motion.div>
      </section>

      {/* ---------- Role breakdown ---------- */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <motion.h2 {...fadeUp()} className="text-xl font-semibold text-white text-center mb-10">
          How each role experiences CogniSphere
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              {...fadeUp(i * 0.1)}
              whileHover={{ scale: 1.02, boxShadow: '0 0 0 1px rgba(129,140,248,0.35), 0 20px 40px -14px rgba(79,70,229,0.35)' }}
              className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6"
            >
              <div className="rounded-lg bg-indigo-500/10 p-2.5 w-fit mb-4">
                <f.icon size={20} className="text-indigo-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------- Organizations showcase ---------- */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <motion.h2 {...fadeUp()} className="text-xl font-semibold text-white text-center mb-2">
          Onboarded Organizations &amp; Partners
        </motion.h2>
        <motion.p {...fadeUp(0.05)} className="text-sm text-zinc-500 text-center mb-10">
          Companies already running their training on CogniSphere.
        </motion.p>

        {loadingOrgs ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-white/10 bg-white/[0.03] p-6 h-32" />
            ))}
          </div>
        ) : organizations.length === 0 ? (
          <p className="text-center text-sm text-zinc-500">No organizations are publicly listed yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {organizations.map((org, i) => (
              <motion.div key={org.subdomain} {...fadeUp(i * 0.06)}>
                <Link
                  to={`/org/${org.subdomain}`}
                  className="block h-full rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 hover:bg-white/[0.06] transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    {org.logoUrl ? (
                      <img src={org.logoUrl} alt={org.companyName} className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold"
                        style={{ background: org.primaryColor || '#4F46E5' }}
                      >
                        {org.companyName?.[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-white">{org.companyName}</p>
                      {org.industry && <p className="text-xs text-zinc-500">{org.industry}</p>}
                    </div>
                  </div>
                  {org.aboutUsExcerpt && <p className="text-sm text-zinc-400 line-clamp-2">{org.aboutUsExcerpt}</p>}
                  <span className="mt-3 inline-flex items-center gap-1 text-xs text-indigo-400">
                    View profile <ArrowRight size={11} />
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-zinc-800 py-8 text-center text-xs text-zinc-600">
        © {new Date().getFullYear()} CogniSphere. Multi-tenant learning platform.
      </footer>

      {/* ---------- Onboarding request modal ---------- */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-white">Request Organization Onboarding</h3>
                <button onClick={() => setModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
                <input
                  placeholder="Company name"
                  value={form.companyName}
                  onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  placeholder="Your name"
                  value={form.contactName}
                  onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="email"
                  placeholder="Work email"
                  value={form.contactEmail}
                  onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  placeholder="Phone (optional)"
                  value={form.contactPhone}
                  onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <textarea
                  placeholder="Tell us about your team — size, use case, timeline (optional)"
                  rows={3}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  <Send size={14} /> {submitting ? 'Sending…' : 'Submit request'}
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
