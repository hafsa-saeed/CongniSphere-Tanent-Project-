import { useEffect, useState } from 'react';
import { Mail, Cloud, Sliders, Palette, Save } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import Tabs from '../../components/ui/Tabs';
import { SkeletonChart } from '../../components/ui/Skeleton';
import { getGlobalSettings, updateGlobalSettings } from '../../api/superadminApi';
import { notify } from '../../lib/toast';

function FieldLabel({ children }) {
  return <label className="block text-xs text-zinc-500 mb-1">{children}</label>;
}

function TextInput(props) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />
  );
}

function SaveButton({ onClick, saving }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
    >
      <Save size={14} /> {saving ? 'Saving…' : 'Save changes'}
    </button>
  );
}

export default function SystemSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local editable copies per section
  const [smtp, setSmtp] = useState({ host: '', port: 587, secure: false, username: '', fromEmail: '', fromName: '' });
  const [storage, setStorage] = useState({ storageProvider: 'local', maxVideoSizeMB: 2048, maxDocumentSizeMB: 50 });
  const [tiers, setTiers] = useState(null);
  const [branding, setBranding] = useState({ platformName: '', platformLogoUrl: '', supportEmail: '' });
  const [logoPreview, setLogoPreview] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getGlobalSettings();
        const s = data.data;
        setSmtp({
          host: s.smtp?.host || '',
          port: s.smtp?.port || 587,
          secure: s.smtp?.secure || false,
          username: s.smtp?.username || '',
          fromEmail: s.smtp?.fromEmail || '',
          fromName: s.smtp?.fromName || '',
        });
        setStorage({
          storageProvider: s.uploads?.storageProvider || 'local',
          maxVideoSizeMB: s.uploads?.maxVideoSizeMB || 2048,
          maxDocumentSizeMB: s.uploads?.maxDocumentSizeMB || 50,
        });
        setTiers(s.subscriptionTierDefaults);
        setBranding({ platformName: s.platformName || '', platformLogoUrl: s.platformLogoUrl || '', supportEmail: s.supportEmail || '' });
      } catch (err) {
        notify.error(err.response?.data?.message || 'Failed to load settings.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async (section, payload, label) => {
    setSaving(true);
    try {
      await updateGlobalSettings({ [section]: payload });
      notify.success(`${label} saved.`);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const saveBranding = async () => {
    setSaving(true);
    try {
      await updateGlobalSettings({
        platformName: branding.platformName,
        platformLogoUrl: branding.platformLogoUrl,
        supportEmail: branding.supportEmail,
      });
      notify.success('Branding saved.');
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to save branding.');
    } finally {
      setSaving(false);
    }
  };

  const updateTierField = (tier, field, value) => {
    setTiers((t) => ({ ...t, [tier]: { ...t[tier], [field]: Number(value) } }));
  };

  const handleLogoFileSelect = (file) => {
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
  };

  if (loading) {
    return (
      <DashboardLayout dark>
        <h1 className="text-2xl font-bold text-white mb-6">Global Settings</h1>
        <SkeletonChart height={400} />
      </DashboardLayout>
    );
  }

  const tabs = [
    {
      id: 'smtp',
      label: 'SMTP / Email',
      icon: Mail,
      content: (
        <GlassCard className="p-5 max-w-lg space-y-3">
          <div>
            <FieldLabel>Host</FieldLabel>
            <TextInput placeholder="smtp.sendgrid.net" value={smtp.host} onChange={(e) => setSmtp((s) => ({ ...s, host: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Port</FieldLabel>
              <TextInput type="number" value={smtp.port} onChange={(e) => setSmtp((s) => ({ ...s, port: Number(e.target.value) }))} />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={smtp.secure} onChange={(e) => setSmtp((s) => ({ ...s, secure: e.target.checked }))} />
                Use TLS/SSL
              </label>
            </div>
          </div>
          <div>
            <FieldLabel>Username</FieldLabel>
            <TextInput value={smtp.username} onChange={(e) => setSmtp((s) => ({ ...s, username: e.target.value }))} />
          </div>
          <div>
            <FieldLabel>Password</FieldLabel>
            <TextInput type="password" placeholder="••••••••" onChange={(e) => setSmtp((s) => ({ ...s, password: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>From email</FieldLabel>
              <TextInput type="email" value={smtp.fromEmail} onChange={(e) => setSmtp((s) => ({ ...s, fromEmail: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>From name</FieldLabel>
              <TextInput value={smtp.fromName} onChange={(e) => setSmtp((s) => ({ ...s, fromName: e.target.value }))} />
            </div>
          </div>
          <SaveButton saving={saving} onClick={() => save('smtp', smtp, 'SMTP settings')} />
        </GlassCard>
      ),
    },
    {
      id: 'storage',
      label: 'Storage Setup',
      icon: Cloud,
      content: (
        <GlassCard className="p-5 max-w-lg space-y-3">
          <p className="text-xs text-zinc-500 mb-1">
            S3/R2 credentials are configured via backend environment variables for security. This tab controls
            platform-wide upload limits and which provider is active for reference.
          </p>
          <div>
            <FieldLabel>Active storage provider</FieldLabel>
            <select
              value={storage.storageProvider}
              onChange={(e) => setStorage((s) => ({ ...s, storageProvider: e.target.value }))}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="local">Local disk</option>
              <option value="s3">AWS S3</option>
              <option value="gcs">Google Cloud Storage</option>
              <option value="azure_blob">Azure Blob</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Max video size (MB)</FieldLabel>
              <TextInput type="number" value={storage.maxVideoSizeMB} onChange={(e) => setStorage((s) => ({ ...s, maxVideoSizeMB: Number(e.target.value) }))} />
            </div>
            <div>
              <FieldLabel>Max document size (MB)</FieldLabel>
              <TextInput type="number" value={storage.maxDocumentSizeMB} onChange={(e) => setStorage((s) => ({ ...s, maxDocumentSizeMB: Number(e.target.value) }))} />
            </div>
          </div>
          <SaveButton saving={saving} onClick={() => save('uploads', storage, 'Storage settings')} />
        </GlassCard>
      ),
    },
    {
      id: 'tiers',
      label: 'Tier Quotas',
      icon: Sliders,
      content: tiers && (
        <GlassCard className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(tiers).map(([tier, limits]) => (
              <div key={tier} className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-2">
                <p className="text-sm font-semibold text-white capitalize">{tier}</p>
                {'maxUsers' in limits && (
                  <div>
                    <FieldLabel>Max users</FieldLabel>
                    <TextInput type="number" value={limits.maxUsers} onChange={(e) => updateTierField(tier, 'maxUsers', e.target.value)} />
                  </div>
                )}
                {'maxCourses' in limits && (
                  <div>
                    <FieldLabel>Max courses</FieldLabel>
                    <TextInput type="number" value={limits.maxCourses} onChange={(e) => updateTierField(tier, 'maxCourses', e.target.value)} />
                  </div>
                )}
                {'pricePerSeat' in limits && (
                  <div>
                    <FieldLabel>Price/seat (Rs.)</FieldLabel>
                    <TextInput type="number" value={limits.pricePerSeat} onChange={(e) => updateTierField(tier, 'pricePerSeat', e.target.value)} />
                  </div>
                )}
                {'durationDays' in limits && (
                  <div>
                    <FieldLabel>Trial duration (days)</FieldLabel>
                    <TextInput type="number" value={limits.durationDays} onChange={(e) => updateTierField(tier, 'durationDays', e.target.value)} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <SaveButton saving={saving} onClick={() => save('subscriptionTierDefaults', tiers, 'Tier quotas')} />
        </GlassCard>
      ),
    },
    {
      id: 'branding',
      label: 'Branding',
      icon: Palette,
      content: (
        <GlassCard className="p-5 max-w-lg space-y-4">
          <div>
            <FieldLabel>App name</FieldLabel>
            <TextInput value={branding.platformName} onChange={(e) => setBranding((b) => ({ ...b, platformName: e.target.value }))} />
          </div>
          <div>
            <FieldLabel>Logo URL</FieldLabel>
            <TextInput
              placeholder="https://…"
              value={branding.platformLogoUrl}
              onChange={(e) => setBranding((b) => ({ ...b, platformLogoUrl: e.target.value }))}
            />
          </div>
          <div>
            <FieldLabel>Preview a logo file (local only, not uploaded)</FieldLabel>
            <input type="file" accept="image/*" onChange={(e) => handleLogoFileSelect(e.target.files[0])} className="text-xs text-zinc-400" />
          </div>
          {(logoPreview || branding.platformLogoUrl) && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 flex items-center justify-center">
              <img src={logoPreview || branding.platformLogoUrl} alt="Logo preview" className="h-14 object-contain" />
            </div>
          )}
          <div>
            <FieldLabel>Primary support email</FieldLabel>
            <TextInput type="email" value={branding.supportEmail} onChange={(e) => setBranding((b) => ({ ...b, supportEmail: e.target.value }))} />
          </div>
          <SaveButton saving={saving} onClick={saveBranding} />
        </GlassCard>
      ),
    },
  ];

  return (
    <DashboardLayout dark>
      <h1 className="text-2xl font-bold text-white mb-6">Global Settings</h1>
      <Tabs tabs={tabs} />
    </DashboardLayout>
  );
}
