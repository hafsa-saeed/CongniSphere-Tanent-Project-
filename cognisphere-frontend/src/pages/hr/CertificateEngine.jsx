import { useEffect, useState } from 'react';
import { Award, Save, Download, Users } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import { SkeletonChart, SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { listCourses, getCourse, updateCourse, getIssuedCertificates } from '../../api/hrApi';
import { notify } from '../../lib/toast';

const TOKENS = ['{learner_name}', '{course_name}', '{completion_date}'];

export default function CertificateEngine() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isEnabled, setIsEnabled] = useState(true);
  const [passingRequirement, setPassingRequirement] = useState('all_quizzes_passed');
  const [signatureName, setSignatureName] = useState('');
  const [signatureTitle, setSignatureTitle] = useState('');

  const [issuedCertificates, setIssuedCertificates] = useState([]);
  const [certsLoading, setCertsLoading] = useState(true);

  useEffect(() => {
    listCourses().then((res) => {
      setCourses(res.data.data.courses);
      if (res.data.data.courses.length > 0) setCourseId(res.data.data.courses[0]._id);
      else setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    getCourse(courseId)
      .then((res) => {
        const c = res.data.data;
        setCourse(c);
        setIsEnabled(c.certificate?.isEnabled ?? true);
        setPassingRequirement(c.certificate?.passingRequirement || 'all_quizzes_passed');
        setSignatureName(c.certificate?.signatureName || '');
        setSignatureTitle(c.certificate?.signatureTitle || '');
      })
      .catch((err) => notify.error(err.response?.data?.message || 'Failed to load course.'))
      .finally(() => setLoading(false));

    setCertsLoading(true);
    getIssuedCertificates(courseId)
      .then((res) => setIssuedCertificates(res.data.data))
      .catch((err) => notify.error(err.response?.data?.message || 'Failed to load issued certificates.'))
      .finally(() => setCertsLoading(false));
  }, [courseId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCourse(courseId, {
        certificate: { isEnabled, passingRequirement, signatureName, signatureTitle },
      });
      notify.success('Certificate settings saved.');
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to save certificate settings.');
    } finally {
      setSaving(false);
    }
  };

  const previewName = 'Jane Learner';
  const previewCourse = course?.title || 'Course Title';
  const previewDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <DashboardLayout dark>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Certificate Engine</h1>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {courses.map((c) => (
            <option key={c._id} value={c._id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <SkeletonChart height={360} />
      ) : !course ? (
        <GlassCard className="p-10 text-center text-zinc-500">Create a course first to configure its certificate.</GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Auto-issue on 100% completion</p>
                <p className="text-xs text-zinc-500">When off, learners won't be able to download a certificate for this course.</p>
              </div>
              <button
                onClick={() => setIsEnabled((v) => !v)}
                className={'relative h-6 w-11 shrink-0 rounded-full transition-colors ' + (isEnabled ? 'bg-emerald-500' : 'bg-zinc-700')}
              >
                <span
                  className={'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ' + (isEnabled ? 'translate-x-5' : 'translate-x-0.5')}
                />
              </button>
            </div>

            <div>
              <label className="block text-xs text-zinc-500 mb-1">Completion requirement</label>
              <select
                value={passingRequirement}
                onChange={(e) => setPassingRequirement(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all_quizzes_passed">All quizzes passed</option>
                <option value="all_lessons_complete">All lessons complete</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-500 mb-1">Signature name</label>
              <input
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="e.g. Jane HR"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Signature title</label>
              <input
                value={signatureTitle}
                onChange={(e) => setSignatureTitle(e.target.value)}
                placeholder="e.g. Head of People Operations"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-2">
              <p className="text-xs text-zinc-500 mb-2">Dynamic tokens used automatically at issue time:</p>
              <div className="flex flex-wrap gap-2">
                {TOKENS.map((t) => (
                  <span key={t} className="rounded-md bg-indigo-500/10 px-2 py-1 text-[11px] font-mono text-indigo-300">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              <Save size={14} /> {saving ? 'Saving…' : 'Save certificate settings'}
            </button>
          </GlassCard>

          <GlassCard className="p-6 flex items-center justify-center">
            <div className="w-full aspect-[1.4/1] rounded-lg border-2 border-indigo-500/40 bg-zinc-950 flex flex-col items-center justify-center text-center px-6">
              <Award size={22} className="text-indigo-400 mb-2" />
              <p className="text-[10px] tracking-widest text-indigo-400 uppercase mb-2">Certificate of Completion</p>
              <p className="text-xs text-zinc-500">This certifies that</p>
              <p className="text-lg font-bold text-white my-1">{previewName}</p>
              <p className="text-xs text-zinc-500">has successfully completed</p>
              <p className="text-sm font-semibold text-indigo-300 my-1">{previewCourse}</p>
              <p className="text-[10px] text-zinc-600 mt-3">{previewDate}</p>
              {signatureName && (
                <div className="mt-3 pt-2 border-t border-zinc-800 w-32">
                  <p className="text-[10px] font-semibold text-zinc-300">{signatureName}</p>
                  {signatureTitle && <p className="text-[9px] text-zinc-600">{signatureTitle}</p>}
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {!loading && course && (
        <GlassCard className="p-5 mt-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Users size={16} className="text-indigo-400" /> Issued Certificates
          </h2>
          {certsLoading ? (
            <SkeletonList items={2} />
          ) : issuedCertificates.length === 0 ? (
            <EmptyState
              icon={Award}
              title="No certificates issued yet"
              description="Certificates appear here automatically the moment a learner completes this course."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-white/10 text-xs">
                  <th className="py-2 font-medium">Learner</th>
                  <th className="py-2 font-medium">Department</th>
                  <th className="py-2 font-medium">Certificate Code</th>
                  <th className="py-2 font-medium">Issued</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {issuedCertificates.map((cert) => (
                  <tr key={cert.userId} className="border-b border-white/5 last:border-0 text-zinc-200">
                    <td className="py-2.5">
                      {cert.fullName}
                      <span className="block text-xs text-zinc-500">{cert.email}</span>
                    </td>
                    <td className="py-2.5 text-zinc-400">{cert.department || '—'}</td>
                    <td className="py-2.5 font-mono text-xs text-zinc-400">{cert.certificateCode}</td>
                    <td className="py-2.5 text-zinc-400">{new Date(cert.issuedAt).toLocaleDateString()}</td>
                    <td className="py-2.5 text-right">
                      <a
                        href={cert.certificateUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                      >
                        <Download size={12} /> View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </GlassCard>
      )}
    </DashboardLayout>
  );
}
