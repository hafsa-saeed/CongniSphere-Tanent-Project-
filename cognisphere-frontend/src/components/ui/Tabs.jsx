import { useState } from 'react';

/**
 * `tabs` is an array of { id, label, icon: LucideIcon, content: ReactNode }.
 */
export default function Tabs({ tabs, defaultTabId }) {
  const [activeId, setActiveId] = useState(defaultTabId || tabs[0]?.id);
  const active = tabs.find((t) => t.id === activeId);

  return (
    <div>
      <div className="flex gap-1 border-b border-zinc-800 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeId === tab.id
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.icon && <tab.icon size={15} />}
            {tab.label}
          </button>
        ))}
      </div>
      <div>{active?.content}</div>
    </div>
  );
}
