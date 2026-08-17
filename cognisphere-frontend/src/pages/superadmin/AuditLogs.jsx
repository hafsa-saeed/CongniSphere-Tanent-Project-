import { useEffect, useState } from 'react';
import { ScrollText, Building2, Megaphone, LogIn, Settings, MessageSquare } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import { SkeletonTable } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { listAuditLogs } from '../../api/superadminApi';
import { notify } from '../../lib/toast';

const ACTION_ICON = {
  'tenant.onboard': Building2,
  'tenant.suspend': Building2,
  'tenant.activate': Building2,
  'tenant.impersonate': LogIn,
  'broadcast.create': Megaphone,
  'broadcast.deactivate': Megaphone,
  'settings.update': Settings,
  'support.reply': MessageSquare,
};

const ACTION_LABEL = {
  'tenant.onboard': 'Onboarded organization',
  'tenant.suspend': 'Suspended organization',
  'tenant.activate': 'Reactivated organization',
  'tenant.impersonate': 'Impersonated tenant admin',
  'broadcast.create': 'Published broadcast',
  'broadcast.deactivate': 'Deactivated broadcast',
  'settings.update': 'Updated global settings',
  'support.reply': 'Replied to support ticket',
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await listAuditLogs({ page, limit: 25 });
      setLogs(data.data.logs);
      setPagination(data.data.pagination);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <DashboardLayout dark>
      <h1 className="text-2xl font-bold text-white mb-1">Audit Logs</h1>
      <p className="text-sm text-zinc-500 mb-6">System activity and security history across the platform.</p>

      <GlassCard className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-400 border-b border-white/10">
              <th className="px-5 py-3 font-medium">Action</th>
              <th className="px-5 py-3 font-medium">Actor</th>
              <th className="px-5 py-3 font-medium">Details</th>
              <th className="px-5 py-3 font-medium">When</th>
            </tr>
          </thead>
          {loading ? (
            <SkeletonTable rows={8} columns={4} />
          ) : (
            <tbody>
              {logs.map((log) => {
                const Icon = ACTION_ICON[log.action] || ScrollText;
                return (
                  <tr key={log._id} className="border-b border-white/5 text-zinc-200">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Icon size={14} className="text-indigo-400" />
                        {ACTION_LABEL[log.action] || log.action}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-zinc-400">
                      {log.actorName} <span className="text-zinc-600">({log.actorRole.replace('_', ' ')})</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-500 max-w-xs truncate">
                      {log.metadata && Object.keys(log.metadata).length > 0 ? JSON.stringify(log.metadata) : '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>

        {!loading && logs.length === 0 && (
          <EmptyState icon={ScrollText} title="No activity yet" description="Actions like suspensions, impersonations, and settings changes will show up here." />
        )}

        {!loading && logs.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 text-xs text-zinc-500">
            <span>
              Page {pagination.page} of {pagination.pages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => load(pagination.page - 1)}
                className="rounded-md border border-zinc-800 px-2.5 py-1 hover:bg-zinc-800 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => load(pagination.page + 1)}
                className="rounded-md border border-zinc-800 px-2.5 py-1 hover:bg-zinc-800 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </GlassCard>
    </DashboardLayout>
  );
}
