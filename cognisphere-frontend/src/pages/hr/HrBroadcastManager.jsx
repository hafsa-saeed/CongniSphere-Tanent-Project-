import { useEffect, useState } from 'react';
import { Megaphone, Send, AlertTriangle, Info } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import Tabs from '../../components/ui/Tabs';
import { Badge } from '../../components/ui/Badge';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { listBroadcastsForHr, createHrBroadcast, deactivateHrBroadcast } from '../../api/hrApi';
import { notify } from '../../lib/toast';

export default function HrBroadcastManager() {
  const [mine, setMine] = useState([]);
  const [fromSuperAdmin, setFromSuperAdmin] = useState([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('info');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await listBroadcastsForHr();
      setMine(data.data.mine);
      setFromSuperAdmin(data.data.fromSuperAdmin);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to load broadcasts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      notify.error('Title and message are required.');
      return;
    }
    setSubmitting(true);
    try {
      await createHrBroadcast({ title, message, priority });
      notify.success('Announcement published to your learners.');
      setTitle('');
      setMessage('');
      setPriority('info');
      load();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to publish announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id) => {
    try {
      await deactivateHrBroadcast(id);
      notify.success('Announcement deactivated.');
      load();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to deactivate.');
    }
  };

  const tabs = [
    {
      id: 'create',
      label: 'Create Announcement',
      icon: Send,
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard className="p-5 h-fit">
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                placeholder="Title (e.g. New Training Released)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <textarea
                placeholder="Message for your learners…"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="info">Info</option>
                <option value="urgent">Urgent</option>
              </select>
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                <Send size={14} /> {submitting ? 'Publishing…' : 'Publish to learners'}
              </button>
            </form>
          </GlassCard>

          <div>
            <h2 className="text-sm font-semibold text-zinc-300 mb-3">Your announcement history</h2>
            {loading ? (
              <SkeletonList items={2} />
            ) : mine.length === 0 ? (
              <GlassCard>
                <EmptyState icon={Megaphone} title="No announcements yet" description="Published announcements to your learners will appear here." />
              </GlassCard>
            ) : (
              <div className="space-y-3">
                {mine.map((b) => (
                  <GlassCard key={b._id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">{b.title}</p>
                          <Badge variant={b.priority === 'urgent' ? 'danger' : 'primary'}>{b.priority}</Badge>
                          {!b.isActive && <Badge variant="neutral">inactive</Badge>}
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">{b.message}</p>
                        <p className="text-[11px] text-zinc-600 mt-2">{new Date(b.createdAt).toLocaleString()}</p>
                      </div>
                      {b.isActive && (
                        <button onClick={() => handleDeactivate(b._id)} className="text-xs text-zinc-500 hover:text-red-400 whitespace-nowrap">
                          Deactivate
                        </button>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'system',
      label: 'System Broadcasts',
      icon: Info,
      content: loading ? (
        <SkeletonList items={2} />
      ) : fromSuperAdmin.length === 0 ? (
        <GlassCard>
          <EmptyState icon={Info} title="No platform announcements" description="Messages from the CogniSphere team will appear here." />
        </GlassCard>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {fromSuperAdmin.map((b) => (
            <GlassCard key={b._id} className="p-4">
              <div className="flex items-start gap-3">
                {b.priority === 'urgent' ? (
                  <AlertTriangle size={16} className="mt-0.5 text-red-400" />
                ) : (
                  <Info size={16} className="mt-0.5 text-indigo-400" />
                )}
                <div>
                  <p className="text-sm font-semibold text-white">{b.title}</p>
                  <p className="text-xs text-zinc-400 mt-1">{b.message}</p>
                  <p className="text-[11px] text-zinc-600 mt-2">{new Date(b.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout dark>
      <h1 className="text-2xl font-bold text-white mb-6">Broadcast Manager</h1>
      <Tabs tabs={tabs} />
    </DashboardLayout>
  );
}
