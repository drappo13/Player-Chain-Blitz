import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Check, Flame, Share2 } from "lucide-react";
import { useUser } from "@/lib/user-context";
import { DAILY_GAMES, DAILY_META, dayShareText, shareText, useCountdown, useStreak, type DayProgress } from "@/lib/daily";
import { GameIcon } from "@/components/game-icons";
import type { DailyGameSlug } from "@/lib/daily-score";

const STRIPES = "repeating-linear-gradient(-45deg, rgba(255,255,255,0.28) 0 5px, transparent 5px 10px)";

/** Set progress segments, one per daily game: solid once done, striped and part-filled while in progress. */
export function SetSegments({ day, className = "h-2" }: { day: DayProgress; className?: string }) {
  return (
    <div className="flex gap-1.5">
      {DAILY_GAMES.map((g, i) => {
        const p = day[g.slug];
        return (
          <div key={g.slug} className={`flex-1 rounded-full bg-white/10 overflow-hidden ${className}`}>
            {p?.status === "done" && (
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.2 + i * 0.08, type: "spring", stiffness: 160, damping: 20 }}
                className={`h-full w-full origin-left ${g.bar}`}
              />
            )}
            {p?.status === "playing" && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(12, Math.round((p.progress ?? 0) * 100))}%`, backgroundPositionX: ["0px", "28px"] }}
                transition={{
                  width: { delay: 0.2 + i * 0.08, duration: 0.7, ease: "easeOut" },
                  backgroundPositionX: { duration: 1.2, repeat: Infinity, ease: "linear" },
                }}
                className={`h-full rounded-full opacity-60 ${g.bar}`}
                style={{ backgroundImage: STRIPES }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** End-of-game footer for the daily games: carries you on to the next unfinished one. */
export function DailyNext({ current }: { current: DailyGameSlug }) {
  const [, navigate] = useLocation();
  const { user } = useUser();
  const { view: day, today, current: streak } = useStreak(user?.username);
  const countdown = useCountdown();
  const [copied, setCopied] = useState(false);

  const shown: DayProgress = { ...day, [current]: { ...day[current], status: "done" } as DayProgress[DailyGameSlug] };
  const done = new Set(DAILY_GAMES.filter((g) => shown[g.slug]?.status === "done").map((g) => g.slug));
  const order = DAILY_GAMES.map((g) => g.slug);
  const from = order.indexOf(current);
  const next = [...order.slice(from + 1), ...order.slice(0, from)].find((s) => !done.has(s));
  const nextMeta = next ? DAILY_META[next] : null;

  const share = async () => {
    if (await shareText(dayShareText(day, streak, today))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto text-left">
      <div className="flex items-center justify-between mb-2 text-xs font-semibold">
        <span className="uppercase tracking-widest text-muted-foreground">Today's set</span>
        <span className="text-foreground tabular-nums">{done.size}/{DAILY_GAMES.length}</span>
      </div>
      <SetSegments day={shown} />

      {nextMeta ? (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate(nextMeta.href)}
          className={`mt-4 w-full rounded-2xl border p-4 flex items-center gap-3 text-left ${nextMeta.tile}`}
        >
          <span className={`w-11 h-11 rounded-xl bg-black/25 flex items-center justify-center ${nextMeta.accent}`}>
            <GameIcon game={nextMeta.slug} className="w-7 h-7" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-widest text-white/60">Next up</span>
            <span className="block text-lg font-black text-white">{nextMeta.name}</span>
            <span className="block text-xs text-white/70 truncate">{nextMeta.tagline}</span>
          </span>
          <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${nextMeta.solid}`}>
            <ArrowRight className="w-5 h-5" />
          </span>
        </motion.button>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 18 }}
          className="mt-4 rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 via-card to-card p-4 text-center"
        >
          <div className="mx-auto mb-2 w-11 h-11 rounded-full bg-emerald-400 text-emerald-950 flex items-center justify-center">
            <Check className="w-6 h-6" strokeWidth={3} />
          </div>
          <p className="text-lg font-black text-foreground">Daily set complete</p>
          {streak > 0 && (
            <p className="mt-0.5 text-sm font-semibold text-orange-300 inline-flex items-center gap-1">
              <Flame className="w-4 h-4" /> {streak}-day streak
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">New set in {countdown}</p>
          <button
            onClick={share}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-400 text-emerald-950 px-4 py-2 text-sm font-bold"
          >
            <Share2 className="w-4 h-4" /> {copied ? "Copied!" : "Share my day"}
          </button>
        </motion.div>
      )}

      <div className="text-center">
        <button onClick={() => navigate("/")} className="mt-4 text-sm font-semibold text-muted-foreground hover:text-foreground">
          Back to today's games
        </button>
      </div>
    </div>
  );
}

