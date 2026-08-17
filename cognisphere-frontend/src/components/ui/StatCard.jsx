import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * Metric card used across all three dashboards.
 * `dark` renders the glassmorphism Super Admin/HR variant with an
 * optional `icon` and `trendPercent` (positive = green up-arrow,
 * negative = red down-arrow). Both variants get a soft hover-scale.
 */
export default function StatCard({ label, value, sublabel, icon: Icon, trendPercent, dark = false }) {
  const hasTrend = typeof trendPercent === 'number';
  const isPositive = trendPercent >= 0;

  if (dark) {
    return (
      <motion.div
        whileHover={{ scale: 1.02, boxShadow: '0 0 0 1px rgba(129,140,248,0.35), 0 16px 32px -12px rgba(79,70,229,0.35)' }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5 shadow-lg shadow-black/20"
      >
        <div className="flex items-start justify-between">
          <p className="text-sm text-zinc-400">{label}</p>
          {Icon && (
            <div className="rounded-lg bg-indigo-500/10 p-1.5">
              <Icon size={16} className="text-indigo-400" />
            </div>
          )}
        </div>
        <p className="mt-2 text-2xl font-bold text-white">{value}</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          {hasTrend && (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(trendPercent)}%
            </span>
          )}
          {sublabel && <span className="text-xs text-zinc-500">{sublabel}</span>}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02, boxShadow: '0 12px 24px -10px rgba(0,0,0,0.15)' }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="rounded-xl p-5 shadow-sm border bg-white border-gray-200 text-gray-900"
    >
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-gray-400">{sublabel}</p>}
    </motion.div>
  );
}
