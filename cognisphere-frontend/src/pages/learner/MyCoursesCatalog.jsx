import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayCircle, BookOpen } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ProgressBar from '../../components/ui/ProgressBar';
import { Badge } from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { listCourses, getMyProgressSummary, enrollInCourse } from '../../api/learnerApi';
import { notify } from '../../lib/toast';

export default function MyCoursesCatalog() {
  const [tab, setTab] = useState('enrolled');
  const [summary, setSummary] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [enrollingId, setEnrollingId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');

  const load = async () => {
    setLoadError('');
    try {
      const [summaryRes, catalogRes] = await Promise.all([getMyProgressSummary(), listCourses()]);
      setSummary(summaryRes.data.data);
      setCatalog(catalogRes.data.data.courses);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Failed to load courses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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

  if (loading) return <DashboardLayout><p className="text-gray-500">Loading…</p></DashboardLayout>;
  if (loadError || !summary) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <p className="text-red-600 mb-3">{loadError || 'Something went wrong.'}</p>
          <button onClick={load} className="text-sm text-primary hover:underline">
            Try again
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const enrolledIds = new Set((summary?.courses || []).map((c) => c.courseId?._id));
  const categories = [...new Set(catalog.map((c) => c.category).filter(Boolean))];
  const filteredCatalog = categoryFilter ? catalog.filter((c) => c.category === categoryFilter) : catalog;

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Courses</h1>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <button
          onClick={() => setTab('enrolled')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === 'enrolled' ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}
        >
          Enrolled Courses
        </button>
        <button
          onClick={() => setTab('catalog')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === 'catalog' ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}
        >
          Course Catalog
        </button>
      </div>

      {tab === 'enrolled' ? (
        summary.courses.length === 0 ? (
          <EmptyState icon={BookOpen} title="No enrolled courses yet" description="Switch to the Course Catalog tab to get started." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.courses.map((record) => (
              <div key={record._id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-medium text-gray-900">{record.courseId?.title}</h3>
                  <Badge variant={record.status === 'completed' ? 'success' : 'primary'}>{record.status.replace('_', ' ')}</Badge>
                </div>
                <p className="text-xs text-gray-500 mb-3">{record.courseId?.category}</p>
                <ProgressBar percent={record.overallProgressPercent} />
                <Link
                  to={'/learner/courses/' + record.courseId?._id}
                  className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-primary text-white text-xs font-medium py-2 hover:opacity-90"
                >
                  <PlayCircle size={13} /> Continue
                </Link>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          {categories.length > 0 && (
            <div className="flex gap-2 mb-4 flex-wrap">
              <button
                onClick={() => setCategoryFilter('')}
                className={`text-xs rounded-full px-3 py-1.5 ${!categoryFilter ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`text-xs rounded-full px-3 py-1.5 ${categoryFilter === cat ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalog.map((c) => {
              const isEnrolled = enrolledIds.has(c._id);
              return (
                <div key={c._id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <h3 className="font-medium text-gray-900 mb-1">{c.title}</h3>
                  <p className="text-xs text-gray-500 mb-3">{c.shortDescription || c.category}</p>
                  {isEnrolled ? (
                    <Badge variant="success">Enrolled</Badge>
                  ) : (
                    <button
                      onClick={() => handleEnroll(c._id)}
                      disabled={enrollingId === c._id}
                      className="text-xs rounded-lg bg-primary text-white px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
                    >
                      {enrollingId === c._id ? 'Enrolling…' : 'Enroll Now'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
