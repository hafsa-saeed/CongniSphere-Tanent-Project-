const VARIANT_CLASSES = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  neutral: 'bg-gray-100 text-gray-600',
  primary: 'bg-primary/10 text-primary',
};

export function Badge({ children, variant = 'neutral' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]}`}>
      {children}
    </span>
  );
}

/** Small lock/unlock/check glyph used next to modules and lessons. */
export function LockIcon({ status }) {
  if (status === 'completed') {
    return <span title="Completed" className="text-green-600">✓</span>;
  }
  if (status === 'locked') {
    return <span title="Locked" className="text-gray-400">🔒</span>;
  }
  return <span title="Unlocked" className="text-primary">▶</span>;
}
