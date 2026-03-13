import { motion } from "framer-motion";
import { Star } from "lucide-react";

interface NewHighScoreBadgeProps {
  show: boolean;
  gradientClass?: string;
}

export function NewHighScoreBadge({
  show,
  gradientClass = "from-amber-500/15 to-amber-600/10 border-amber-500/20 text-amber-400 shadow-amber-500/10",
}: NewHighScoreBadgeProps) {
  if (!show) return null;
  return (
    <motion.div
      initial={{ scale: 0, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
      className={`mb-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${gradientClass} font-bold text-sm shadow-lg`}
    >
      <Star className="w-4 h-4 fill-current" />
      New High Score!
    </motion.div>
  );
}
