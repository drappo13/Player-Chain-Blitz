import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  setDoc,
  serverTimestamp,
  doc,
  getDoc,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";
import { isGuestName, queuePending, logGuestPlay, IS_LOCALHOST } from "./guest";

export type DailyGameSlug = "griddle" | "centrecircle" | "photofinish" | "careerpath";

export interface DailyScoreDoc {
  username: string;
  game: DailyGameSlug;
  dateKey: string; // "YYYY-MM-DD"
  score: number;
  found: number; // number of players found
  total: number; // total valid answers
  /** Composite key for easy single-field lookups: game_dateKey_username */
  key: string;
  /** JSON of the game's saved state at submission, so another device can show the full results */
  state?: string;
  /** Played after its day (Yesterday's set): counts for streaks, kept off the leaderboards */
  late?: boolean;
  /** Saved while still being played (CentreCircle/Griddle); the score can only go up until Finish */
  open?: boolean;
  timestamp: unknown; // serverTimestamp
}

function makeKey(username: string, game: DailyGameSlug, dateKey: string): string {
  return `${game}_${dateKey}_${username.toLowerCase()}`;
}

/** Check if a user has already submitted for a given day+game */
export async function hasDailySubmission(
  username: string,
  game: DailyGameSlug,
  dateKey: string,
): Promise<{ submitted: boolean; score: number; found: number; total: number; state?: unknown }> {
  if (isGuestName(username)) return { submitted: false, score: 0, found: 0, total: 0 };
  try {
    const k = makeKey(username, game, dateKey);
    const q = query(
      collection(db, "daily-scores"),
      where("key", "==", k),
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const data = snap.docs[0].data() as DailyScoreDoc;
      if (data.open) return { submitted: false, score: 0, found: 0, total: 0 };
      let state: unknown;
      try { state = data.state ? JSON.parse(data.state) : undefined; } catch { /* ignore */ }
      return { submitted: true, score: data.score, found: data.found, total: data.total, state };
    }
  } catch { /* silent */ }
  return { submitted: false, score: 0, found: 0, total: 0 };
}

/** Submit a daily score. Returns false if already submitted. */
export async function submitDailyScore(
  username: string,
  game: DailyGameSlug,
  dateKey: string,
  score: number,
  found: number,
  total: number,
  state?: unknown,
  opts: { late?: boolean } = {},
): Promise<boolean> {
  if (!username || score < 0) return false;
  // Guests: keep it for when they pick a name, and log an anonymous play for the stats page
  if (isGuestName(username)) {
    queuePending({ kind: "daily", game, dateKey, score, found, total, state, late: opts.late });
    logGuestPlay(username, game, dateKey, score, opts.late);
    return true;
  }
  if (IS_LOCALHOST) return true;
  try {
    const k = makeKey(username, game, dateKey);

    // Check for existing submission
    const existing = await hasDailySubmission(username, game, dateKey);
    if (existing.submitted) return false;

    const doc = {
      username: username.toLowerCase(),
      game,
      dateKey,
      score,
      found,
      total,
      key: k,
      timestamp: serverTimestamp(),
      ...(opts.late ? { late: true } : {}),
    };
    try {
      await addDoc(collection(db, "daily-scores"), state === undefined ? doc : { ...doc, state: JSON.stringify(state) });
    } catch (e) {
      // If the extra field is ever rejected, still save the score
      if (state === undefined) throw e;
      await addDoc(collection(db, "daily-scores"), doc);
    }
    return true;
  } catch {
    return false;
  }
}

// --- Save as you go (CentreCircle, Griddle) ---
// Once a game counts for today its score is written and kept up to date as it rises (at most every
// 15s, plus when the page is hidden). The doc id is the key, so later saves update the same doc;
// Firestore rules only let an open doc's score go up. Finish writes it one last time with open: false.

type LiveArgs = { username: string; game: DailyGameSlug; dateKey: string; score: number; found: number; total: number; state?: unknown; late?: boolean };
const LIVE_EVERY = 15000;
const live = new Map<string, { args: LiveArgs; last: number; timer?: ReturnType<typeof setTimeout> }>();

async function writeLive(a: LiveArgs, final: boolean): Promise<boolean> {
  if (isGuestName(a.username)) {
    queuePending({ kind: "daily", game: a.game, dateKey: a.dateKey, score: a.score, found: a.found, total: a.total, state: a.state, late: a.late });
    logGuestPlay(a.username, a.game, a.dateKey, a.score, a.late);
    return true;
  }
  if (IS_LOCALHOST) return true;
  const k = makeKey(a.username, a.game, a.dateKey);
  const data = {
    username: a.username.toLowerCase(), game: a.game, dateKey: a.dateKey, score: a.score, found: a.found, total: a.total,
    key: k, timestamp: serverTimestamp(), open: !final,
    ...(a.state === undefined ? {} : { state: JSON.stringify(a.state) }),
    ...(a.late ? { late: true } : {}),
  };
  try {
    await setDoc(doc(db, "daily-scores", k), data);
    return true;
  } catch {
    return false;
  }
}

function flushLive(k: string) {
  const e = live.get(k);
  if (!e) return;
  if (e.timer) clearTimeout(e.timer);
  e.timer = undefined;
  e.last = Date.now();
  writeLive(e.args, false);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") for (const [k, e] of live) if (e.timer) flushLive(k);
  });
}

/** Called on every change once the game counts for today: saves now, then at most every 15s. */
export function saveLiveScore(a: LiveArgs) {
  const k = makeKey(a.username, a.game, a.dateKey);
  const e = live.get(k);
  if (!e) { live.set(k, { args: a, last: Date.now() }); writeLive(a, false); return; }
  e.args = a;
  if (e.timer) return;
  const wait = Math.max(0, LIVE_EVERY - (Date.now() - e.last));
  e.timer = setTimeout(() => flushLive(k), wait);
}

/** Finish: the final score, and the game is closed. */
export async function finishLiveScore(a: LiveArgs): Promise<boolean> {
  const k = makeKey(a.username, a.game, a.dateKey);
  const e = live.get(k);
  if (e?.timer) clearTimeout(e.timer);
  live.delete(k);
  return writeLive(a, true);
}

// Avatars rarely change, so remember them (in memory and on the device) instead of
// fetching each top player's user doc on every leaderboard load.
const AVATARS_KEY = "pcb-avatars";
const avatarCache: Map<string, string> = (() => {
  try { return new Map(Object.entries(JSON.parse(localStorage.getItem(AVATARS_KEY) || "{}"))); } catch { return new Map(); }
})();

export async function avatarsFor(usernames: string[]): Promise<Map<string, string>> {
  const missing = usernames.filter((u) => !avatarCache.has(u));
  if (missing.length) {
    await Promise.all(missing.map(async (u) => {
      try {
        const snap = await getDoc(doc(db, "users", u.toLowerCase()));
        const avatar = snap.exists() ? (snap.data() as { avatar?: string }).avatar : undefined;
        if (avatar) avatarCache.set(u, avatar);
      } catch { /* silent */ }
    }));
    try { localStorage.setItem(AVATARS_KEY, JSON.stringify(Object.fromEntries(avatarCache))); } catch { /* ignore */ }
  }
  return avatarCache;
}

type Row = { id: string; username: string; score: number; found: number; late?: boolean };

/** Top scores for one game on one day. Uses the dateKey+game+score index to read only the top
 *  rows; without it, reads that game's scores for the day and sorts them here. */
async function topRows(game: DailyGameSlug, dateKey: string, max: number): Promise<Row[]> {
  const base = [where("dateKey", "==", dateKey), where("game", "==", game)];
  const toRow = (d: { id: string; data: () => unknown }): Row => {
    const x = d.data() as DailyScoreDoc;
    return { id: d.id, username: x.username, score: x.score, found: x.found, late: x.late };
  };
  let rows: Row[];
  try {
    const snap = await getDocs(query(collection(db, "daily-scores"), ...base, orderBy("score", "desc"), limit(max)));
    rows = snap.docs.map(toRow);
  } catch {
    const snap = await getDocs(query(collection(db, "daily-scores"), ...base));
    rows = snap.docs.map(toRow);
  }
  // Yesterday's-set plays don't go on the boards. Ties in document order, as before
  return rows.filter((r) => !r.late).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1)).slice(0, max);
}

/** Fetch daily leaderboard for a specific game + date */
export async function fetchDailyLeaderboard(
  game: DailyGameSlug,
  dateKey: string,
  max: number,
): Promise<{ username: string; avatar: string; score: number; found: number }[]> {
  try {
    const top = await topRows(game, dateKey, max);
    const avatars = await avatarsFor(top.map((e) => e.username));
    return top.map(({ username, score, found }) => ({
      username,
      score,
      found,
      avatar: avatars.get(username) || "\u26bd",
    }));
  } catch {
    return [];
  }
}
