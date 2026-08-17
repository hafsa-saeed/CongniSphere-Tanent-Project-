import { useEffect, useState } from 'react';
import { Download, BarChart3, CheckCircle2, XCircle } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import Drawer from '../../components/ui/Drawer';
import { Badge } from '../../components/ui/Badge';
import { SkeletonTable } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { listCourses, getCourseAnalytics, getLearnerCourseDetail } from '../../api/hrApi';
import { notify } from '../../lib/toast';

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => '"' + String(cell == null ? '' : cell).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LearnerResultsVault() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const [drawerLearner, setDrawerLearner] = useState(null);
  const [drawerDetail, setDrawerDetail] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  useEffect(() => {
    listCourses().then((res) => {
      setCourses(res.data.data.courses);
      if (res.data.data.courses.length > 0) setCourseId(res.data.data.courses[0]._id);
    });
  }, []);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    getCourseAnalytics(courseId)
      .then((res) => setAnalytics(res.data.data))
      .catch((err) => notify.error(err.response?.data?.message || 'Failed to load results.'))
      .finally(() => setLoading(false));
  }, [courseId]);

  const openLearnerDetail = async (learner) => {
    setDrawerLearner(learner);
    setDrawerLoading(true);
    try {
      const { data } = await getLearnerCourseDetail(learner.userId, courseId);
      setDrawerDetail(data.data);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to load learner detail.');
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (!analytics) return;
    const rows = [
      ['Name', 'Department', 'Status', 'Progress %', 'Time Spent (min)'],
      ...analytics.learnerActivity.map((l) => [
        l.fullName,
        l.department || '',
        l.status,
        l.overallProgressPercent,
        Math.round((l.totalTimeSpentSeconds || 0) / 60),
      ]),
    ];
    downloadCsv(analytics.courseTitle.replace(/\s+/g, '-') + '-results.csv', rows);
    notify.success('CSV exported.');
  };

  return (
    <DashboardLayout dark>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Learner Results &amp; Vault</h1>
        <div className="flex items-center gap-3">
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
          <button
            onClick={handleExportCsv}
            disabled={!analytics}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {loading || !analytics ? (
        <SkeletonTable rows={6} columns={5} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <GlassCard className="p-4">
              <p className="text-xs text-zinc-500">Enrolled</p>
              <p className="text-xl font-bold text-white">{analytics.totalEnrolled}</p>
            </GlassCard>
            <GlassCard className="p-4">
              <p className="text-xs text-zinc-500">Completed</p>
              <p className="text-xl font-bold text-white">{analytics.totalCompleted}</p>
            </GlassCard>
            <GlassCard className="p-4">
              <p className="text-xs text-zinc-500">Quiz Pass Rate</p>
              <p className="text-xl font-bold text-white">{analytics.quizPassRatePercent}%</p>
            </GlassCard>
          </div>

          <GlassCard className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-400 border-b border-white/10">
                  <th className="px-5 py-3 font-medium">Learner</th>
                  <th className="px-5 py-3 font-medium">Department</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Progress</th>
                </tr>
              </thead>
              <tbody>
                {analytics.learnerActivity.map((l) => (
                  <tr
                    key={l.userId}
                    onClick={() => openLearnerDetail(l)}
                    className="border-b border-white/5 text-zinc-200 hover:bg-white/[0.03] cursor-pointer"
                  >
                    <td className="px-5 py-3">{l.fullName}</td>
                    <td className="px-5 py-3 text-zinc-400">{l.department || '—'}</td>
                    <td className="px-5 py-3">
                      <Badge variant={l.status === 'completed' ? 'success' : 'primary'}>{l.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-5 py-3">{l.overallProgressPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {analytics.learnerActivity.length === 0 && (
              <EmptyState icon={BarChart3} title="No learners enrolled yet" description="Results will appear here once employees start this course." />
            )}
          </GlassCard>
        </>
      )}

      {/* ---------- Learner detail drawer ---------- */}
      <Drawer
        open={!!drawerLearner}
        onClose={() => {
          setDrawerLearner(null);
          setDrawerDetail(null);
        }}
        title={drawerLearner?.fullName || 'Learner Detail'}
      >
        {drawerLoading || !drawerDetail ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-5 w-40 bg-zinc-800 rounded" />
            <div className="h-24 w-full bg-zinc-800 rounded" />
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-sm text-zinc-200">{drawerDetail.learner.email}</p>
              <p className="text-xs text-zinc-500">
                {drawerDetail.learner.department || 'No department'} · {drawerDetail.learner.jobTitle || '—'}
              </p>
            </div>

            <div>
              <h5 className="text-xs font-semibold uppercase text-zinc-500 mb-2">Overall Progress</h5>
              <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full rounded-full bg-indigo-500" style={{ width: drawerDetail.progress.overallProgressPercent + '%' }} />
              </div>
              <p className="text-xs text-zinc-500 mt-1">{drawerDetail.progress.overallProgressPercent}% complete</p>
            </div>

            <div>
              <h5 className="text-xs font-semibold uppercase text-zinc-500 mb-2">Quiz Attempts</h5>
              <div className="space-y-2">
                {drawerDetail.progress.modulesProgress.flatMap((mod) =>
                  mod.quizAttempts.map((attempt) => (
                    <div key={attempt._id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-zinc-400">Attempt #{attempt.attemptNumber}</span>
                        <span className="flex items-center gap-1 text-xs font-medium">
                          {attempt.passed ? (
                            <>
                              <CheckCircle2 size={12} className="text-emerald-400" /> <span className="text-emerald-400">Passed</span>
                            </>
                          ) : (
                            <>
                              <XCircle size={12} className="text-red-400" /> <span className="text-red-400">Failed</span>
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-sm text-white">{attempt.scorePercent}% score</p>
                      <p className="text-[11px] text-zinc-600 mt-1">{new Date(attempt.submittedAt).toLocaleString()}</p>
                    </div>
                  ))
                )}
                {drawerDetail.progress.modulesProgress.every((m) => m.quizAttempts.length === 0) && (
                  <p className="text-xs text-zinc-500">No quiz attempts yet.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </DashboardLayout>
  );
}
