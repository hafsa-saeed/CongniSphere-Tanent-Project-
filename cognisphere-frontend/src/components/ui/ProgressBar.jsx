export default function ProgressBar({ percent = 0, showLabel = true, className = '' }) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div className={className}>
      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${clamped}%` }} />
      </div>
      {showLabel && <p className="mt-1 text-xs text-gray-500">{clamped}% complete</p>}
    </div>
  );
}
