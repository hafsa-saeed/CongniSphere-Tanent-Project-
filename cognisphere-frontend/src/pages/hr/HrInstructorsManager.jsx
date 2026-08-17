import { useEffect, useState } from 'react';
import { Users, Plus, Pencil, Trash2, X, User as UserIcon } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import Modal from '../../components/ui/Modal';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { listInstructors, createInstructor, updateInstructor, deleteInstructor, uploadFile } from '../../api/hrApi';
import { notify } from '../../lib/toast';

const initialForm = {
  fullName: '',
  title: '',
  bio: '',
  industryExperience: '',
  academicBackground: '',
  avatarUrl: '',
  skills: [],
};

export default function HrInstructorsManager() {
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [newSkill, setNewSkill] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await listInstructors();
      setInstructors(data.data);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to load instructors.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm);
    setFormOpen(true);
  };

  const openEdit = (inst) => {
    setEditingId(inst._id);
    setForm({
      fullName: inst.fullName || '',
      title: inst.title || '',
      bio: inst.bio || '',
      industryExperience: inst.industryExperience || '',
      academicBackground: inst.academicBackground || '',
      avatarUrl: inst.avatarUrl || '',
      skills: inst.skills || [],
    });
    setFormOpen(true);
  };

  const handleAvatarUpload = async (file) => {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const { data } = await uploadFile('image', file);
      setForm((f) => ({ ...f, avatarUrl: data.data.url }));
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to upload photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const addSkill = () => {
    if (!newSkill.trim()) return;
    setForm((f) => ({ ...f, skills: [...f.skills, newSkill.trim()] }));
    setNewSkill('');
  };

  const removeSkill = (index) => setForm((f) => ({ ...f, skills: f.skills.filter((_, i) => i !== index) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) {
      notify.error('Name is required.');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await updateInstructor(editingId, form);
        notify.success('Instructor updated.');
      } else {
        await createInstructor(form);
        notify.success('Instructor added.');
      }
      setFormOpen(false);
      load();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to save instructor.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteInstructor(deleteTarget._id);
      notify.success('Instructor deleted.');
      setDeleteTarget(null);
      load();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to delete instructor.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout dark>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Instructors</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage the trainers shown on your Learner Instructor Directory.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          <Plus size={16} /> Add Instructor
        </button>
      </div>

      {loading ? (
        <SkeletonList items={3} />
      ) : instructors.length === 0 ? (
        <GlassCard>
          <EmptyState icon={Users} title="No instructors yet" description="Add your first trainer to have them appear in the Learner Instructor Directory." />
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {instructors.map((inst) => (
            <GlassCard key={inst._id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {inst.avatarUrl ? (
                    <img src={inst.avatarUrl} alt={inst.fullName} className="h-11 w-11 rounded-full object-cover" />
                  ) : (
                    <div className="h-11 w-11 rounded-full bg-indigo-500/10 flex items-center justify-center">
                      <UserIcon size={18} className="text-indigo-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-white">{inst.fullName}</p>
                    <p className="text-xs text-zinc-500">{inst.title}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(inst)} className="text-zinc-500 hover:text-indigo-400 p-1">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setDeleteTarget(inst)} className="text-zinc-500 hover:text-red-400 p-1">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {inst.bio && <p className="text-xs text-zinc-400 line-clamp-2 mb-2">{inst.bio}</p>}
              {inst.skills?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {inst.skills.slice(0, 4).map((s, i) => (
                    <span key={i} className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400">
                      {s}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-indigo-400 mt-2">{inst.coursesTaught?.length || 0} course(s) taught</p>
            </GlassCard>
          ))}
        </div>
      )}

      {/* ---------- Add/Edit modal ---------- */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? 'Edit Instructor' : 'Add Instructor'}>
        <form onSubmit={handleSubmit} className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          <div className="flex items-center gap-3">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-zinc-800 flex items-center justify-center">
                <UserIcon size={20} className="text-zinc-500" />
              </div>
            )}
            <label className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer">
              {uploadingAvatar ? 'Uploading…' : 'Upload photo'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarUpload(e.target.files[0])} />
            </label>
          </div>

          <input
            placeholder="Full name"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            placeholder="Designation (e.g. Senior Compliance Trainer)"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <textarea
            placeholder="Bio"
            rows={3}
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            placeholder="Experience (e.g. 12+ years in enterprise L&D)"
            value={form.industryExperience}
            onChange={(e) => setForm((f) => ({ ...f, industryExperience: e.target.value }))}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            placeholder="Academic background"
            value={form.academicBackground}
            onChange={(e) => setForm((f) => ({ ...f, academicBackground: e.target.value }))}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Skills</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.skills.map((s, i) => (
                <span key={i} className="flex items-center gap-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-xs text-indigo-300">
                  {s}
                  <button type="button" onClick={() => removeSkill(i)} className="hover:text-red-400">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="e.g. Leadership"
                className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button type="button" onClick={addSkill} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800">
                Add
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Add instructor'}
          </button>
        </form>
      </Modal>

      {/* ---------- Delete confirm ---------- */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete instructor"
        onConfirm={handleDelete}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        tone="danger"
        confirmDisabled={deleting}
      >
        <p>
          Delete <strong>{deleteTarget?.fullName}</strong>? This can't be undone. If they're assigned to any
          course, unassign them first.
        </p>
      </Modal>
    </DashboardLayout>
  );
}
