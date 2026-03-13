import { useMemo } from "react";

interface FloatingEmojisProps {
  emoji: string;
  tier: number;
  counts?: [number, number, number, number];
  sizeMin?: number;
  sizeRange?: number;
  opacityPeak?: number;
}

/**
 * Floating emoji background effect using pure CSS animations.
 * CSS @keyframes run on the compositor thread — no main-thread JS overhead,
 * which eliminates the jitter that Framer Motion's JS-driven repeat caused on mobile.
 */
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
      left: `${5 + Math.random() * 90}%`,
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 4,
      size: sizeMin + Math.random() * sizeRange,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emoji, tier, count, sizeMin, sizeRange]);

  if (emojis.length === 0) return null;

  return (
    <>
      {emojis.map((e) => (
        <span
          key={`${e.id}-${emoji}`}
          className="absolute select-none pointer-events-none"
          style={{
            left: e.left,
            fontSize: e.size,
            animation: `floatUp ${e.duration}s linear ${e.delay}s infinite`,
            willChange: "transform, opacity",
            // CSS custom property for per-element opacity peak
            ["--float-peak" as string]: opacityPeak,
          }}
        >
          {emoji}
        </span>
      ))}
    </>
  );
}
