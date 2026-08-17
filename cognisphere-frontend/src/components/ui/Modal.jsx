import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Generic confirmation/action modal. `tone="danger"` swaps the confirm
 * button to red for destructive actions (suspend, delete, etc.).
 *
 * Wrapped in AnimatePresence so closing it plays a proper exit animation
 * instead of vanishing instantly — the previous version's `if (!open)
 * return null` unmounted immediately with no way for an exit transition
 * to run.
 */
export default function Modal({ open, onClose, title, children, onConfirm, confirmLabel = 'Confirm', tone = 'primary', confirmDisabled = false }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 text-sm text-zinc-300">{children}</div>

            {onConfirm && (
              <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800">
                <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800">
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onConfirm}
                  disabled={confirmDisabled}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
                    tone === 'danger' ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'
                  }`}
                >
                  {confirmLabel}
                </motion.button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
