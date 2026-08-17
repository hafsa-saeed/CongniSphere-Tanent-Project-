import { useEffect, useState } from 'react';
import { Building2, Globe, Mail, Phone, Users, HardDrive, Lock, User } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import { Badge } from '../../components/ui/Badge';
import { SkeletonChart } from '../../components/ui/Skeleton';
import { getMyTenant, changeMyPassword } from '../../api/hrApi';
import { useAuth } from '../../context/AuthContext';
import { notify } from '../../lib/toast';

function UsageGauge({ label, used, limit, unit }) {
  const unlimited = limit === -1 || limit === undefined;
  const percent = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const color = percent > 85 ? '#F87171' : percent > 60 ? '#FBBF24' : '#34D399';

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-zinc-500 mb-2">{label}</p>
      <p className="text-lg font-bold text-white mb-2">
        {used.toLocaleString()}
        {unit} <span className="text-sm font-normal text-zinc-500">/ {unlimited ? 'Unlimited' : `${limit.toLocaleString()}${unit}`}</span>
      </p>
      <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: unlimited ? '8%' : `${percent}%`, background: color }} />
      </div>
    </div>
  );
}

export default function OrganizationProfile() {
  const { user } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getMyTenant();
        setTenant(data.data);
      } catch (err) {
        notify.error(err.response?.data?.message || 'Failed to load organization profile.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  if (loading || !tenant) {
    return (
      <DashboardLayout dark>
        <h1 className="text-2xl font-bold text-white mb-6">Organization Profile</h1>
        <SkeletonChart height={400} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout dark>
      <h1 className="text-2xl font-bold text-white mb-6">Organization Profile</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="p-5 lg:col-span-2">
          <div className="flex items-start gap-4 mb-5">
            {tenant.branding?.logoUrl ? (
              <img src={tenant.branding.logoUrl} alt={tenant.companyName} className="h-14 w-14 rounded-lg object-cover" />
            ) : (
              <div className="h-14 w-14 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <Building2 size={22} className="text-indigo-400" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-white">{tenant.companyName}</h2>
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-1">
                <Globe size={12} /> {tenant.subdomain}.cognisphere.com
              </div>
              <div className="flex gap-2 mt-2">
                <Badge variant={tenant.isActive ? 'success' : 'danger'}>{tenant.isActive ? 'Active' : 'Suspended'}</Badge>
                <Badge variant="primary">{tenant.subscription.tier}</Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Primary color</p>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md border border-white/10" style={{ background: tenant.branding?.primaryColor }} />
                <span className="text-xs text-zinc-400">{tenant.branding?.primaryColor}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Secondary color</p>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md border border-white/10" style={{ background: tenant.branding?.secondaryColor }} />
                <span className="text-xs text-zinc-400">{tenant.branding?.secondaryColor}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase text-zinc-500 mb-2">Primary Contact</h3>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-1.5">
              <p className="text-sm text-zinc-200">{tenant.primaryContact?.name || '—'}</p>
              <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                <Mail size={12} /> {tenant.primaryContact?.email || '—'}
              </p>
              {tenant.primaryContact?.phone && (
                <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <Phone size={12} /> {tenant.primaryContact.phone}
                </p>
              )}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <HardDrive size={16} className="text-indigo-400" /> Resource Usage
          </h2>
          <div className="space-y-4">
            <UsageGauge label="Seat usage" used={tenant.usage?.currentUserCount || 0} limit={tenant.limits.maxUsers} unit=" users" />
            <UsageGauge
              label="Storage usage"
              used={Math.round(((tenant.usage?.currentStorageUsedMB || 0) / 1024) * 10) / 10}
              limit={tenant.limits.maxStorageGB}
              unit=" GB"
            />
            <UsageGauge label="Courses" used={tenant.usage?.currentCourseCount || 0} limit={tenant.limits.maxCourses} unit="" />
          </div>
          <div className="mt-5 pt-4 border-t border-white/10 text-xs text-zinc-500 flex items-center gap-1.5">
            <Users size={12} /> Usage syncs automatically to the Super Admin panel.
          </div>
        </GlassCard>

        <GlassCard className="p-5 lg:col-span-3">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <User size={16} className="text-indigo-400" /> My Account
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="text-sm text-zinc-300">
              <p className="font-medium text-white">{user?.fullName}</p>
              <p className="text-xs text-zinc-500">{user?.email}</p>
            </div>
            <form onSubmit={handleChangePassword} className="flex flex-1 flex-col sm:flex-row gap-2">
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
          </div>
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}
