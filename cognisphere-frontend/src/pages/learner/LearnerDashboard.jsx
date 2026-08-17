import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, Award, Clock, PlayCircle } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ProgressBar from '../../components/ui/ProgressBar';
import { Badge } from '../../components/ui/Badge';
import AnnouncementCarousel from '../../components/AnnouncementCarousel';
import { listCourses, getMyProgressSummary, enrollInCourse, getActiveBroadcasts } from '../../api/learnerApi';
import { notify } from '../../lib/toast';

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

export default function LearnerDashboard() {
  const [summary, setSummary] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [enrollingId, setEnrollingId] = useState(null);

  const load = async () => {
    setLoadError('');
    try {
      const [summaryRes, catalogRes, broadcastsRes] = await Promise.all([
        getMyProgressSummary(),
        listCourses(),
        getActiveBroadcasts(),
      ]);
      setSummary(summaryRes.data.data);
      setCatalog(catalogRes.data.data.courses);
      setBroadcasts(broadcastsRes.data.data);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Failed to load your dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const enrolledIds = new Set((summary?.courses || []).map((c) => c.courseId?._id));
  const browsable = catalog.filter((c) => !enrolledIds.has(c._id));

  const handleEnroll = async (courseId) => {
    setEnrollingId(courseId);
    try {
      await enrollInCourse(courseId);
      await load();
      notify.success('Enrolled successfully.');
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to enroll.');
    } finally {
      setEnrollingId(null);
    }
  };

  if (loading) return <DashboardLayout><p className="text-gray-500">Loading your learning…</p></DashboardLayout>;
  if (loadError || !summary) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <p className="text-red-600 mb-3">{loadError || 'Something went wrong loading your dashboard.'}</p>
          <button onClick={load} className="text-sm text-primary hover:underline">
            Try again
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AnnouncementCarousel broadcasts={broadcasts} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={BookOpen} label="Total Enrolled" value={summary.totalEnrolled} />
          <MetricCard icon={CheckCircle2} label="Completed Courses" value={summary.completed} />
          <MetricCard icon={Award} label="Certificates Earned" value={summary.certificatesEarned} />
          <MetricCard icon={Clock} label="Hours Spent" value={summary.totalHoursSpent} />
        </div>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Continue Learning</h2>
          {summary.courses.length === 0 && (
            <p className="text-sm text-gray-500">You're not enrolled in any courses yet — browse the catalog below.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.courses.map((record) => (
              <div key={record._id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
                <div className="h-28 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  <BookOpen size={28} className="text-primary/50" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-medium text-gray-900 line-clamp-1">{record.courseId?.title}</h3>
                    <Badge variant={record.status === 'completed' ? 'success' : 'primary'}>{record.status.replace('_', ' ')}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{record.courseId?.category}</p>
                  <ProgressBar percent={record.overallProgressPercent} />
                  <Link
                    to={'/learner/courses/' + record.courseId?._id}
                    className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-primary text-white text-xs font-medium py-2 hover:opacity-90"
                  >
                    <PlayCircle size={13} /> Resume Learning
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Course Catalog</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {browsable.map((c) => (
              <div key={c._id} className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="font-medium text-gray-900 mb-1">{c.title}</h3>
                <p className="text-xs text-gray-500 mb-3">{c.shortDescription || c.category}</p>
                <button
                  onClick={() => handleEnroll(c._id)}
                  disabled={enrollingId === c._id}
                  className="text-xs rounded-lg bg-primary text-white px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
                >
                  {enrollingId === c._id ? 'Enrolling…' : 'Enroll Now'}
                </button>
              </div>
            ))}
            {browsable.length === 0 && <p className="text-sm text-gray-500">No new courses to enroll in right now.</p>}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
