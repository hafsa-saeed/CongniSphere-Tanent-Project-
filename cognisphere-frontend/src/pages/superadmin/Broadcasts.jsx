import { useEffect, useState } from 'react';
import { Megaphone, Send, AlertTriangle, Info } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import { Badge } from '../../components/ui/Badge';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { listBroadcasts, createBroadcast, deactivateBroadcast, getTenants } from '../../api/superadminApi';
import { notify } from '../../lib/toast';

const initialForm = { title: '', message: '', priority: 'info', targetAudience: 'all', tenantId: '' };

export default function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [broadcastsRes, tenantsRes] = await Promise.all([listBroadcasts(), getTenants({ limit: 100 })]);
      setBroadcasts(broadcastsRes.data.data);
      setTenants(tenantsRes.data.data.tenants);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to load broadcasts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) {
      notify.error('Title and message are required.');
      return;
    }
    setSubmitting(true);
    try {
      await createBroadcast({
        title: form.title,
        message: form.message,
        priority: form.priority,
        targetAudience: form.targetAudience,
        tenantId: form.tenantId || undefined,
      });
      notify.success('Broadcast published.');
      setForm(initialForm);
      load();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to publish broadcast.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id) => {
    try {
      await deactivateBroadcast(id);
      notify.success('Broadcast deactivated.');
      load();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to deactivate broadcast.');
    }
  };

  const active = broadcasts.filter((b) => b.isActive);
  const past = broadcasts.filter((b) => !b.isActive);

  return (
    <DashboardLayout dark>
      <h1 className="text-2xl font-bold text-white mb-6">System Broadcasts</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ---------- Create form ---------- */}
        <GlassCard className="p-5 lg:col-span-1 h-fit">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Megaphone size={16} className="text-indigo-400" /> New Broadcast
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              placeholder="Title (e.g. Scheduled Maintenance)"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <textarea
              placeholder="Message shown to affected users…"
              rows={3}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <div>
              <label className="block text-xs text-zinc-500 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="info">Info</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-500 mb-1">Audience</label>
              <select
                value={form.targetAudience}
                onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All (HR admins + Learners)</option>
                <option value="hr_only">HR admins only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-500 mb-1">Scope (optional)</label>
              <select
                value={form.tenantId}
                onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Global — every tenant</option>
                {tenants.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.companyName} only
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              <Send size={14} /> {submitting ? 'Publishing…' : 'Publish broadcast'}
            </button>
          </form>
        </GlassCard>

        {/* ---------- History ---------- */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="font-semibold text-white mb-3">Active Broadcasts</h2>
            {loading ? (
              <SkeletonList items={2} />
            ) : active.length === 0 ? (
              <GlassCard>
                <EmptyState icon={Megaphone} title="No active broadcasts" description="Published announcements will appear here." />
              </GlassCard>
            ) : (
              <div className="space-y-3">
                {active.map((b) => (
                  <GlassCard key={b._id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {b.priority === 'urgent' ? (
                          <AlertTriangle size={16} className="mt-0.5 text-red-400" />
                        ) : (
                          <Info size={16} className="mt-0.5 text-zinc-400" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-white">{b.title}</p>
                            <Badge variant={b.priority === 'urgent' ? 'danger' : 'primary'}>{b.priority}</Badge>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1">{b.message}</p>
                          <p className="text-[11px] text-zinc-600 mt-2">
                            Audience: {b.targetAudience.replace('_', ' ')}
                            {b.tenantId?.companyName ? ' — ' + b.tenantId.companyName : ' — all tenants'}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => handleDeactivate(b._id)} className="text-xs text-zinc-500 hover:text-red-400 whitespace-nowrap">
                        Deactivate
                      </button>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-semibold text-white mb-3">Past Broadcasts</h2>
            {!loading && past.length === 0 ? (
              <p className="text-sm text-zinc-500">No past broadcasts.</p>
            ) : (
              <div className="space-y-2">
                {past.map((b) => (
                  <div key={b._id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 opacity-60">
                    <p className="text-sm text-zinc-300">{b.title}</p>
                    <p className="text-xs text-zinc-500">{new Date(b.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
