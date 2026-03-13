import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface FloatingEmojisProps {
  emoji: string;
  tier: number;
  counts?: [number, number, number, number];
  sizeMin?: number;
  sizeRange?: number;
  opacityPeak?: number;
}

export function FloatingEmojis({
  emoji,
  tier,
  counts = [0, 4, 8, 12],
  sizeMin = 14,
  sizeRange = 14,
  opacityPeak = 0.5,
}: FloatingEmojisProps) {
  const count = counts[tier] ?? counts[counts.length - 1];
  const emojis = useMemo(() => {
    if (!emoji || tier === 0) return [];
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      emoji,
      left: `${5 + Math.random() * 90}%`,
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 4,
      size: sizeMin + Math.random() * sizeRange,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emoji, tier, count, sizeMin, sizeRange]);

  return (
    <AnimatePresence>
      {emojis.map((e) => (
        <motion.span
          key={`${e.id}-${emoji}`}
          initial={{ opacity: 0, y: "100vh" }}
          animate={{ opacity: [0, opacityPeak, opacityPeak, 0], y: "-20vh" }}
          exit={{ opacity: 0 }}
          transition={{
            duration: e.duration,
            delay: e.delay,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute select-none"
          style={{ left: e.left, fontSize: e.size }}
        >
          {e.emoji}
        </motion.span>
      ))}
    </AnimatePresence>
  );
}
