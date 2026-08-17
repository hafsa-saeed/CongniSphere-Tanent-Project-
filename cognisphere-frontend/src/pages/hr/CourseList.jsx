import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, BookOpen, Clock, Upload, EyeOff } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import { Badge } from '../../components/ui/Badge';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { listCourses, updateCourse } from '../../api/hrApi';
import { notify } from '../../lib/toast';

export default function CourseList() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);

  const load = async () => {
    try {
      const { data } = await listCourses({ limit: 50 });
      setCourses(data.data.courses);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to load courses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const togglePublish = async (course) => {
    const nextStatus = course.status === 'published' ? 'draft' : 'published';
    setTogglingId(course._id);
    try {
      await updateCourse(course._id, { status: nextStatus });
      setCourses((cs) => cs.map((c) => (c._id === course._id ? { ...c, status: nextStatus } : c)));
      notify.success(nextStatus === 'published' ? 'Course published — it can now be assigned to learners.' : 'Course unpublished.');
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to update course status.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <DashboardLayout dark>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Course Manager</h1>
        <Link
          to="/hr/courses/new"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          <Plus size={16} /> New Course
        </Link>
      </div>

      {loading ? (
        <SkeletonList items={4} />
      ) : courses.length === 0 ? (
        <GlassCard>
          <EmptyState icon={BookOpen} title="No courses yet" description="Build your first course with the drag-and-drop module builder." />
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => {
            const isPublished = c.status === 'published';
            return (
              <GlassCard key={c._id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-white">{c.title}</h3>
                  <Badge variant={isPublished ? 'success' : 'warning'}>{c.status}</Badge>
                </div>
                <p className="text-xs text-zinc-500 mb-3">{c.category || 'Uncategorized'}</p>
                <div className="flex items-center gap-3 text-xs text-zinc-500 mb-4">
                  <span className="flex items-center gap-1">
                    <BookOpen size={12} /> {c.stats?.totalModules || 0} modules
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {c.stats?.totalDurationMinutes || 0} min
                  </span>
                </div>
                <button
                  onClick={() => togglePublish(c)}
                  disabled={togglingId === c._id}
                  className={
                    'w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50 ' +
                    (isPublished ? 'bg-white/5 text-zinc-300 hover:bg-white/10' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20')
                  }
                >
                  {isPublished ? <EyeOff size={12} /> : <Upload size={12} />}
                  {togglingId === c._id ? 'Updating…' : isPublished ? 'Unpublish' : 'Publish course'}
                </button>
              </GlassCard>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
