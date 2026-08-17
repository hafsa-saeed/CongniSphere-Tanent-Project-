import { useEffect, useState } from 'react';
import { Users, BookOpen, CheckCircle2, TrendingUp, HardDrive, Target } from 'lucide-react';
import {
  LineChart,
  Line,
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
import GlassCard from '../../components/ui/GlassCard';
import StatCard from '../../components/ui/StatCard';
import { SkeletonStatCard, SkeletonChart } from '../../components/ui/Skeleton';
import { getAnalyticsOverview } from '../../api/hrApi';
import { notify } from '../../lib/toast';

const chartTooltipStyle = {
  background: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#f4f4f5',
};

function Gauge({ label, used, limit, unit }) {
  const unlimited = limit === -1 || limit === undefined;
  const percent = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const color = percent > 85 ? '#F87171' : percent > 60 ? '#FBBF24' : '#34D399';

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
        <span>{label}</span>
        <span>
          {used.toLocaleString()}
          {unit} {unlimited ? '(unlimited)' : `/ ${limit.toLocaleString()}${unit}`}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: unlimited ? '8%' : `${percent}%`, background: color }} />
      </div>
    </div>
  );
}

export default function HrOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: res } = await getAnalyticsOverview();
        setData(res.data);
      } catch (err) {
        notify.error(err.response?.data?.message || 'Failed to load analytics.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const passFailData = data
    ? [
        { name: 'Passed', value: data.passFailRatio.passed },
        { name: 'Failed', value: data.passFailRatio.failed },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <DashboardLayout dark>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Overview &amp; Analytics</h1>
        <p className="text-sm text-zinc-500 mt-1">Your organization's training performance at a glance.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {loading || !data ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonStatCard key={i} />)
        ) : (
          <>
            <StatCard dark label="Active Learners" value={data.activeLearners} icon={Users} />
            <StatCard dark label="Published Courses" value={data.publishedCourses} icon={BookOpen} />
            <StatCard dark label="Completion Rate" value={`${data.overallCompletionRatePercent}%`} icon={CheckCircle2} />
            <StatCard
              dark
              label="Avg. Quiz Score"
              value={data.totalQuizAttempts > 0 ? `${data.averageQuizScorePercent}%` : '—'}
              icon={Target}
              sublabel={`${data.totalQuizAttempts} attempts`}
            />
            <StatCard dark label="Avg. Progress" value={`${data.averageProgressPercent}%`} icon={TrendingUp} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          {loading || !data ? (
            <SkeletonChart />
          ) : (
            <GlassCard className="p-5">
              <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-400" /> Monthly Progress
              </h2>
              <p className="text-xs text-zinc-500 mb-4">Course completions per month, last 6 months</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.monthlyProgress}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Line type="monotone" dataKey="completions" stroke="#A78BFA" strokeWidth={2.5} dot={{ fill: '#A78BFA', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </GlassCard>
          )}
        </div>

        {loading || !data ? (
          <SkeletonChart />
        ) : (
          <GlassCard className="p-5">
            <h2 className="font-semibold text-white mb-4">Pass vs Fail</h2>
            {passFailData.length === 0 ? (
              <p className="text-sm text-zinc-500 py-16 text-center">No quiz attempts recorded yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={passFailData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    <Cell fill="#34D399" />
                    <Cell fill="#F87171" />
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend formatter={(value) => <span className="text-zinc-400 text-xs">{value}</span>} iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </GlassCard>
        )}
      </div>

      {loading || !data ? (
        <SkeletonChart height={140} />
      ) : (
        <GlassCard className="p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <HardDrive size={16} className="text-indigo-400" /> Plan Usage
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Gauge label="Seats used" used={data.seatUsage.used} limit={data.seatUsage.limit} unit=" users" />
            <Gauge label="Storage used" used={Math.round((data.storageUsage.usedMB / 1024) * 10) / 10} limit={data.storageUsage.limitGB} unit=" GB" />
          </div>
        </GlassCard>
      )}
    </DashboardLayout>
  );
}
