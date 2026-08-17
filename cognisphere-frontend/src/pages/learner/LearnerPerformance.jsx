import { useEffect, useState } from 'react';
import { Award, Clock, TrendingUp, CheckCircle2, XCircle, BookOpen, PlayCircle } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ProgressBar from '../../components/ui/ProgressBar';
import { Badge } from '../../components/ui/Badge';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { getMyProgressSummary, getCourse } from '../../api/learnerApi';

function MetricCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
      <div className="rounded-lg bg-primary/10 p-2">
        <Icon size={18} className="text-primary" />
      </div>
      <div>
        <p className="text-lg font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function findModuleDef(course, moduleId) {
  return course?.modules?.find((m) => m._id === moduleId) || null;
}

export default function LearnerPerformance() {
  const [summary, setSummary] = useState(null);
  const [courseDetails, setCourseDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    setLoadError('');
    try {
      const { data } = await getMyProgressSummary();
      setSummary(data.data);

      const courseIds = data.data.courses.map((r) => r.courseId?._id).filter(Boolean);
      const details = await Promise.all(
        courseIds.map((id) =>
          getCourse(id)
            .then((res) => [id, res.data.data])
            .catch(() => [id, null])
        )
      );
      setCourseDetails(Object.fromEntries(details.filter(([, v]) => v)));
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Failed to load performance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <DashboardLayout><SkeletonList items={3} /></DashboardLayout>;
  if (loadError || !summary) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <p className="text-red-600 mb-3">{loadError || 'Something went wrong loading your performance data.'}</p>
          <button onClick={load} className="text-sm text-primary hover:underline">
            Try again
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const avgCompletion =
    summary.courses.length > 0
      ? Math.round(summary.courses.reduce((sum, r) => sum + r.overallProgressPercent, 0) / summary.courses.length)
      : 0;

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Performance</h1>
      <p className="text-sm text-gray-500 mb-6">Progress, lesson completion, and quiz results across every course.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard icon={Clock} label="Hours Spent" value={summary.totalHoursSpent} />
        <MetricCard icon={TrendingUp} label="Avg. Completion" value={avgCompletion + '%'} />
        <MetricCard icon={Award} label="Certificates Earned" value={summary.certificatesEarned} />
        <MetricCard icon={BookOpen} label="Courses Enrolled" value={summary.totalEnrolled} />
      </div>

      {summary.courses.length === 0 ? (
        <EmptyState icon={BookOpen} title="No courses yet" description="Enroll in a course from your dashboard to start tracking performance." />
      ) : (
        <div className="space-y-6">
          {summary.courses.map((record) => {
            const course = courseDetails[record.courseId?._id];

            let totalLessons = 0;
            let completedLessons = 0;
            const videoLessons = [];
            const quizRows = [];

            for (const mp of record.modulesProgress) {
              totalLessons += mp.lessonsProgress.length;
              completedLessons += mp.lessonsProgress.filter((l) => l.status === 'completed').length;

              const moduleDef = findModuleDef(course, mp.moduleId);

              for (const lp of mp.lessonsProgress) {
                const lessonDef = moduleDef?.lessons?.find((l) => l._id === lp.lessonId);
                if (lessonDef?.video?.url) {
                  videoLessons.push({
                    title: lessonDef?.title || 'Lesson',
                    status: lp.status,
                    watchedPercent: lp.watchedPercent || 0,
                  });
                }
              }

              for (const attempt of mp.quizAttempts) {
                quizRows.push({
                  moduleTitle: moduleDef?.title || 'Module',
                  attemptNumber: attempt.attemptNumber,
                  scorePercent: attempt.scorePercent,
                  passed: attempt.passed,
                  submittedAt: attempt.submittedAt,
                });
              }
            }

            return (
              <div key={record._id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="font-semibold text-gray-900">{record.courseId?.title}</h2>
                    <p className="text-xs text-gray-500">{record.courseId?.category}</p>
                  </div>
                  <Badge variant={record.status === 'completed' ? 'success' : 'primary'}>{record.status.replace('_', ' ')}</Badge>
                </div>

                <ProgressBar percent={record.overallProgressPercent} className="mb-5" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Lesson Completion</h3>
                    <p className="text-sm text-gray-700 mb-2">
                      {completedLessons} of {totalLessons} lessons completed
                      {totalLessons > completedLessons && ' (' + (totalLessons - completedLessons) + ' remaining)'}
                    </p>
                    {videoLessons.length > 0 && (
                      <div className="space-y-1.5 mt-3">
                        {videoLessons.map((v, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-gray-600">
                              <PlayCircle size={12} className={v.status === 'completed' ? 'text-emerald-500' : 'text-gray-400'} />
                              {v.title}
                            </span>
                            <span className="text-gray-400">{v.status === 'completed' ? 'Watched' : v.watchedPercent + '% watched'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Quiz Performance</h3>
                    {quizRows.length === 0 ? (
                      <p className="text-xs text-gray-400">No quiz attempts yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {quizRows.map((q, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs">
                            <div>
                              <p className="text-gray-700 font-medium">
                                {q.moduleTitle} <span className="text-gray-400 font-normal">· Attempt {q.attemptNumber}</span>
                              </p>
                              <p className="text-gray-400">{new Date(q.submittedAt).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {q.passed ? (
                                <CheckCircle2 size={13} className="text-emerald-500" />
                              ) : (
                                <XCircle size={13} className="text-red-500" />
                              )}
                              <span className={q.passed ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                                {q.scorePercent}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
