import type { DailyGameSlug } from "@/lib/daily-score";

// Hand-drawn icons for the daily games. They inherit colour from the parent's text colour.

function CareerPathIcon() {
  // A career line climbing through five seasons
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 26h22" opacity="0.35" />
      <path d="M6 21l5-6 5 3 5-8 5-4" />
      {[[6, 21], [11, 15], [16, 18], [21, 10], [26, 6]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.4" fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}

function PhotoFinishIcon() {
  // A camera with a chequered finish flag in the corner
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
      <path d="M4 11a3 3 0 0 1 3-3h3l2-3h6l2 3h1" strokeLinecap="round" />
      <path d="M4 11v12a3 3 0 0 0 3 3h18a3 3 0 0 0 3-3v-5" strokeLinecap="round" />
      <circle cx="15" cy="17" r="5" />
      <g stroke="none" fill="currentColor">
        <rect x="22" y="5" width="3" height="3" />
        <rect x="28" y="5" width="3" height="3" />
        <rect x="25" y="8" width="3" height="3" />
        <rect x="22" y="11" width="3" height="3" />
        <rect x="28" y="11" width="3" height="3" />
      </g>
      <rect x="22" y="5" width="9" height="9" strokeWidth="1.2" />
    </svg>
  );
}

function CentreCircleIcon() {
  // The pitch's centre circle with letter tiles around the spot
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M16 3v26" opacity="0.35" strokeLinecap="round" />
      <circle cx="16" cy="16" r="10" />
      <circle cx="16" cy="16" r="2.6" fill="currentColor" stroke="none" />
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const r = (a * Math.PI) / 180;
        return <circle key={a} cx={16 + 10 * Math.sin(r)} cy={16 - 10 * Math.cos(r)} r="2.2" fill="currentColor" stroke="none" />;
      })}
    </svg>
  );
}

function GriddleIcon() {
  // A 3×3 board with a winning line filled in
  const filled = new Set([0, 4, 8, 5]);
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8">
      {Array.from({ length: 9 }, (_, i) => {
        const x = 4 + (i % 3) * 8.6;
        const y = 4 + Math.floor(i / 3) * 8.6;
        return (
          <rect key={i} x={x} y={y} width="6.8" height="6.8" rx="1.6"
            fill={filled.has(i) ? "currentColor" : "none"} opacity={filled.has(i) ? 1 : 0.55} />
        );
      })}
    </svg>
  );
}

const ICONS: Record<DailyGameSlug, () => React.ReactElement> = {
  careerpath: CareerPathIcon,
  photofinish: PhotoFinishIcon,
  centrecircle: CentreCircleIcon,
  griddle: GriddleIcon,
};

export function GameIcon({ game, className = "w-6 h-6" }: { game: DailyGameSlug; className?: string }) {
  const Icon = ICONS[game];
  return (
    <span className={`inline-block [&>svg]:w-full [&>svg]:h-full ${className}`} aria-hidden="true">
      <Icon />
    </span>
  );
}
