import { useEffect, useState } from 'react';
import { User, Lock, Award, Download } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Modal from '../../components/ui/Modal';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { updateMyProfile, changeMyPassword, uploadAvatar, getMyCertificates } from '../../api/learnerApi';
import api from '../../api/axios';
import { notify } from '../../lib/toast';

function formatCnic(value) {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  const part1 = digits.slice(0, 5);
  const part2 = digits.slice(5, 12);
  const part3 = digits.slice(12, 13);
  return [part1, part2, part3].filter(Boolean).join('-');
}

/** Normalizes any typed input toward 03XX-XXXXXXX (also accepts a +92 prefix). */
function formatPakPhone(value) {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('92')) digits = '0' + digits.slice(2);
  if (digits && !digits.startsWith('0')) digits = '0' + digits;
  digits = digits.slice(0, 11);
  const part1 = digits.slice(0, 4);
  const part2 = digits.slice(4, 11);
  return [part1, part2].filter(Boolean).join('-');
}

export default function LearnerProfile() {
  const { user, refreshSession } = useAuth();

  const [form, setForm] = useState({ fullName: '', phone: '', cnic: '', address: '' });
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [certificates, setCertificates] = useState([]);
  const [certsLoading, setCertsLoading] = useState(true);
  const [previewCert, setPreviewCert] = useState(null);

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName || '',
        phone: user.phone || '',
        cnic: user.cnic || '',
        address: user.address || '',
      });
      setAvatarUrl(user.avatarUrl || null);
    }
  }, [user]);

  useEffect(() => {
    getMyCertificates()
      .then((res) => setCertificates(res.data.data))
      .catch(() => {})
      .finally(() => setCertsLoading(false));
  }, []);

  const handleAvatarSelect = async (file) => {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const { data } = await uploadAvatar(file);
      setAvatarUrl(data.data.url);
      await updateMyProfile({ avatarUrl: data.data.url });
      await refreshSession(); // syncs AuthContext.user so the new photo shows in the header and survives remounts
      notify.success('Profile picture updated.');
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to upload image.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMyProfile(form);
      await refreshSession();
      notify.success('Profile saved.');
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      notify.error('Both password fields are required.');
      return;
    }
    setChangingPassword(true);
    try {
      await changeMyPassword({ currentPassword, newPassword });
      notify.success('Password changed.');
      setPasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-4 mb-5">
              <div className="relative">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={user?.fullName} className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <User size={24} className="text-primary" />
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-primary underline cursor-pointer">
                  {uploadingAvatar ? 'Uploading…' : 'Change photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarSelect(e.target.files[0])} />
                </label>
                <p className="text-xs text-gray-500 mt-1">{user?.email}</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Full name</label>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Mobile number</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: formatPakPhone(e.target.value) }))}
                    placeholder="03XX-XXXXXXX"
                    maxLength={12}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">CNIC number</label>
                  <input
                    value={form.cnic}
                    onChange={(e) => setForm((f) => ({ ...f, cnic: formatCnic(e.target.value) }))}
                    placeholder="XXXXX-XXXXXXX-X"
                    maxLength={15}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Postal address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary text-white text-sm font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 text-sm font-medium px-4 py-2 hover:bg-gray-100"
                >
                  <Lock size={13} /> Change password
                </button>
              </div>
            </form>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
            <Award size={15} className="text-primary" /> Certificates Vault
          </h2>
          {certsLoading ? (
            <SkeletonList items={2} />
          ) : certificates.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl">
              <EmptyState icon={Award} title="No certificates yet" description="Complete a course 100% to earn your first certificate." />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {certificates.map((c) => (
                <div key={c.courseId} className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{c.courseTitle}</p>
                  <p className="text-xs text-gray-500 mb-3">Issued {new Date(c.issuedAt).toLocaleDateString()}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setPreviewCert(c)} className="text-xs rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-100">
                      Preview
                    </button>
                    <a
                      href={api.defaults.baseURL + '/progress/certificate/' + c.courseId}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs rounded-lg bg-primary text-white px-3 py-1.5 hover:opacity-90"
                    >
                      <Download size={11} /> Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------- Password change modal ---------- */}
      <Modal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Change password"
        onConfirm={handleChangePassword}
        confirmLabel={changingPassword ? 'Saving…' : 'Save'}
        confirmDisabled={changingPassword}
      >
        <div className="space-y-3">
          <input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="password"
            placeholder="New password (min 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </Modal>

      {/* ---------- Certificate PDF preview modal ---------- */}
      <Modal open={!!previewCert} onClose={() => setPreviewCert(null)} title={previewCert?.courseTitle || 'Certificate'}>
        {previewCert && (
          <iframe
            title="Certificate preview"
            src={api.defaults.baseURL + '/progress/certificate/' + previewCert.courseId}
            className="w-full h-[500px] rounded-lg border border-gray-200"
          />
        )}
      </Modal>
    </DashboardLayout>
  );
}
