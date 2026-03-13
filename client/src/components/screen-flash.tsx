import { AnimatePresence, motion } from "framer-motion";

interface ScreenFlashProps {
  show: boolean;
  color: string;
  opacity?: number;
  duration?: number;
}

export function ScreenFlash({ show, color, opacity = 0.08, duration = 0.3 }: ScreenFlashProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 pointer-events-none z-50"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity }}
            exit={{ opacity: 0 }}
            transition={{ duration }}
            className={`absolute inset-0 ${color}`}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
