import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Check, ChevronRight, Flame, Share2, Trophy, Clock } from "lucide-react";
import { useUser } from "@/lib/user-context";
import { trackEvent } from "@/lib/firebase";
import { HubPage } from "@/components/app-nav";
import { SetSegments } from "@/components/daily-next";
import { FriendBest } from "@/components/friends";
import { useFriendsDay, type FriendScore } from "@/lib/friends";
import { GameIcon } from "@/components/game-icons";
import {
  DAILY_GAMES,
  countsToday,
  shiftDay,
  useDayProgress,
  dayShareText,
  shareText,
  msToMidnight,
  todayKey,
  useCountdown,
  useStreak,
  useTodayRanks,
  type DailyGameMeta,
  type DailyProgress,
  type DayProgress,
} from "@/lib/daily";
import type { DailyGameSlug } from "@/lib/daily-score";

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? "Late one" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function prettyDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

const CONFETTI_COLOURS = ["#a78bfa", "#fbbf24", "#34d399", "#38bdf8", "#f472b6", "#fb923c"];

function Confetti() {
  const bits = useMemo(
    () => Array.from({ length: 44 }, (_, i) => ({
      x: (Math.random() - 0.5) * 420,
      y: -80 - Math.random() * 160,
      r: Math.random() * 540 - 270,
      c: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
      d: Math.random() * 0.25,
      w: 6 + Math.random() * 5,
    })),
    [],
  );
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute rounded-[2px]"
          style={{ background: b.c, width: b.w, height: b.w * 0.45 }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: b.x, y: [0, b.y, b.y + 260], opacity: [1, 1, 0], rotate: b.r }}
          transition={{ duration: 1.8, delay: b.d, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

/** Yesterday's set: offered to brand-new players once they've finished a game today. */
function YesterdayLink({ yView }: { yView: DayProgress }) {
  const left = DAILY_GAMES.filter((g) => !countsToday(yView[g.slug]));
  if (!left.length) return null;
  return (
    <Link href={`${left[0].href}?set=yesterday`} onClick={() => trackEvent("yesterday_open", { from: "home" })}
      className="mt-2 flex items-center justify-between gap-2 text-[11px] sm:text-xs font-semibold text-sky-300 hover:text-sky-200">
      <span className="truncate">Want more? Play yesterday's set too</span>
      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
    </Link>
  );
}

function SetCard({ day, streak, playedToday, today, username, yesterday }: { day: DayProgress; streak: number; playedToday: boolean; today: string; username: string; yesterday?: React.ReactNode }) {
  const countdown = useCountdown();
  const done = new Set(DAILY_GAMES.filter((g) => countsToday(day[g.slug])).map((g) => g.slug));
  const n = done.size;
  const total = DAILY_GAMES.length;
  const complete = n === total;
  const [copied, setCopied] = useState(false);

  // Celebrate the first time the finished set is seen today
  const celebrateKey = `pcb-set-celebrated-${username}-${today}`;
  const [celebrate] = useState(() => {
    if (!complete) return false;
    try {
      if (localStorage.getItem(celebrateKey)) return false;
      localStorage.setItem(celebrateKey, "1");
    } catch { /* ignore */ }
    return true;
  });

  const message = complete
    ? "Set complete. See you tomorrow."
    : n === 0
      ? streak > 0 && !playedToday
        ? `Finish one to keep your ${streak}-day streak going`
        : "Four fresh games. Start anywhere."
      : `${total - n} to go${total - n === 1 ? " — nearly there" : ""}`;

  const share = async () => {
    if (await shareText(dayShareText(day, streak, today))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-3xl border p-3 sm:p-5 mb-3 sm:mb-4 ${
        complete ? "border-emerald-400/40 bg-gradient-to-br from-emerald-500/20 via-card to-card" : "border-border bg-card"
      }`}
    >
      {celebrate && <Confetti />}
      <div className="flex items-center gap-3 sm:gap-4 mb-2.5 sm:mb-3.5">
        <div className="relative w-11 h-11 sm:w-14 sm:h-14 shrink-0">
          <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
            <circle cx="28" cy="28" r="24" fill="none" strokeWidth="6" className="stroke-white/10" />
            <motion.circle
              cx="28" cy="28" r="24" fill="none" strokeWidth="6" strokeLinecap="round"
              className={complete ? "stroke-emerald-400" : "stroke-primary"}
              strokeDasharray={2 * Math.PI * 24}
              initial={{ strokeDashoffset: 2 * Math.PI * 24 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 24 * (1 - n / total) }}
              transition={{ duration: 0.9, delay: 0.2, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {complete ? (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.9, type: "spring", stiffness: 300 }}>
                <Check className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-300" strokeWidth={3} />
              </motion.span>
            ) : (
              <span className="text-sm sm:text-base font-black tabular-nums text-foreground">{n}/{total}</span>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
            Today's set <span className="opacity-50">·</span> <Clock className="w-3 h-3" /> {countdown}
          </p>
          <p className="text-sm sm:text-lg font-black text-foreground leading-snug">{message}</p>
        </div>
        {n > 0 && (
          <button
            onClick={share}
            aria-label="Share my day"
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold ${
              complete ? "bg-emerald-400 text-emerald-950" : "bg-white/10 text-foreground hover:bg-white/15"
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{copied ? "Copied!" : "Share my day"}</span>
            <span className="sm:hidden">{copied ? "Copied" : "Share"}</span>
          </button>
        )}
      </div>
      <SetSegments day={day} className="h-2 sm:h-2.5" />
      {yesterday}
    </motion.div>
  );
}

function DailyTile({ game, p, rank, index, friend, startHere }: {
  game: DailyGameMeta; p?: DailyProgress; rank?: { rank: number; of: number }; index: number; friend?: FriendScore; startHere?: boolean;
}) {
  // A game that counts for today but is still open looks done, with a way back in
  const counted = p?.status === "playing" && !!p.counted;
  const status = counted ? "done" : p?.status ?? "new";
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + index * 0.06 }}>
      <Link href={game.href} data-testid={`tile-${game.slug}`}
        onClick={() => trackEvent("tile_open", { game: game.slug, mode: "daily", status, position: index + 1 })}>
        <motion.div
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          className={`relative h-[170px] [@media(max-height:680px)]:h-[160px] sm:h-[210px] overflow-hidden rounded-2xl border p-3 sm:p-4 flex flex-col cursor-pointer ${game.tile}`}
        >
          <div className="flex items-start justify-between mb-1.5 sm:mb-2">
            <span className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-black/25 flex items-center justify-center ${game.accent}`}>
              <GameIcon game={game.slug} className="w-6 h-6 sm:w-7 sm:h-7" />
            </span>
            {status === "done" && (
              <motion.span
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.35 + index * 0.06, type: "spring", stiffness: 320, damping: 16 }}
                className="w-7 h-7 rounded-full bg-emerald-400 text-emerald-950 flex items-center justify-center shadow-lg shadow-emerald-500/20"
              >
                <Check className="w-4 h-4" strokeWidth={3.5} />
              </motion.span>
            )}
            {status === "playing" && (
              <span className="text-[10px] font-bold uppercase tracking-wider rounded-full bg-black/30 px-2 py-1 text-white/85">In progress</span>
            )}
            {status === "new" && startHere && (
              <span className="text-[10px] font-black uppercase tracking-wider rounded-full bg-white text-black px-2 py-1">Start here</span>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-black text-white leading-tight">{game.name}</h2>

          <div className="flex-1 min-h-0 mt-0.5">
            {status === "new" && <p className="text-xs text-white/70 leading-snug line-clamp-2">{game.tagline}</p>}
            {status === "playing" && (
              <>
                {p!.level && <p className={`text-sm font-black leading-tight ${game.accent}`}>{p!.level}</p>}
                <p className="text-xs font-semibold text-white/85 truncate">{p!.detail}</p>
                {p!.progress != null && (
                  <div className="mt-1.5 h-1.5 rounded-full bg-black/30 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${game.bar}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(4, Math.round(p!.progress * 100))}%` }}
                      transition={{ duration: 0.7, delay: 0.2 }}
                    />
                  </div>
                )}
              </>
            )}
            {status === "done" && (
              <>
                <p className="text-white leading-none mt-0.5">
                  <span className="text-[28px] sm:text-3xl font-black tabular-nums">{p!.score.toLocaleString()}</span>
                  {game.max && <span className="text-sm font-bold text-white/55">/{game.max}</span>}
                </p>
                {!counted && p!.detail !== "Finished" && (
                  <p className="text-xs text-white/70 mt-1 truncate">{p!.level ? `${p!.level} \u00B7 ${p!.detail}` : p!.detail}</p>
                )}
              </>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-1.5 min-w-0">
            {status === "done" && !counted ? (
              rank ? (
                <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-bold ${game.accent}`}>
                  <Trophy className="w-3 h-3" /> <span>#{rank.rank}<span className="font-semibold opacity-80">/{rank.of}</span></span>
                </span>
              ) : (
                <span className="shrink-0 inline-flex items-center gap-0.5 text-xs font-bold text-white/60">
                  Results <ChevronRight className="w-3.5 h-3.5" />
                </span>
              )
            ) : (
              <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-black ${game.solid}`}>
                {status === "new" ? "Play" : counted ? "Keep going" : "Continue"} <ChevronRight className="w-3.5 h-3.5 -mr-1" />
              </span>
            )}
            <FriendBest best={friend} />
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

export default function Home() {
  const { user } = useUser();
  const today = todayKey();
  const { current, playedToday, view, entries } = useStreak(user?.username);
  const ranks = useTodayRanks(user?.username, today, view);
  const { day: friendsDay } = useFriendsDay(user?.username, today);

  // Yesterday's set: only for brand-new players (day 0), once they've finished a game today.
  // Everyone else comes back tomorrow for the next one.
  const yesterday = shiftDay(today, -1);
  const yView = useDayProgress(user?.username, yesterday);
  const dayZero = !entries.some((e) => e.dateKey < today);
  const showYesterday = dayZero && DAILY_GAMES.some((g) => countsToday(view[g.slug]));
  // First visit: point newcomers at Career Path (it has a clear end)
  const newcomer = entries.length === 0 && !DAILY_GAMES.some((g) => view[g.slug]);

  // Keep the countdown honest across midnight: reload into the new day
  useEffect(() => {
    const t = setTimeout(() => window.location.reload(), Math.min(864e5, msToMidnight() + 2000));
    return () => clearTimeout(t);
  }, []);

  return (
    <HubPage>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-3 sm:mb-4">
        <p className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 flex-wrap">
          <span>{prettyDate(today)}</span>
          {user && current > 0 && (
            <span className="inline-flex items-center gap-1 normal-case tracking-normal text-xs">
              <Flame className={`w-3.5 h-3.5 ${playedToday ? "fill-amber-400 text-orange-400" : "text-muted-foreground"}`} />
              <span className={playedToday ? "font-black bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent" : "text-muted-foreground"}>
                {playedToday ? `${current}-day streak` : `${current}-day streak \u2014 play today to keep it`}
              </span>
            </span>
          )}
        </p>
        <h1 className="text-xl sm:text-3xl font-black text-foreground tracking-tight break-words" data-testid="text-app-title">
          {greeting()}{user && !user.guest ? `, ${user.username}` : ""}
        </h1>
      </motion.div>

      <SetCard day={view} streak={current} playedToday={playedToday} today={today} username={user?.username ?? ""}
        yesterday={showYesterday ? <YesterdayLink yView={yView} /> : null} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {DAILY_GAMES.map((g, i) => (
          <DailyTile key={g.slug} game={g} p={view[g.slug as DailyGameSlug]} rank={ranks[g.slug]} index={i}
            friend={friendsDay[g.slug as DailyGameSlug]?.[0]} startHere={newcomer && g.slug === "careerpath"} />
        ))}
      </div>

    </HubPage>
  );
}

