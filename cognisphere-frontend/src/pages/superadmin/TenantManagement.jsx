import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  Plus,
  Building2,
  Users,
  BookOpen,
  Mail,
  Phone,
  Power,
  LogIn,
  ArrowUpCircle,
} from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import Drawer from '../../components/ui/Drawer';
import Modal from '../../components/ui/Modal';
import Dropdown from '../../components/ui/Dropdown';
import { Badge } from '../../components/ui/Badge';
import { SkeletonTable } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import {
  getTenants,
  getTenantById,
  suspendTenant,
  activateTenant,
  impersonateTenant,
  updateTenantPlan,
} from '../../api/superadminApi';
import api from '../../api/axios';
import { notify } from '../../lib/toast';

const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || 'localhost';
const FRONTEND_PORT = 3000;

const TIERS = ['trial', 'starter', 'professional', 'enterprise'];

const initialOnboardForm = {
  companyName: '',
  subdomain: '',
  subscriptionTier: 'trial',
  contactName: '',
  contactEmail: '',
};

export default function TenantManagement() {
  const [tenants, setTenants] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Drawer
  const [drawerTenant, setDrawerTenant] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Modals
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [planTarget, setPlanTarget] = useState(null);
  const [newTier, setNewTier] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [onboardForm, setOnboardForm] = useState(initialOnboardForm);
  const [submitting, setSubmitting] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState(null);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (planFilter) params.tier = planFilter;
      const { data } = await getTenants(params);
      setTenants(data.data.tenants);
      setTotal(data.data.pagination.total);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to load organizations.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter, planFilter]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  // ---------- Drawer ----------
  const openDrawer = async (tenantId) => {
    setDrawerLoading(true);
    setDrawerTenant({});
    try {
      const { data } = await getTenantById(tenantId);
      setDrawerTenant(data.data);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to load organization details.');
      setDrawerTenant(null);
    } finally {
      setDrawerLoading(false);
    }
  };

  // ---------- Suspend / Activate ----------
  const handleToggleStatus = async () => {
    if (!suspendTarget) return;
    setSubmitting(true);
    try {
      if (suspendTarget.isActive) {
        await suspendTenant(suspendTarget._id, suspendReason);
        notify.success(`${suspendTarget.companyName} suspended.`);
      } else {
        await activateTenant(suspendTarget._id);
        notify.success(`${suspendTarget.companyName} reactivated.`);
      }
      setSuspendTarget(null);
      setSuspendReason('');
      loadTenants();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Impersonate ----------
  const handleImpersonate = async (tenant) => {
    setImpersonatingId(tenant._id);
    try {
      const { data } = await impersonateTenant(tenant._id);
      const { accessToken, tenant: t, impersonatedUser } = data.data;
      const url = `http://${t.subdomain}.${ROOT_DOMAIN}:${FRONTEND_PORT}/impersonate?token=${encodeURIComponent(accessToken)}`;
      window.open(url, '_blank');
      notify.success(`Opening ${t.companyName} as ${impersonatedUser.fullName}…`);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Impersonation failed.');
    } finally {
      setImpersonatingId(null);
    }
  };

  // ---------- Plan change ----------
  const openPlanModal = (tenant) => {
    setPlanTarget(tenant);
    setNewTier(tenant.subscription.tier);
    setNewPrice(tenant.subscription.pricePerSeat || 0);
  };

  const handlePlanChange = async () => {
    if (!planTarget) return;
    setSubmitting(true);
    try {
      await updateTenantPlan(planTarget._id, {
        subscription: { ...planTarget.subscription, tier: newTier, pricePerSeat: Number(newPrice) },
      });
      notify.success(`${planTarget.companyName}'s plan updated to ${newTier}.`);
      setPlanTarget(null);
      loadTenants();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to update plan.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Onboarding ----------
  const handleOnboard = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post('/tenants', {
        companyName: onboardForm.companyName,
        subdomain: onboardForm.subdomain,
        subscriptionTier: onboardForm.subscriptionTier,
        primaryContact: { name: onboardForm.contactName, email: onboardForm.contactEmail },
      });
      notify.success(`${onboardForm.companyName} onboarded! Temp password: ${data.data.temporaryPassword}`);
      setOnboardForm(initialOnboardForm);
      setOnboardOpen(false);
      loadTenants();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to onboard organization.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <DashboardLayout dark>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Organizations</h1>
          <p className="text-sm text-zinc-500 mt-1">{total} companies on the platform</p>
        </div>
        <button
          onClick={() => setOnboardOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          <Plus size={16} /> Add Organization
        </button>
      </div>

      {/* ---------- Filters ---------- */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search by company name…"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="past_due">Past due</option>
          <option value="canceled">Canceled</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => {
            setPage(1);
            setPlanFilter(e.target.value);
          }}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All plans</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* ---------- Table ---------- */}
      <GlassCard className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-400 border-b border-white/10">
              <th className="px-5 py-3 font-medium">Company</th>
              <th className="px-5 py-3 font-medium">Subdomain</th>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Users</th>
              <th className="px-5 py-3 font-medium w-10"></th>
            </tr>
          </thead>
          {loading ? (
            <SkeletonTable rows={6} columns={6} />
          ) : (
            <tbody>
              {tenants.map((t) => (
                <tr key={t._id} className="border-b border-white/5 text-zinc-200 hover:bg-white/[0.02]">
                  <td className="px-5 py-3 cursor-pointer" onClick={() => openDrawer(t._id)}>
                    {t.companyName}
                  </td>
                  <td className="px-5 py-3 text-zinc-400">{t.subdomain}</td>
                  <td className="px-5 py-3 capitalize">{t.subscription.tier}</td>
                  <td className="px-5 py-3">
                    <Badge variant={t.isActive ? (t.subscription.status === 'active' ? 'success' : 'warning') : 'danger'}>
                      {t.isActive ? t.subscription.status : 'suspended'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    {t.usage?.currentUserCount || 0}
                    {t.limits.maxUsers !== -1 && ` / ${t.limits.maxUsers}`}
                  </td>
                  <td className="px-5 py-3">
                    <Dropdown
                      items={[
                        {
                          label: t.isActive ? 'Suspend organization' : 'Reactivate organization',
                          icon: Power,
                          tone: t.isActive ? 'danger' : undefined,
                          onClick: () => setSuspendTarget(t),
                        },
                        {
                          label: impersonatingId === t._id ? 'Opening…' : 'Login as tenant',
                          icon: LogIn,
                          onClick: () => handleImpersonate(t),
                        },
                        {
                          label: 'Upgrade / downgrade plan',
                          icon: ArrowUpCircle,
                          onClick: () => openPlanModal(t),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>

        {!loading && tenants.length === 0 && (
          <EmptyState icon={Building2} title="No organizations found" description="Try adjusting your search or filters, or onboard a new company." />
        )}

        {!loading && tenants.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 text-xs text-zinc-500">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border border-zinc-800 px-2.5 py-1 hover:bg-zinc-800 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-zinc-800 px-2.5 py-1 hover:bg-zinc-800 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* ---------- Organization Profile Drawer ---------- */}
      <Drawer open={!!drawerTenant} onClose={() => setDrawerTenant(null)} title="Organization Profile">
        {drawerLoading || !drawerTenant?.companyName ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-5 w-40 bg-zinc-800 rounded" />
            <div className="h-4 w-56 bg-zinc-800 rounded" />
            <div className="h-24 w-full bg-zinc-800 rounded" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-semibold text-white">{drawerTenant.companyName}</h4>
              <p className="text-xs text-zinc-500">{drawerTenant.subdomain}.cognisphere.com</p>
              <div className="mt-2 flex gap-2">
                <Badge variant={drawerTenant.isActive ? 'success' : 'danger'}>
                  {drawerTenant.isActive ? 'Active' : 'Suspended'}
                </Badge>
                <Badge variant="primary">{drawerTenant.subscription.tier}</Badge>
              </div>
            </div>

            <div>
              <h5 className="text-xs font-semibold uppercase text-zinc-500 mb-2">HR Contact</h5>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-1.5">
                <p className="text-sm text-zinc-200">{drawerTenant.primaryContact?.name || '—'}</p>
                <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <Mail size={12} /> {drawerTenant.primaryContact?.email || '—'}
                </p>
                {drawerTenant.primaryContact?.phone && (
                  <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <Phone size={12} /> {drawerTenant.primaryContact.phone}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                  <Users size={12} /> User Quota
                </div>
                <p className="text-sm font-semibold text-white">
                  {drawerTenant.usage?.currentUserCount || 0}
                  {drawerTenant.limits.maxUsers !== -1 && ` / ${drawerTenant.limits.maxUsers}`}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                  <BookOpen size={12} /> Courses
                </div>
                <p className="text-sm font-semibold text-white">{drawerTenant.usage?.currentCourseCount || 0}</p>
              </div>
            </div>

            <div>
              <h5 className="text-xs font-semibold uppercase text-zinc-500 mb-2">Billing</h5>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-zinc-400 space-y-1">
                <p>Billing cycle: {drawerTenant.subscription.billingCycle}</p>
                <p>Price per seat: Rs. {drawerTenant.subscription.pricePerSeat || 0}</p>
                <p>Status: {drawerTenant.subscription.status}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setSuspendTarget(drawerTenant);
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium ${
                  drawerTenant.isActive ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                }`}
              >
                {drawerTenant.isActive ? 'Suspend' : 'Reactivate'}
              </button>
              <button
                onClick={() => handleImpersonate(drawerTenant)}
                className="flex-1 rounded-lg bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20"
              >
                Login as tenant
              </button>
            </div>
          </div>
        )}
      </Drawer>

      {/* ---------- Suspend/Activate confirm modal ---------- */}
      <Modal
        open={!!suspendTarget}
        onClose={() => {
          setSuspendTarget(null);
          setSuspendReason('');
        }}
        title={suspendTarget?.isActive ? 'Suspend organization' : 'Reactivate organization'}
        onConfirm={handleToggleStatus}
        confirmLabel={suspendTarget?.isActive ? 'Suspend' : 'Reactivate'}
        tone={suspendTarget?.isActive ? 'danger' : 'primary'}
        confirmDisabled={submitting}
      >
        {suspendTarget?.isActive ? (
          <>
            <p className="mb-3">
              This will immediately block all users at <strong>{suspendTarget?.companyName}</strong> from logging in.
            </p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={2}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </>
        ) : (
          <p>
            This will restore access for all users at <strong>{suspendTarget?.companyName}</strong>.
          </p>
        )}
      </Modal>

      {/* ---------- Plan change modal ---------- */}
      <Modal
        open={!!planTarget}
        onClose={() => setPlanTarget(null)}
        title={`Change plan — ${planTarget?.companyName || ''}`}
        onConfirm={handlePlanChange}
        confirmLabel="Save changes"
        confirmDisabled={submitting}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Subscription tier</label>
            <select
              value={newTier}
              onChange={(e) => setNewTier(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Price per seat (Rs.)</label>
            <input
              type="number"
              min={0}
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </Modal>

      {/* ---------- Onboard new organization modal ---------- */}
      <Modal open={onboardOpen} onClose={() => setOnboardOpen(false)} title="Add organization">
        <form onSubmit={handleOnboard} className="space-y-3">
          <input
            required
            placeholder="Company name"
            value={onboardForm.companyName}
            onChange={(e) => setOnboardForm((f) => ({ ...f, companyName: e.target.value }))}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            required
            placeholder="Subdomain (e.g. acme)"
            value={onboardForm.subdomain}
            onChange={(e) => setOnboardForm((f) => ({ ...f, subdomain: e.target.value }))}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            required
            placeholder="HR contact name"
            value={onboardForm.contactName}
            onChange={(e) => setOnboardForm((f) => ({ ...f, contactName: e.target.value }))}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            required
            type="email"
            placeholder="HR contact email"
            value={onboardForm.contactEmail}
            onChange={(e) => setOnboardForm((f) => ({ ...f, contactEmail: e.target.value }))}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={onboardForm.subscriptionTier}
            onChange={(e) => setOnboardForm((f) => ({ ...f, subscriptionTier: e.target.value }))}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? 'Onboarding…' : 'Onboard organization'}
          </button>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
