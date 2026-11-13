import { Link } from "wouter";
import { Flame } from "lucide-react";
import { useUser } from "@/lib/user-context";
import { cachedStreak } from "@/lib/daily";

const CHIP = "fixed top-3 right-3 z-40 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-sm transition-colors shadow-sm";

/** Floating chip on game pages: your streak and name, linking to your stats (guests: pick a name). */
export function UserBadge() {
  const { user, isGuest, openClaim } = useUser();
  if (!user) return null;
  const streak = cachedStreak(user.username);
  const flame = streak > 0 && (
    <span className="flex items-center gap-0.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-1.5 py-0.5 text-[11px] font-black text-white tabular-nums">
      <Flame className="w-3 h-3 fill-yellow-100 text-yellow-100" />{streak}
    </span>
  );

  if (isGuest) {
    return (
      <button onClick={() => openClaim("game_chip")} className={`${CHIP} bg-card border-primary/40 hover:bg-muted`}>
        {flame}
        <span className="text-foreground font-bold text-xs">Pick a name</span>
      </button>
    );
  }

  return (
    <Link href="/me" className={`${CHIP} bg-card border-border hover:bg-muted`}>
      {flame}
      <span className="text-base">{user.avatar}</span>
      <span className="text-foreground font-medium text-xs max-w-[80px] truncate">{user.username}</span>
    </Link>
  );
}
