import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock } from "lucide-react";
import { BADGES, type Badge, type BadgeContext } from "@/lib/badges";
import { trackEvent } from "@/lib/firebase";

const seenKey = (username: string) => `pcb-badges-seen-${username.toLowerCase()}`;

function readSeen(username: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(seenKey(username));
    return raw ? new Set(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function Medal({ badge, unlocked, isNew, index }: { badge: Badge; unlocked: boolean; isNew: boolean; index: number }) {
  const Icon = badge.icon;
  return (
    <motion.span
      initial={isNew ? { scale: 0.3, rotate: -40, opacity: 0 } : false}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 14, delay: isNew ? 0.4 + index * 0.08 : 0 }}
      className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center overflow-hidden ${
        unlocked
          ? `bg-gradient-to-br ${badge.colour} shadow-lg shadow-black/30 ring-2 ring-white/20`
          : "bg-white/[0.04] border border-dashed border-white/15"
      }`}
    >
      {unlocked ? (
        <>
          <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow" strokeWidth={2.4} />
          {/* A slow shine across unlocked medals */}
          <motion.span
            aria-hidden
            className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent -skew-x-12"
            initial={{ x: "-150%" }}
            animate={{ x: "250%" }}
            transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 5 + (index % 5) * 0.9, delay: index * 0.35, ease: "easeInOut" }}
          />
        </>
      ) : (
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white/20" />
      )}
    </motion.span>
  );
}

/** Badge cabinet for the Me page: unlocked medals shine, new ones pop in once, tap for details. */
export function BadgeGrid({ ctx, username }: { ctx: BadgeContext; username: string }) {
  const rows = useMemo(() => BADGES.map((b) => {
    const [cur, target] = b.progress(ctx);
    return { badge: b, cur: Math.min(cur, target), target, unlocked: cur >= target };
  }), [ctx]);
  const unlockedIds = rows.filter((r) => r.unlocked).map((r) => r.badge.id);

  // Badges unlocked since the last visit get the pop-in; the first visit just shows them
  const [seen] = useState(() => readSeen(username));
  const fresh = new Set(seen ? unlockedIds.filter((id) => !seen.has(id)) : []);
  useEffect(() => {
    fresh.forEach((badge) => trackEvent("badge_unlock", { badge, unlocked_total: unlockedIds.length }));
    try { localStorage.setItem(seenKey(username), JSON.stringify(unlockedIds)); } catch { /* ignore */ }
  }, [username, unlockedIds.join(",")]);

  const [selected, setSelected] = useState<string | null>(null);
  const sel = rows.find((r) => r.badge.id === selected);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-black text-foreground">Badges</h2>
        <span className="text-xs font-bold text-muted-foreground tabular-nums">{unlockedIds.length}/{BADGES.length} unlocked</span>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-5 gap-x-2 gap-y-3">
        {rows.map(({ badge, unlocked, cur, target }, i) => (
          <button
            key={badge.id}
            onClick={() => setSelected(selected === badge.id ? null : badge.id)}
            className={`relative flex flex-col items-center gap-1.5 rounded-xl py-1.5 transition-colors ${selected === badge.id ? "bg-white/[0.06]" : ""}`}
          >
            <Medal badge={badge} unlocked={unlocked} isNew={fresh.has(badge.id)} index={i} />
            {fresh.has(badge.id) && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.8 + i * 0.08, type: "spring", stiffness: 400 }}
                className="absolute top-0 right-1 rounded-full bg-primary px-1.5 text-[9px] font-black text-primary-foreground"
              >
                NEW
              </motion.span>
            )}
            <span className={`text-[10px] sm:text-[11px] font-bold leading-tight text-center line-clamp-2 ${unlocked ? "text-foreground" : "text-muted-foreground/60"}`}>
              {badge.name}
            </span>
            {!unlocked && target > 1 && cur > 0 && (
              <span className="w-10 h-1 rounded-full bg-white/10 overflow-hidden">
                <span className="block h-full bg-white/40" style={{ width: `${(cur / target) * 100}%` }} />
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {sel && (
          <motion.div
            key={sel.badge.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl bg-white/[0.04] px-3 py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-foreground">{sel.badge.name}</p>
                <p className="text-xs text-muted-foreground">{sel.badge.how}</p>
              </div>
              {sel.unlocked ? (
                <span className="text-xs font-bold text-emerald-300">Unlocked</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground tabular-nums">
                  <Lock className="w-3 h-3" />{sel.target > 1 ? `${sel.cur}${sel.badge.unit ?? ""}/${sel.target}${sel.badge.unit ?? ""}` : "Locked"}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
