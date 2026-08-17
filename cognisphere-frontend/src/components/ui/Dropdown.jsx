import { useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';

/**
 * Quick-actions "3 dots" menu. `items` is an array of
 * { label, icon: LucideIcon, onClick, tone } — `tone: 'danger'` renders red.
 */
export default function Dropdown({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl py-1">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-800 ${
                item.tone === 'danger' ? 'text-red-400' : 'text-zinc-200'
              }`}
            >
              {item.icon && <item.icon size={14} />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
