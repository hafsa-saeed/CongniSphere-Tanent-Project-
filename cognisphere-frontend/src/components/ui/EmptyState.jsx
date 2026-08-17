export default function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="mb-4 rounded-full bg-zinc-800 p-3">
          <Icon size={24} className="text-zinc-500" />
        </div>
      )}
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      {description && <p className="mt-1 text-xs text-zinc-500 max-w-xs">{description}</p>}
    </div>
  );
}
