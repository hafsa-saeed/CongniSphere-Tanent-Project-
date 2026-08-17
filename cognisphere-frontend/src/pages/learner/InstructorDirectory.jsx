import { useEffect, useState } from 'react';
import { GraduationCap, User } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Drawer from '../../components/ui/Drawer';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { listInstructors } from '../../api/learnerApi';
import { notify } from '../../lib/toast';

export default function InstructorDirectory() {
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  useEffect(() => {
    listInstructors()
      .then((res) => setInstructors(res.data.data))
      .catch((err) => notify.error(err.response?.data?.message || 'Failed to load instructors.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Instructor Directory</h1>
      <p className="text-sm text-gray-500 mb-6">Meet the trainers and lecturers behind your courses.</p>

      {loading ? (
        <SkeletonList items={3} />
      ) : instructors.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No instructors listed yet" description="Your HR team hasn't added instructor profiles." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {instructors.map((inst) => (
            <button
              key={inst._id}
              onClick={() => setActive(inst)}
              className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3 mb-2">
                {inst.avatarUrl ? (
                  <img src={inst.avatarUrl} alt={inst.fullName} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User size={20} className="text-primary" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-900">{inst.fullName}</p>
                  <p className="text-xs text-gray-500">{inst.title}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">{inst.bio}</p>
              {inst.industryExperience && <p className="text-[11px] text-gray-400 mt-1.5">{inst.industryExperience}</p>}
              {inst.skills?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {inst.skills.slice(0, 4).map((s, i) => (
                    <span key={i} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                      {s}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-primary mt-2">{inst.coursesTaught?.length || 0} course(s) taught</p>
            </button>
          ))}
        </div>
      )}

      {/* ---------- Instructor profile drawer ---------- */}
      <Drawer open={!!active} onClose={() => setActive(null)} title={active?.fullName || 'Instructor'}>
        {active && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              {active.avatarUrl ? (
                <img src={active.avatarUrl} alt={active.fullName} className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-indigo-500/10 flex items-center justify-center">
                  <User size={26} className="text-indigo-300" />
                </div>
              )}
              <div>
                <p className="text-base font-semibold text-white">{active.fullName}</p>
                <p className="text-xs text-zinc-400">{active.title}</p>
              </div>
            </div>

            {active.bio && (
              <div>
                <h5 className="text-xs font-semibold uppercase text-zinc-500 mb-1.5">Bio</h5>
                <p className="text-sm text-zinc-300">{active.bio}</p>
              </div>
            )}
            {active.academicBackground && (
              <div>
                <h5 className="text-xs font-semibold uppercase text-zinc-500 mb-1.5">Academic Background</h5>
                <p className="text-sm text-zinc-300">{active.academicBackground}</p>
              </div>
            )}
            {active.industryExperience && (
              <div>
                <h5 className="text-xs font-semibold uppercase text-zinc-500 mb-1.5">Industry Experience</h5>
                <p className="text-sm text-zinc-300">{active.industryExperience}</p>
              </div>
            )}
            {active.skills?.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold uppercase text-zinc-500 mb-1.5">Skills</h5>
                <div className="flex flex-wrap gap-1.5">
                  {active.skills.map((s, i) => (
                    <span key={i} className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-xs text-indigo-300">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {active.missionStatement && (
              <div>
                <h5 className="text-xs font-semibold uppercase text-zinc-500 mb-1.5">Mission Statement</h5>
                <p className="text-sm text-zinc-300 italic">"{active.missionStatement}"</p>
              </div>
            )}
            {active.successStories?.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold uppercase text-zinc-500 mb-1.5">Success Stories</h5>
                <ul className="list-disc list-inside space-y-1">
                  {active.successStories.map((s, i) => (
                    <li key={i} className="text-sm text-zinc-300">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {active.coursesTaught?.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold uppercase text-zinc-500 mb-1.5">Courses Taught</h5>
                <div className="space-y-1.5">
                  {active.coursesTaught.map((c) => (
                    <div key={c._id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200">
                      {c.title}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </DashboardLayout>
  );
}
