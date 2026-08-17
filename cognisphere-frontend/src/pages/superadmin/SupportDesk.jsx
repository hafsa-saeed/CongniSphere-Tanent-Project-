import { useEffect, useState } from 'react';
import { Inbox, Building2, Send } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import Modal from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { listSupportTickets, replyToTicket } from '../../api/superadminApi';
import { notify } from '../../lib/toast';

const STATUS_VARIANT = { pending: 'warning', investigating: 'primary', resolved: 'success' };
const STATUS_LABEL = { pending: 'Pending', investigating: 'Investigating', resolved: 'Resolved' };
const COLUMNS = ['pending', 'investigating', 'resolved'];

export default function SupportDesk() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyStatus, setReplyStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await listSupportTickets();
      setTickets(data.data);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to load support tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openTicket = (ticket) => {
    setActiveTicket(ticket);
    setReplyMessage('');
    setReplyStatus(ticket.status);
  };

  const handleReply = async () => {
    if (!replyMessage.trim()) {
      notify.error('Reply message is required.');
      return;
    }
    setSubmitting(true);
    try {
      await replyToTicket(activeTicket._id, { message: replyMessage, status: replyStatus });
      notify.success('Reply sent.');
      setActiveTicket(null);
      load();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to send reply.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout dark>
      <h1 className="text-2xl font-bold text-white mb-1">Support Desk</h1>
      <p className="text-sm text-zinc-500 mb-6">Queries submitted by tenant HR admins across the platform.</p>

      {loading ? (
        <SkeletonList items={4} />
      ) : tickets.length === 0 ? (
        <GlassCard>
          <EmptyState icon={Inbox} title="No pending support tickets!" description="You're all caught up — new tenant queries will appear here." />
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((status) => {
            const columnTickets = tickets.filter((t) => t.status === status);
            return (
              <div key={status}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-zinc-300">{STATUS_LABEL[status]}</h2>
                  <Badge variant={STATUS_VARIANT[status]}>{columnTickets.length}</Badge>
                </div>
                <div className="space-y-3">
                  {columnTickets.map((t) => (
                    <button
                      key={t._id}
                      onClick={() => openTicket(t)}
                      className="w-full text-left rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-4 hover:bg-white/[0.07] transition-colors"
                    >
                      <p className="text-sm font-medium text-white line-clamp-1">{t.subject}</p>
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{t.message}</p>
                      <div className="flex items-center gap-1.5 mt-3 text-[11px] text-zinc-500">
                        <Building2 size={11} />
                        {t.tenantId?.companyName || 'Unknown company'}
                      </div>
                      <p className="text-[11px] text-zinc-600 mt-1">{new Date(t.createdAt).toLocaleDateString()}</p>
                    </button>
                  ))}
                  {columnTickets.length === 0 && <p className="text-xs text-zinc-600 px-1">Nothing here.</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------- Ticket detail / reply modal ---------- */}
      <Modal open={!!activeTicket} onClose={() => setActiveTicket(null)} title={activeTicket?.subject || ''}>
        {activeTicket && (
          <div className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs text-zinc-500 mb-1">
                From {activeTicket.submitterName} · {activeTicket.tenantId?.companyName}
              </p>
              <p className="text-sm text-zinc-200">{activeTicket.message}</p>
            </div>

            {activeTicket.notes?.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {activeTicket.notes.map((n) => (
                  <div key={n._id} className="rounded-lg bg-zinc-800/60 p-2.5">
                    <p className="text-xs text-zinc-500 mb-0.5">
                      {n.authorName} ({n.authorRole.replace('_', ' ')})
                    </p>
                    <p className="text-sm text-zinc-200">{n.message}</p>
                  </div>
                ))}
              </div>
            )}

            <textarea
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder="Write a reply…"
              rows={3}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <div className="flex items-center gap-3">
              <select
                value={replyStatus}
                onChange={(e) => setReplyStatus(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {COLUMNS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <button
                onClick={handleReply}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                <Send size={14} /> {submitting ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
