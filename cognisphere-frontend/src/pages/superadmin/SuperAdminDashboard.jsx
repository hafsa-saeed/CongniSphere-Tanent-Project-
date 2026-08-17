import { useEffect, useState } from 'react';
import { Building2, DollarSign, TrendingUp, HardDrive, Users } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import DashboardLayout from '../../components/layout/DashboardLayout';
import StatCard from '../../components/ui/StatCard';
import GlassCard from '../../components/ui/GlassCard';
import { SkeletonStatCard, SkeletonChart } from '../../components/ui/Skeleton';
import { getTenantAnalyticsOverview } from '../../api/superadminApi';
import { notify } from '../../lib/toast';

const PIE_COLORS = ['#818CF8', '#34D399', '#FBBF24', '#F472B6'];

const chartTooltipStyle = {
  background: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#f4f4f5',
};

export default function SuperAdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: res } = await getTenantAnalyticsOverview();
        setData(res.data);
      } catch (err) {
        notify.error(err.response?.data?.message || 'Failed to load platform analytics.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const planDistribution = (data?.planDistribution || []).filter((p) => p.count > 0);

  return (
    <DashboardLayout dark>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="text-sm text-zinc-500 mt-1">Real-time metrics across every organization on CogniSphere.</p>
      </div>

      {/* ---------- Stat cards ---------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {loading || !data ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonStatCard key={i} />)
        ) : (
          <>
            <StatCard dark label="Total Organizations" value={data.totalTenants} icon={Building2} trendPercent={data.tenantGrowthPercent} sublabel="vs. last 30 days" />
            <StatCard dark label="Active Organizations" value={data.activeTenants} icon={Building2} sublabel={`${data.trialTenants} on trial`} />
            <StatCard dark label="Total System Users" value={data.totalSystemUsers.toLocaleString()} icon={Users} sublabel="across every organization" />
            <StatCard dark label="Total Storage Used" value={`${(data.totalStorageUsedMB / 1024).toFixed(1)} GB`} icon={HardDrive} sublabel="all uploads, all tenants" />
            <StatCard dark label="Monthly Recurring Revenue" value={`Rs. ${data.currentMrr.toLocaleString()}`} icon={DollarSign} trendPercent={data.mrrGrowthPercent} sublabel="vs. last 30 days" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* ---------- MRR trend line chart ---------- */}
        <div className="lg:col-span-2">
          {loading || !data ? (
            <SkeletonChart />
          ) : (
            <GlassCard className="p-5">
              <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-400" /> Monthly Revenue Trend
              </h2>
              <p className="text-xs text-zinc-500 mb-4">Cumulative MRR from active organizations, last 6 months</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.mrrTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `Rs.${v}`} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`Rs. ${v.toLocaleString()}`, 'MRR']} />
                  <Line type="monotone" dataKey="mrr" stroke="#818CF8" strokeWidth={2.5} dot={{ fill: '#818CF8', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </GlassCard>
          )}
        </div>

        {/* ---------- Plan distribution pie chart ---------- */}
        {loading || !data ? (
          <SkeletonChart />
        ) : (
          <GlassCard className="p-5">
            <h2 className="font-semibold text-white mb-4">Plan Distribution</h2>
            {planDistribution.length === 0 ? (
              <p className="text-sm text-zinc-500 py-16 text-center">No organizations yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={planDistribution} dataKey="count" nameKey="tier" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {planDistribution.map((entry, i) => (
                      <Cell key={entry.tier} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend
                    formatter={(value) => <span className="text-zinc-400 text-xs capitalize">{value}</span>}
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </GlassCard>
        )}
      </div>

      {/* ---------- Storage usage bar chart ---------- */}
      {loading || !data ? (
        <SkeletonChart />
      ) : (
        <GlassCard className="p-5">
          <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
            <HardDrive size={16} className="text-indigo-400" /> Storage Usage by Organization
          </h2>
          <p className="text-xs text-zinc-500 mb-4">Top 10 by storage consumption — video/PDF hosting for course content</p>
          {data.storageUsage.length === 0 ? (
            <p className="text-sm text-zinc-500 py-16 text-center">No storage usage recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.storageUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="companyName" stroke="#71717a" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `${(v / 1024).toFixed(0)}GB`} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`${(v / 1024).toFixed(2)} GB`, 'Used']} />
                <Bar dataKey="usedMB" fill="#818CF8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </GlassCard>
      )}
    </DashboardLayout>
  );
}
