function Shimmer({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-zinc-800 ${className}`} />;
}

export function SkeletonStatCard() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
      <Shimmer className="h-3 w-24" />
      <Shimmer className="h-7 w-16" />
      <Shimmer className="h-3 w-20" />
    </div>
  );
}

export function SkeletonChart({ height = 280 }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <Shimmer className="h-4 w-40 mb-4" />
      <Shimmer className={`w-full`} style={{ height }} />
    </div>
  );
}

export function SkeletonTableRow({ columns = 5 }) {
  return (
    <tr className="border-b border-zinc-800">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-5 py-4">
          <Shimmer className="h-4 w-full max-w-[140px]" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 5, columns = 5 }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} columns={columns} />
      ))}
    </tbody>
  );
}

export function SkeletonList({ items = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2">
          <Shimmer className="h-4 w-1/3" />
          <Shimmer className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export default Shimmer;
