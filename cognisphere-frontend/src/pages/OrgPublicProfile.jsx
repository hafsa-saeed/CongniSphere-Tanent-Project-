import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Phone, BookOpen, Target, ScrollText, Building2 } from 'lucide-react';
import { getPublicTenant } from '../api/publicApi';

export default function OrgPublicProfile() {
  const { slug } = useParams();
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getPublicTenant(slug)
      .then((res) => setOrg(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'This organization does not have a public page.'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Loading…</p>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 text-center">
        <p className="text-white font-medium mb-2">{error}</p>
        <Link to="/" className="text-sm text-indigo-400 hover:text-indigo-300">
          ← Back to CogniSphere
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-xl sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
            <ArrowLeft size={14} /> CogniSphere
          </Link>
          <Link
            to="/login"
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Portal Login
          </Link>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="mx-auto max-w-4xl px-6 py-14"
      >
        <div className="flex items-center gap-4 mb-8">
          {org.branding?.logoUrl ? (
            <img src={org.branding.logoUrl} alt={org.companyName} className="h-16 w-16 rounded-xl object-cover" />
          ) : (
            <div
              className="h-16 w-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold"
              style={{ background: org.branding?.primaryColor || '#4F46E5' }}
            >
              {org.companyName?.[0]}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">{org.companyName}</h1>
            <p className="text-sm text-zinc-500">
              {org.industry || 'Organization'} {org.companySize && `· ${org.companySize} employees`}
            </p>
          </div>
        </div>

        {org.publicProfile?.missionStatement && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
            className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-6 mb-8"
          >
            <div className="flex items-center gap-2 mb-2">
              <Target size={15} className="text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Mission</h2>
            </div>
            <p className="text-sm text-zinc-300 italic">"{org.publicProfile.missionStatement}"</p>
          </motion.div>
        )}

        {org.publicProfile?.aboutUs && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Building2 size={15} className="text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">About</h2>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-line">{org.publicProfile.aboutUs}</p>
          </section>
        )}

        {org.publicProfile?.featuredPrograms?.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={15} className="text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Featured Programs</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {org.publicProfile.featuredPrograms.map((p, i) => (
                <span key={i} className="rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-zinc-300">
                  {p}
                </span>
              ))}
            </div>
          </section>
        )}

        {org.courses?.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={15} className="text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Courses Offered</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {org.courses.map((c, i) => (
                <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-white">{c.title}</p>
                  {c.category && <p className="text-xs text-zinc-500 mt-0.5">{c.category}</p>}
                  {c.shortDescription && <p className="text-xs text-zinc-400 mt-1.5">{c.shortDescription}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {org.publicProfile?.portalGuidelines && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <ScrollText size={15} className="text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Portal Guidelines</h2>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-line">{org.publicProfile.portalGuidelines}</p>
          </section>
        )}

        {(org.supportEmail || org.supportPhone) && (
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-sm font-semibold text-white mb-3">Support Contact</h2>
            <div className="space-y-1.5 text-sm text-zinc-400">
              {org.supportEmail && (
                <p className="flex items-center gap-2">
                  <Mail size={13} /> {org.supportEmail}
                </p>
              )}
              {org.supportPhone && (
                <p className="flex items-center gap-2">
                  <Phone size={13} /> {org.supportPhone}
                </p>
              )}
            </div>
          </section>
        )}
      </motion.main>
    </div>
  );
}
