import { useEffect, useState } from 'react';
import { CreditCard, DollarSign } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/Badge';
import { getTenants, getGlobalSettings } from '../../api/superadminApi';
import { notify } from '../../lib/toast';

const TIER_LABELS = { trial: 'Trial', starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' };

export default function BillingPlans() {
  const [tenants, setTenants] = useState([]);
  const [tierDefaults, setTierDefaults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [tenantsRes, settingsRes] = await Promise.all([getTenants({ limit: 100 }), getGlobalSettings()]);
        setTenants(tenantsRes.data.data.tenants);
        setTierDefaults(settingsRes.data.data.subscriptionTierDefaults);
      } catch (err) {
        notify.error(err.response?.data?.message || 'Failed to load billing data.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalRevenue = tenants
    .filter((t) => t.subscription.status === 'active')
    .reduce((sum, t) => sum + (t.usage?.currentUserCount || 0) * (t.subscription.pricePerSeat || 0), 0);

  return (
    <DashboardLayout dark>
      <h1 className="text-2xl font-bold text-white mb-6">Billing &amp; Plans</h1>

      <GlassCard className="p-5 mb-8 flex items-center gap-4">
        <div className="rounded-lg bg-emerald-500/10 p-3">
          <DollarSign size={22} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-sm text-zinc-400">Total Monthly Recurring Revenue</p>
          <p className="text-2xl font-bold text-white">Rs. {totalRevenue.toLocaleString()}</p>
        </div>
      </GlassCard>

      {tierDefaults && (
        <GlassCard className="p-5 mb-8">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <CreditCard size={16} /> Tier Quotas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(tierDefaults).map(([tier, limits]) => (
              <div key={tier} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white mb-2">{TIER_LABELS[tier] || tier}</p>
                <p className="text-xs text-zinc-400">
                  Users: {limits.maxUsers === -1 ? 'Unlimited' : limits.maxUsers}
                </p>
                {limits.maxCourses !== undefined && (
                  <p className="text-xs text-zinc-400">Courses: {limits.maxCourses === -1 ? 'Unlimited' : limits.maxCourses}</p>
                )}
                {limits.pricePerSeat !== undefined && (
                  <p className="text-xs text-zinc-400">Rs. {limits.pricePerSeat}/seat</p>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <GlassCard className="overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="font-semibold text-white">Revenue by Organization</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-400 border-b border-white/10">
              <th className="px-5 py-3 font-medium">Company</th>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Seats</th>
              <th className="px-5 py-3 font-medium">Price/seat</th>
              <th className="px-5 py-3 font-medium">Est. Monthly Revenue</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          {loading ? (
            <SkeletonTable rows={5} columns={6} />
          ) : (
            <tbody>
              {tenants.map((t) => (
                <tr key={t._id} className="border-b border-white/5 text-zinc-200">
                  <td className="px-5 py-3">{t.companyName}</td>
                  <td className="px-5 py-3 capitalize">{t.subscription.tier}</td>
                  <td className="px-5 py-3">{t.usage?.currentUserCount || 0}</td>
                  <td className="px-5 py-3">Rs. {t.subscription.pricePerSeat || 0}</td>
                  <td className="px-5 py-3 font-medium">
                    Rs. {((t.usage?.currentUserCount || 0) * (t.subscription.pricePerSeat || 0)).toLocaleString()}
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={t.subscription.status === 'active' ? 'success' : 'warning'}>{t.subscription.status}</Badge>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-zinc-500">
                    No organizations yet.
                  </td>
                </tr>
              )}
            </tbody>
          )}
        </table>
      </GlassCard>
    </DashboardLayout>
  );
}
