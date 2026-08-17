import { useEffect, useState } from 'react';
import { Inbox, UserPlus, Check, X, Building2, Copy } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import Modal from '../../components/ui/Modal';
import Tabs from '../../components/ui/Tabs';
import { Badge } from '../../components/ui/Badge';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import {
  listSupportTickets,
  replyToTicket,
  listOnboardingRequests,
  approveOnboardingRequest,
  rejectOnboardingRequest,
} from '../../api/superadminApi';
import { notify } from '../../lib/toast';

const STATUS_VARIANT = { pending: 'warning', investigating: 'primary', resolved: 'success' };

function ExistingTenantsTab() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
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

  const handleReply = async () => {
    if (!replyMessage.trim()) {
      notify.error('Reply message is required.');
      return;
    }
    setSubmitting(true);
    try {
      await replyToTicket(activeTicket._id, { message: replyMessage, status: 'investigating' });
      notify.success('Reply sent.');
      setActiveTicket(null);
      setReplyMessage('');
      load();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to send reply.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <SkeletonList items={3} />;
  if (tickets.length === 0) {
    return (
      <GlassCard>
        <EmptyState icon={Inbox} title="No support messages" description="Queries from onboarded HR admins will appear here." />
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      {tickets.map((t) => (
        <GlassCard key={t._id} className="p-4 cursor-pointer" onClick={() => setActiveTicket(t)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">{t.subject}</p>
              <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-1">
                <Building2 size={11} /> {t.tenantId?.companyName || 'Unknown company'} · {t.submitterName}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[t.status]}>{t.status}</Badge>
          </div>
        </GlassCard>
      ))}

      <Modal open={!!activeTicket} onClose={() => setActiveTicket(null)} title={activeTicket?.subject || ''}>
        {activeTicket && (
          <div className="space-y-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs text-zinc-500 mb-1">From {activeTicket.submitterName}</p>
              <p className="text-sm text-zinc-200">{activeTicket.message}</p>
            </div>
            <textarea
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder="Write a reply…"
              rows={3}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleReply}
              disabled={submitting}
              className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Send reply'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function OnboardingRequestsTab() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approveTarget, setApproveTarget] = useState(null);
  const [subdomain, setSubdomain] = useState('');
  const [tier, setTier] = useState('trial');
  const [initialPassword, setInitialPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [credentialsSummary, setCredentialsSummary] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await listOnboardingRequests();
      setRequests(data.data);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to load onboarding requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generateSuggestedPassword = () => `Welcome${Math.random().toString(36).slice(-8)}!`;

  const openApprove = (req) => {
    setApproveTarget(req);
    setSubdomain(req.companyName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20));
    setTier('trial');
    setInitialPassword(generateSuggestedPassword());
  };

  const handleApprove = async () => {
    if (!subdomain.trim()) {
      notify.error('Subdomain is required.');
      return;
    }
    if (initialPassword && initialPassword.length < 8) {
      notify.error('Initial password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await approveOnboardingRequest(approveTarget._id, {
        subdomain,
        subscriptionTier: tier,
        initialPassword: initialPassword || undefined,
      });
      setApproveTarget(null);
      setCredentialsSummary({
        companyName: data.data.tenant.companyName,
        subdomain: data.data.tenant.subdomain,
        hrEmail: data.data.hrAdmin.email,
        password: data.data.temporaryPassword,
      });
      load();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to approve request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (id) => {
    try {
      await rejectOnboardingRequest(id);
      notify.success('Request rejected.');
      load();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to reject request.');
    }
  };

  if (loading) return <SkeletonList items={3} />;

  const pending = requests.filter((r) => r.status === 'pending');
  const reviewed = requests.filter((r) => r.status !== 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Pending Requests</h3>
        {pending.length === 0 ? (
          <GlassCard>
            <EmptyState icon={UserPlus} title="No pending requests" description="New company signups from the Landing Page will appear here." />
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <GlassCard key={r._id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{r.companyName}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {r.contactName} · {r.contactEmail} {r.contactPhone && '· ' + r.contactPhone}
                    </p>
                    {r.message && <p className="text-xs text-zinc-400 mt-1.5">{r.message}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openApprove(r)}
                      className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20"
                    >
                      <Check size={12} /> Approve &amp; Onboard
                    </button>
                    <button
                      onClick={() => handleReject(r._id)}
                      className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20"
                    >
                      <X size={12} /> Reject
                    </button>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {reviewed.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Reviewed</h3>
          <div className="space-y-2">
            {reviewed.map((r) => (
              <div key={r._id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 flex items-center justify-between opacity-70">
                <p className="text-sm text-zinc-300">{r.companyName}</p>
                <Badge variant={r.status === 'approved' ? 'success' : 'danger'}>{r.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        title={'Onboard — ' + (approveTarget?.companyName || '')}
        onConfirm={handleApprove}
        confirmLabel={submitting ? 'Onboarding…' : 'Approve & Onboard'}
        confirmDisabled={submitting}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Subdomain / Company Code</label>
            <input
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Subscription tier</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="trial">Trial</option>
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-zinc-500">Initial Password</label>
              <button
                type="button"
                onClick={() => setInitialPassword(generateSuggestedPassword())}
                className="text-[11px] text-indigo-400 hover:text-indigo-300"
              >
                Generate new
              </button>
            </div>
            <input
              value={initialPassword}
              onChange={(e) => setInitialPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-zinc-600 mt-1">Shared with the HR admin below once onboarding completes.</p>
          </div>
        </div>
      </Modal>

      {/* ---------- Credentials Summary Box ---------- */}
      <Modal open={!!credentialsSummary} onClose={() => setCredentialsSummary(null)} title="Onboarding Complete">
        {credentialsSummary && <CredentialsSummary summary={credentialsSummary} />}
      </Modal>
    </div>
  );
}

function CredentialsSummary({ summary }) {
  const [copied, setCopied] = useState(false);

  const credentialsText = `Company: ${summary.companyName}\nSubdomain: ${summary.subdomain}\nHR Email: ${summary.hrEmail}\nInitial Password: ${summary.password}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(credentialsText);
      setCopied(true);
      notify.success('Credentials copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error('Could not copy — clipboard access was denied.');
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-300">
        <span className="font-semibold text-white">{summary.companyName}</span> has been onboarded. Share these
        credentials with the HR admin securely — they won't be shown again.
      </p>
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-2 font-mono text-xs">
        <div className="flex justify-between">
          <span className="text-zinc-500">Subdomain</span>
          <span className="text-zinc-200">{summary.subdomain}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">HR Email</span>
          <span className="text-zinc-200">{summary.hrEmail}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Initial Password</span>
          <span className="text-zinc-200">{summary.password}</span>
        </div>
      </div>
      <button
        onClick={handleCopy}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
      >
        <Copy size={14} /> {copied ? 'Copied!' : 'Copy Login Credentials'}
      </button>
    </div>
  );
}

export default function SuperAdminContactManager() {
  const tabs = [
    { id: 'tenants', label: 'Existing Tenants', icon: Inbox, content: <ExistingTenantsTab /> },
    { id: 'onboarding', label: 'Onboarding Requests', icon: UserPlus, content: <OnboardingRequestsTab /> },
  ];

  return (
    <DashboardLayout dark>
      <h1 className="text-2xl font-bold text-white mb-6">Contact Request Manager</h1>
      <Tabs tabs={tabs} />
    </DashboardLayout>
  );
}
