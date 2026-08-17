import { useEffect, useState } from 'react';
import { FileText, X, Search } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { getResourceLibrary } from '../../api/learnerApi';
import { notify } from '../../lib/toast';

export default function ResourceHub() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeDoc, setActiveDoc] = useState(null);

  useEffect(() => {
    getResourceLibrary()
      .then((res) => setResources(res.data.data))
      .catch((err) => notify.error(err.response?.data?.message || 'Failed to load resources.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = resources.filter(
    (r) =>
      r.lessonTitle.toLowerCase().includes(search.toLowerCase()) ||
      r.courseTitle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Resource &amp; PDF Hub</h1>
      <p className="text-sm text-gray-500 mb-6">All downloadable study materials, slides, and notes across your courses.</p>

      <div className="relative mb-6 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents…"
          className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {loading ? (
        <SkeletonList items={4} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No documents found" description="PDF lessons from your courses will appear here." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r, i) => (
            <button
              key={i}
              onClick={() => setActiveDoc(r)}
              className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
            >
              <div className="rounded-lg bg-red-50 p-2 w-fit mb-3">
                <FileText size={18} className="text-red-500" />
              </div>
              <p className="text-sm font-medium text-gray-900 line-clamp-2">{r.lessonTitle}</p>
              <p className="text-xs text-gray-500 mt-1">
                {r.courseTitle} · {r.moduleTitle}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* ---------- Built-in PDF viewer drawer ---------- */}
      {activeDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setActiveDoc(null)} />
          <div className="relative w-full max-w-4xl h-[85vh] bg-white rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-900 truncate">{activeDoc.lessonTitle}</p>
              <div className="flex items-center gap-3 shrink-0">
                <a href={activeDoc.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                  Open in new tab ↗
                </a>
                <button onClick={() => setActiveDoc(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe title={activeDoc.lessonTitle} src={activeDoc.url} className="flex-1 w-full" />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
