import { X } from 'lucide-react';

export default function Drawer({ open, onClose, title, children, width = 'max-w-md' }) {
  return (
    <div
      className={`fixed inset-0 z-40 transition-opacity ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className={`absolute right-0 top-0 h-full w-full ${width} bg-zinc-900 border-l border-zinc-800 shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-57px)] px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
