import { motion } from 'framer-motion';

const variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

/**
 * Wraps a page's content in a soft fade-in + slide-up on mount. Used
 * inside DashboardLayout (so every authenticated page gets it for free)
 * and directly on the public Landing Page / Org Profile pages, which
 * don't go through DashboardLayout.
 */
export default function PageTransition({ children, className }) {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
