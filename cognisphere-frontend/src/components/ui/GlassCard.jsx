import { forwardRef } from 'react';
import { motion } from 'framer-motion';

/**
 * Frosted-glass panel used for the dark Super Admin/HR theme —
 * semi-transparent background + backdrop blur + subtle border/highlight,
 * with a soft hover-scale + glow micro-interaction.
 *
 * Uses forwardRef because @hello-pangea/dnd's Draggable needs a real DOM
 * node ref (see CourseManager.jsx's `ref={modProvided.innerRef}`) — a
 * plain function component silently drops that ref, which was quietly
 * breaking drag positioning before this fix.
 *
 * Pass `hover={false}` to opt out (e.g. a card that's already being
 * actively dragged, where an extra scale transform would fight the
 * library's own transform).
 */
const GlassCard = forwardRef(function GlassCard({ children, className = '', hover = true, ...props }, ref) {
  return (
    <motion.div
      ref={ref}
      whileHover={
        hover
          ? {
              scale: 1.012,
              boxShadow: '0 0 0 1px rgba(129,140,248,0.35), 0 20px 40px -14px rgba(79,70,229,0.35)',
            }
          : undefined
      }
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-xl shadow-black/20 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
});

export default GlassCard;
