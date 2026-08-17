import { useEffect, useState } from 'react';
import { Megaphone, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Auto-rotating ticker for active broadcasts. Used on both the Learner
 * Dashboard and (in banner form) the HR Dashboard.
 */
export default function AnnouncementCarousel({ broadcasts }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (broadcasts.length <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % broadcasts.length), 6000);
    return () => clearInterval(timer);
  }, [broadcasts.length]);

  if (broadcasts.length === 0) return null;

  const current = broadcasts[index];
  const isUrgent = current.priority === 'urgent';

  return (
    <div
      className={`rounded-xl border p-4 flex items-center gap-3 ${
        isUrgent ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-200'
      }`}
    >
      {isUrgent ? (
        <AlertTriangle size={18} className="text-red-600 shrink-0" />
      ) : (
        <Megaphone size={18} className="text-indigo-600 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${isUrgent ? 'text-red-800' : 'text-indigo-800'}`}>{current.title}</p>
        <p className={`text-xs truncate ${isUrgent ? 'text-red-700' : 'text-indigo-700'}`}>{current.message}</p>
      </div>
      {broadcasts.length > 1 && (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setIndex((i) => (i - 1 + broadcasts.length) % broadcasts.length)} className="text-gray-400 hover:text-gray-600">
            <ChevronLeft size={16} />
          </button>
          <span className="text-[11px] text-gray-500">
            {index + 1}/{broadcasts.length}
          </span>
          <button onClick={() => setIndex((i) => (i + 1) % broadcasts.length)} className="text-gray-400 hover:text-gray-600">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
