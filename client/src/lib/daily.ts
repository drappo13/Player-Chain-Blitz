import { useEffect, useState } from "react";
import { collection, query, where, getDocs, getCountFromServer } from "firebase/firestore";
import { db, trackEvent } from "./firebase";
import type { DailyGameSlug } from "./daily-score";
import { shareLink } from "./user-context";
import { isGuestName } from "./guest";

// --- The daily set ---
// Order is the order of the home tiles and of the "Next up" chain on end screens.

export interface DailyGameMeta {
  slug: DailyGameSlug;
  href: string;
  name: string;
  emoji: string;
  dot: string; // coloured circle used in share text, matching the logo
  tagline: string;
  max?: number;
  // Literal Tailwind classes (kept whole so the JIT picks them up)
  tile: string; // tile background + border
  accent: string; // text accent
  solid: string; // solid button / filled segment
  bar: string; // progress bar fill
}

export const DAILY_GAMES: DailyGameMeta[] = [
  {
    slug: "careerpath",
    dot: "🟣",
    href: "/careerpath",
    name: "Career Path",
    emoji: "🧭",
    tagline: "Five mystery players from their stats",
    max: 100,
    tile: "bg-gradient-to-br from-violet-600/35 via-violet-900/25 to-fuchsia-900/20 border-violet-400/30",
    accent: "text-violet-300",
    solid: "bg-violet-500 text-white",
    bar: "bg-violet-400",
  },
  {
    slug: "photofinish",
    dot: "🟡",
    href: "/photofinish",
    name: "Photo Finish",
    emoji: "📸",
    tagline: "Guess the season of ten match photos",
    max: 1000,
    tile: "bg-gradient-to-br from-amber-500/35 via-amber-900/25 to-orange-900/20 border-amber-400/30",
    accent: "text-amber-300",
    solid: "bg-amber-400 text-amber-950",
    bar: "bg-amber-400",
  },
  {
    slug: "centrecircle",
    dot: "🟢",
    href: "/centrecircle",
    name: "CentreCircle",
    emoji: "⚪",
    tagline: "Spell PL surnames from today's letters",
    tile: "bg-gradient-to-br from-emerald-500/35 via-emerald-900/25 to-teal-900/20 border-emerald-400/30",
    accent: "text-emerald-300",
    solid: "bg-emerald-400 text-emerald-950",
    bar: "bg-emerald-400",
  },
  {
    slug: "griddle",
    dot: "🔵",
    href: "/griddle",
    name: "Griddle",
    emoji: "🧩",
    tagline: "Name players who link today's clubs",
    tile: "bg-gradient-to-br from-sky-500/35 via-sky-900/25 to-blue-900/20 border-sky-400/30",
    accent: "text-sky-300",
    solid: "bg-sky-400 text-sky-950",
    bar: "bg-sky-400",
  },
];

export const DAILY_META = Object.fromEntries(DAILY_GAMES.map((g) => [g.slug, g])) as Record<DailyGameSlug, DailyGameMeta>;

// --- Dates ---

const IS_LOCAL = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);

/** Today's local date key, as the daily games use it (localhost honours ?day=). */
export function todayKey(): string {
  if (IS_LOCAL) {
    const day = new URLSearchParams(window.location.search).get("day");
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function shiftDay(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Which day's puzzles a daily game page shows: today's, or yesterday's set when opened with
 *  `?set=yesterday`. Yesterday's set is offered to brand-new players only and is just for fun:
 *  kept on the device, never on leaderboards, never counted for streaks or badges. */
export function puzzleDay(): { dateKey: string; late: boolean } {
  const today = todayKey();
  try {
    if (new URLSearchParams(window.location.search).get("set") === "yesterday") return { dateKey: shiftDay(today, -1), late: true };
  } catch { /* ignore */ }
  return { dateKey: today, late: false };
}

/** Link to a daily game, keeping you in yesterday's set if that's where you are. */
export const gameHref = (href: string, late: boolean) => (late ? `${href}?set=yesterday` : href);

/** Milliseconds until local midnight, when the next set unlocks. */
export function msToMidnight(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function formatCountdown(ms: number): string {
  const mins = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function useCountdown(): string {
  const [ms, setMs] = useState(msToMidnight);
  useEffect(() => {
    const id = setInterval(() => setMs(msToMidnight()), 20000);
    return () => clearInterval(id);
  }, []);
  return formatCountdown(ms);
}

// --- Today's progress (written by each daily game as it plays) ---

export interface DailyProgress {
  status: "playing" | "done";
  score: number;
  detail: string; // short line for the tile, e.g. "23/59 found"
  level?: string; // the game's own rank, e.g. "Captain"
  progress?: number; // 0..1 for a progress bar while playing
  count?: number; // what's been done: names found, photos guessed, players attempted
  startedAt?: number; // set on the first move, for time-to-finish analytics
  /** Still open but enough has been played for it to count for today (CentreCircle/Griddle) */
  counted?: boolean;
  /** Open-ended games: answers needed to complete today (the tile counts down to it) */
  goal?: number;
  /** Played as Yesterday's set (just for fun, never counts) */
  late?: boolean;
}

/** Finished, or played enough to count for today's set and streak. */
export const countsToday = (p?: DailyProgress) => p?.status === "done" || !!p?.counted;

export type DayProgress = Partial<Record<DailyGameSlug, DailyProgress>>;

const PROGRESS_EVENT = "pcb-daily-progress";
const progressKey = (username: string, dateKey: string) => `pcb-day-${username.toLowerCase()}-${dateKey}`;

export function readDay(username: string | undefined, dateKey: string): DayProgress {
  if (!username) return {};
  try {
    return JSON.parse(localStorage.getItem(progressKey(username, dateKey)) || "{}");
  } catch {
    return {};
  }
}

/** Called by each daily game whenever its state changes. Pass null when nothing has been played yet. */
export function recordDaily(username: string | undefined, game: DailyGameSlug, dateKey: string, p: DailyProgress | null) {
  if (!username) return;
  try {
    if (p) localStorage.setItem(playedKey(username, game), "1");
    const day = readDay(username, dateKey);
    const prev = day[game];
    if (p) {
      p = { ...p, startedAt: prev?.startedAt ?? (p.status === "playing" ? Date.now() : undefined), late: dateKey < todayKey() || undefined };
      trackTransition(game, prev, p, day, dateKey !== todayKey());
      day[game] = p;
    }
    else if (day[game]?.status !== "done") delete day[game];
    localStorage.setItem(progressKey(username, dateKey), JSON.stringify(day));
    window.dispatchEvent(new Event(PROGRESS_EVENT));
  } catch { /* ignore */ }
}

/** Analytics for a game moving between states. Only real play counts: a result restored
 *  from another device (never "playing" here) fires nothing. */
function trackTransition(game: DailyGameSlug, prev: DailyProgress | undefined, p: DailyProgress, day: DayProgress, late: boolean) {
  const base = { game, mode: late ? "yesterday" : "daily" };
  const seconds = p.startedAt ? Math.round((Date.now() - p.startedAt) / 1000) : undefined;
  if (!prev && p.status === "playing") trackEvent("game_start", base);
  const before = DAILY_GAMES.filter((g) => countsToday(day[g.slug])).length;
  const after = DAILY_GAMES.filter((g) => (g.slug === game ? countsToday(p) : countsToday(day[g.slug]))).length;
  if (prev?.status === "playing" && !prev.counted && p.status === "playing" && p.counted) {
    trackEvent("game_counted", { ...base, count: p.count, score: p.score, seconds, set_position: after });
  }
  if (prev?.status === "playing" && p.status === "done") {
    trackEvent("game_finish", {
      ...base,
      score: p.score,
      level: p.level,
      seconds,
      set_position: after, // 1st, 2nd… game done today
    });
  }
  if (before < DAILY_GAMES.length && after === DAILY_GAMES.length && prev) trackEvent("set_complete", { last_game: game, late });
}

/** Analytics when someone leaves a daily game without finishing it: how far they got, so
 *  "bored after round 1" can be told apart from "found 45 names and stopped". */
export function trackGameExit(username: string | undefined, game: DailyGameSlug, exitType: "navigate" | "hidden") {
  if (!username) return;
  const p = readDay(username, todayKey())[game];
  if (p?.status === "done") return; // finishes are game_finish
  trackEvent("game_exit", {
    game,
    mode: "daily",
    exit_type: exitType,
    status: p?.status ?? "not_started",
    progress_pct: p?.progress != null ? Math.round(p.progress * 100) : 0,
    count: p?.count ?? 0,
    score: p?.score ?? 0,
    level: p?.level,
    counted: p?.counted || undefined,
    seconds: p?.startedAt ? Math.round((Date.now() - p.startedAt) / 1000) : undefined,
  });
}

/** Today's progress on this device, kept live as games write to it. */
export function useDayProgress(username: string | undefined, dateKey: string): DayProgress {
  const [day, setDay] = useState<DayProgress>(() => readDay(username, dateKey));
  useEffect(() => {
    const update = () => setDay(readDay(username, dateKey));
    update();
    window.addEventListener(PROGRESS_EVENT, update);
    window.addEventListener("storage", update);
    window.addEventListener("focus", update);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, update);
      window.removeEventListener("storage", update);
      window.removeEventListener("focus", update);
    };
  }, [username, dateKey]);
  return day;
}

const playedKey = (username: string, game: DailyGameSlug) => `pcb-played-${username.toLowerCase()}-${game}`;

/** True once someone has played this game on any day, so the how-to-play intro can be skipped. */
export function hasPlayedBefore(username: string | undefined, game: DailyGameSlug): boolean {
  if (!username) return false;
  try {
    if (localStorage.getItem(playedKey(username, game))) return true;
    return readHistoryCache(username).some((e) => e.game === game);
  } catch {
    return false;
  }
}

// --- History (every finished daily game, from Firestore) ---

export interface DailyEntry {
  game: DailyGameSlug;
  dateKey: string;
  score: number;
  found?: number; // game-specific: players named, exact photos, names found
  total?: number;
  at?: number; // when it was submitted (ms)
  open?: boolean; // still being played (score saved as it goes)
  late?: boolean; // played the day after (Yesterday's set)
}

const historyKey = (username: string) => `pcb-dailyhist-${username.toLowerCase()}`;

function readHistoryCache(username: string | undefined): DailyEntry[] {
  if (!username) return [];
  try {
    return JSON.parse(localStorage.getItem(historyKey(username)) || "[]");
  } catch {
    return [];
  }
}

// One history fetch shared by every component on the page, refreshed at most every few minutes
// (today's own games come from local progress, so a slightly stale history is fine).
const HISTORY_TTL = 5 * 60 * 1000;
const historyFetches = new Map<string, { at: number; promise: Promise<DailyEntry[]> }>();

/** A guest's history: built from what they've played on this device. */
function localHistory(username: string): DailyEntry[] {
  const prefix = `pcb-day-${username.toLowerCase()}-`;
  const out: DailyEntry[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(prefix)) continue;
      const dateKey = k.slice(prefix.length);
      const day = JSON.parse(localStorage.getItem(k) || "{}") as DayProgress;
      for (const g of DAILY_GAMES) {
        const p = day[g.slug];
        if (countsToday(p) && !p!.late) out.push({ game: g.slug, dateKey, score: p!.score, found: p!.count, open: p!.status !== "done" || undefined });
      }
    }
  } catch { /* ignore */ }
  return out;
}

function fetchHistory(username: string): Promise<DailyEntry[]> {
  const key = username.toLowerCase();
  if (isGuestName(key)) return Promise.resolve(localHistory(key));
  const hit = historyFetches.get(key);
  if (hit && Date.now() - hit.at < HISTORY_TTL) return hit.promise;
  const promise = getDocs(query(collection(db, "daily-scores"), where("username", "==", key))).then((snap) => {
    // Offline, Firestore answers from its (often empty) local cache: keep what we have instead
    if (snap.metadata.fromCache) throw new Error("offline");
    const list: DailyEntry[] = [];
    snap.forEach((d) => {
      const x = d.data() as DailyEntry & { timestamp?: { toMillis?: () => number } };
      list.push({ game: x.game, dateKey: x.dateKey, score: x.score, found: x.found, total: x.total, at: x.timestamp?.toMillis?.(), open: x.open || undefined, late: x.late || undefined });
    });
    try { localStorage.setItem(historyKey(username), JSON.stringify(list)); } catch { /* ignore */ }
    return list;
  });
  promise.catch(() => historyFetches.delete(key));
  historyFetches.set(key, { at: Date.now(), promise });
  return promise;
}

/** Forget the cached history (after a late play or claiming a name) so the next read refetches. */
export function invalidateHistory(username?: string) {
  if (username) historyFetches.delete(username.toLowerCase());
  else historyFetches.clear();
}

/** All of a user's finished daily games, cached locally so the streak shows instantly. */
export function useDailyHistory(username: string | undefined): { entries: DailyEntry[]; loading: boolean } {
  const [entries, setEntries] = useState<DailyEntry[]>(() => readHistoryCache(username));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!username) return;
    setEntries(readHistoryCache(username));
    let cancelled = false;
    setLoading(true);
    fetchHistory(username)
      .then((list) => { if (!cancelled) setEntries(list); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [username]);

  return { entries, loading };
}

/** Today's progress, with games finished on another device (only in Firestore) marked done. */
export function withFinished(day: DayProgress, entries: DailyEntry[], dateKey: string): DayProgress {
  const view: DayProgress = { ...day };
  for (const e of entries) {
    if (e.dateKey !== dateKey || view[e.game]?.status === "done") continue;
    if (e.open) {
      // Saved while still being played: this device's own progress is newer, if it has any
      if (!view[e.game]) view[e.game] = { status: "playing", counted: true, score: e.score, detail: `${e.found ?? 0} found`, count: e.found };
    } else {
      view[e.game] = { status: "done", score: e.score, detail: "Finished" };
    }
  }
  return view;
}

/** History plus anything finished today on this device that hasn't reached Firestore (or localhost). */
export function mergeToday(entries: DailyEntry[], day: DayProgress, dateKey: string): DailyEntry[] {
  const out = [...entries];
  for (const g of DAILY_GAMES) {
    const p = day[g.slug];
    if (countsToday(p) && !out.some((e) => e.game === g.slug && e.dateKey === dateKey)) {
      out.push({ game: g.slug, dateKey, score: p!.score });
    }
  }
  return out;
}

export interface StreakInfo {
  current: number; // days in a row with at least one finished daily game
  best: number;
  daysPlayed: number;
  playedToday: boolean;
}

export function streakOf(entries: DailyEntry[], today: string): StreakInfo {
  const days = new Set(entries.map((e) => e.dateKey));
  const playedToday = days.has(today);
  // A streak stays alive until the end of the day after the last play
  let current = 0;
  let d = playedToday ? today : shiftDay(today, -1);
  while (days.has(d)) {
    current++;
    d = shiftDay(d, -1);
  }
  let best = 0;
  let run = 0;
  let prev = "";
  for (const day of [...days].sort()) {
    run = prev && shiftDay(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return { current, best, daysPlayed: days.size, playedToday };
}

const streakCacheKey = (username: string) => `pcb-streak-${username.toLowerCase()}`;

/** Streak for the signed-in user; also cached so the badge on game pages can show it without a fetch. */
export function useStreak(username: string | undefined) {
  const today = todayKey();
  const { entries, loading } = useDailyHistory(username);
  const day = useDayProgress(username, today);
  const all = mergeToday(entries, day, today);
  const info = streakOf(all, today);
  const view = withFinished(day, entries, today);
  useEffect(() => {
    if (username) try { localStorage.setItem(streakCacheKey(username), String(info.current)); } catch { /* ignore */ }
  }, [username, info.current]);
  return { ...info, entries: all, day, view, today, loading };
}

export function cachedStreak(username: string | undefined): number {
  if (!username) return 0;
  try {
    return Number(localStorage.getItem(streakCacheKey(username)) || 0);
  } catch {
    return 0;
  }
}

// --- Today's leaderboard positions ---

export type TodayRanks = Partial<Record<DailyGameSlug, { rank: number; of: number }>>;

const RANK_TTL = 10 * 60 * 1000;
const rankKey = (username: string, dateKey: string, game: DailyGameSlug) => `pcb-rank-${username.toLowerCase()}-${dateKey}-${game}`;

/** Position on one game's daily board: two count queries (needs the dateKey+game+score index),
 *  falling back to reading that game's scores for the day if the index isn't there. */
async function fetchRank(dateKey: string, game: DailyGameSlug, score: number): Promise<{ rank: number; of: number }> {
  const base = [where("dateKey", "==", dateKey), where("game", "==", game)];
  try {
    const [above, total] = await Promise.all([
      getCountFromServer(query(collection(db, "daily-scores"), ...base, where("score", ">", score))),
      getCountFromServer(query(collection(db, "daily-scores"), ...base)),
    ]);
    return { rank: above.data().count + 1, of: total.data().count };
  } catch {
    const snap = await getDocs(query(collection(db, "daily-scores"), ...base));
    if (snap.metadata.fromCache) throw new Error("offline");
    let above = 0;
    snap.forEach((d) => { if ((d.data() as { score: number }).score > score) above++; });
    return { rank: above + 1, of: snap.size };
  }
}

/** Where the user sits on today's board for each game they've finished, cached for a few minutes. */
export function useTodayRanks(username: string | undefined, dateKey: string, view: DayProgress): TodayRanks {
  const [ranks, setRanks] = useState<TodayRanks>({});
  const done = DAILY_GAMES.filter((g) => countsToday(view[g.slug])).map((g) => [g.slug, view[g.slug]!.score] as const);
  const sig = done.map(([g, sc]) => `${g}:${sc}`).join(",");

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    (async () => {
      const out: TodayRanks = {};
      await Promise.all(done.map(async ([game, score]) => {
        const k = rankKey(username, dateKey, game);
        try {
          const c = JSON.parse(localStorage.getItem(k) || "null");
          if (c && c.score === score && Date.now() - c.at < RANK_TTL) { out[game] = { rank: c.rank, of: c.of }; return; }
        } catch { /* ignore */ }
        try {
          const r = await fetchRank(dateKey, game, score);
          if (r.of === 0) return; // nothing to rank against (e.g. offline)
          if (isGuestName(username)) r.of += 1; // a guest isn't on the board: count them in
          out[game] = r;
          try { localStorage.setItem(k, JSON.stringify({ ...r, score, at: Date.now() })); } catch { /* ignore */ }
        } catch { /* ignore */ }
      }));
      if (!cancelled) setRanks(out);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, dateKey, sig]);

  return ranks;
}

// --- Sharing the day ---

export function dayShareText(day: DayProgress, streak: number, dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const lines = DAILY_GAMES.map((g) => {
    const p = day[g.slug];
    if (!countsToday(p)) return `${g.dot} ${g.name} —`;
    return `${g.dot} ${g.name} ${p!.score.toLocaleString()}${g.max ? `/${g.max}` : ""}`;
  });
  const done = DAILY_GAMES.filter((g) => countsToday(day[g.slug])).length;
  return [
    `drapk.in daily · ${date}`,
    "",
    ...lines,
    "",
    `${done === DAILY_GAMES.length ? "✅ Set complete" : `${done}/${DAILY_GAMES.length} done`}${streak > 1 ? ` · 🔥 ${streak}-day streak` : ""}`,
    shareLink("/", "day"),
  ].join("\n");
}

/** Native share sheet on phones, clipboard elsewhere. Resolves true if copied to the clipboard. */
export async function shareText(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.share && !window.matchMedia("(pointer: fine)").matches) {
    try {
      await navigator.share({ text });
      return false;
    } catch { /* fall through to copy */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
