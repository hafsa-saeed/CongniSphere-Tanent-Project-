import { useEffect, useState } from 'react';
import { Globe, Plus, X, Save, Eye, Lock } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import { SkeletonChart } from '../../components/ui/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { getMyTenant, updateMyPublicProfile, changeMyPassword } from '../../api/hrApi';
import { notify } from '../../lib/toast';

export default function HrPublicProfileManager() {
  const { user } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [aboutUs, setAboutUs] = useState('');
  const [missionStatement, setMissionStatement] = useState('');
  const [featuredPrograms, setFeaturedPrograms] = useState([]);
  const [newProgram, setNewProgram] = useState('');
  const [primaryContactEmail, setPrimaryContactEmail] = useState('');
  const [primaryContactPhone, setPrimaryContactPhone] = useState('');
  const [portalGuidelines, setPortalGuidelines] = useState('');
  const [isPubliclyListed, setIsPubliclyListed] = useState(true);

  useEffect(() => {
    getMyTenant()
      .then((res) => {
        const t = res.data.data;
        setTenant(t);
        const p = t.publicProfile || {};
        setAboutUs(p.aboutUs || '');
        setMissionStatement(p.missionStatement || '');
        setFeaturedPrograms(p.featuredPrograms || []);
        setPrimaryContactEmail(p.primaryContactEmail || '');
        setPrimaryContactPhone(p.primaryContactPhone || '');
        setPortalGuidelines(p.portalGuidelines || '');
        setIsPubliclyListed(p.isPubliclyListed ?? true);
      })
      .catch((err) => notify.error(err.response?.data?.message || 'Failed to load profile.'))
      .finally(() => setLoading(false));
  }, []);

  const addProgram = () => {
    if (!newProgram.trim()) return;
    setFeaturedPrograms((p) => [...p, newProgram.trim()]);
    setNewProgram('');
  };

  const removeProgram = (index) => setFeaturedPrograms((p) => p.filter((_, i) => i !== index));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMyPublicProfile({
        aboutUs,
        missionStatement,
        featuredPrograms,
        primaryContactEmail,
        primaryContactPhone,
        portalGuidelines,
        isPubliclyListed,
      });
      notify.success('Public profile updated — your /org page is live with these changes.');
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      notify.error('Both password fields are required.');
      return;
    }
    setChangingPassword(true);
    try {
      await changeMyPassword({ currentPassword, newPassword });
      notify.success('Password changed.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout dark>
        <h1 className="text-2xl font-bold text-white mb-6">Public Profile Customizer</h1>
        <SkeletonChart height={400} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout dark>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Public Profile Customizer</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Controls what appears on{' '}
            <a
              href={'http://localhost:3000/org/' + tenant?.subdomain}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
            >
              your public page <Eye size={12} />
            </a>
          </p>
        </div>
      </div>

      <GlassCard className="p-5 max-w-2xl mb-6">
        <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
          <Lock size={16} className="text-indigo-400" /> Account Security
        </h2>
        <p className="text-xs text-zinc-500 mb-4">{user?.fullName} · {user?.email}</p>
        <form onSubmit={handleChangePassword} className="flex flex-col sm:flex-row gap-2">
          <input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={changingPassword}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 whitespace-nowrap"
          >
            <Lock size={13} /> {changingPassword ? 'Saving…' : 'Change password'}
          </button>
        </form>
      </GlassCard>

      <form onSubmit={handleSave} className="max-w-2xl space-y-6">
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Listed in public showcase</p>
              <p className="text-xs text-zinc-500">When off, your organization won't appear on the CogniSphere landing page directory.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsPubliclyListed((v) => !v)}
              className={'relative h-6 w-11 shrink-0 rounded-full transition-colors ' + (isPubliclyListed ? 'bg-emerald-500' : 'bg-zinc-700')}
            >
              <span
                className={'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ' + (isPubliclyListed ? 'translate-x-5' : 'translate-x-0.5')}
              />
            </button>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">About Us</label>
            <textarea
              value={aboutUs}
              onChange={(e) => setAboutUs(e.target.value)}
              rows={4}
              placeholder="What does your organization do?"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">Mission Statement</label>
            <textarea
              value={missionStatement}
              onChange={(e) => setMissionStatement(e.target.value)}
              rows={2}
              placeholder="A short statement of your training mission or values"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </GlassCard>

        <GlassCard className="p-5 space-y-3">
          <label className="block text-xs text-zinc-500">Featured Programs</label>
          <div className="flex flex-wrap gap-2">
            {featuredPrograms.map((p, i) => (
              <span key={i} className="flex items-center gap-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 text-xs text-indigo-300">
                {p}
                <button type="button" onClick={() => removeProgram(i)} className="hover:text-red-400">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newProgram}
              onChange={(e) => setNewProgram(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addProgram();
                }
              }}
              placeholder="e.g. Leadership Development"
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="button" onClick={addProgram} className="flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800">
              <Plus size={14} /> Add
            </button>
          </div>
        </GlassCard>

        <GlassCard className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Support Email</label>
              <input
                type="email"
                value={primaryContactEmail}
                onChange={(e) => setPrimaryContactEmail(e.target.value)}
                placeholder="support@yourcompany.com"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Support Phone</label>
              <input
                value={primaryContactPhone}
                onChange={(e) => setPrimaryContactPhone(e.target.value)}
                placeholder="0300-1234567"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1 flex items-center gap-1.5">
              <Globe size={11} /> Portal Guidelines
            </label>
            <textarea
              value={portalGuidelines}
              onChange={(e) => setPortalGuidelines(e.target.value)}
              rows={3}
              placeholder="Any guidance for learners accessing your portal (e.g. onboarding steps, expectations)"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </GlassCard>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          <Save size={14} /> {saving ? 'Saving…' : 'Save public profile'}
        </button>
      </form>
    </DashboardLayout>
  );
}
