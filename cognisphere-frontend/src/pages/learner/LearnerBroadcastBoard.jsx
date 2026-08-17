import { useEffect, useState } from 'react';
import { Megaphone, AlertTriangle, Building2, Globe } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { getActiveBroadcasts } from '../../api/learnerApi';
import { notify } from '../../lib/toast';

export default function LearnerBroadcastBoard() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActiveBroadcasts()
      .then((res) => setBroadcasts(res.data.data))
      .catch((err) => notify.error(err.response?.data?.message || 'Failed to load announcements.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Notice Board</h1>
      <p className="text-sm text-gray-500 mb-6">Announcements from CogniSphere and your organization.</p>

      {loading ? (
        <SkeletonList items={3} />
      ) : broadcasts.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements right now" description="Check back later for updates from CogniSphere and your company." />
      ) : (
        <div className="space-y-3 max-w-2xl">
          {broadcasts.map((b) => {
            const isUrgent = b.priority === 'urgent';
            const isGlobal = b.sender === 'superadmin';
            return (
              <div
                key={b._id}
                className={'rounded-xl border p-4 ' + (isUrgent ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200')}
              >
                <div className="flex items-start gap-3">
                  {isUrgent ? (
                    <AlertTriangle size={16} className="mt-0.5 text-red-600 shrink-0" />
                  ) : (
                    <Megaphone size={16} className="mt-0.5 text-primary shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={'text-sm font-semibold ' + (isUrgent ? 'text-red-800' : 'text-gray-900')}>{b.title}</p>
                      <span className="flex items-center gap-1 text-[11px] text-gray-400">
                        {isGlobal ? <Globe size={10} /> : <Building2 size={10} />}
                        {isGlobal ? 'CogniSphere' : 'Your organization'}
                      </span>
                    </div>
                    <p className={'text-sm ' + (isUrgent ? 'text-red-700' : 'text-gray-600')}>{b.message}</p>
                    <p className="text-[11px] text-gray-400 mt-2">{new Date(b.createdAt).toLocaleString()}</p>
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
