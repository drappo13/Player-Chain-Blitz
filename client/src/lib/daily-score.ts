import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";

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
  try {
    const k = makeKey(username, game, dateKey);
    const q = query(
      collection(db, "daily-scores"),
      where("key", "==", k),
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const data = snap.docs[0].data() as DailyScoreDoc;
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
): Promise<boolean> {
  if (!username || score < 0) return false;
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

// Avatars rarely change, so remember them (in memory and on the device) instead of
// fetching each top player's user doc on every leaderboard load.
const AVATARS_KEY = "pcb-avatars";
const avatarCache: Map<string, string> = (() => {
  try { return new Map(Object.entries(JSON.parse(localStorage.getItem(AVATARS_KEY) || "{}"))); } catch { return new Map(); }
})();

async function avatarsFor(usernames: string[]): Promise<Map<string, string>> {
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

type Row = { id: string; username: string; score: number; found: number };

/** Top scores for one game on one day. Uses the dateKey+game+score index to read only the top
 *  rows; without it, reads that game's scores for the day and sorts them here. */
async function topRows(game: DailyGameSlug, dateKey: string, max: number): Promise<Row[]> {
  const base = [where("dateKey", "==", dateKey), where("game", "==", game)];
  const toRow = (d: { id: string; data: () => unknown }): Row => {
    const x = d.data() as DailyScoreDoc;
    return { id: d.id, username: x.username, score: x.score, found: x.found };
  };
  let rows: Row[];
  try {
    const snap = await getDocs(query(collection(db, "daily-scores"), ...base, orderBy("score", "desc"), limit(max)));
    rows = snap.docs.map(toRow);
  } catch {
    const snap = await getDocs(query(collection(db, "daily-scores"), ...base));
    rows = snap.docs.map(toRow);
  }
  // Ties in document order, as before
  return rows.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1)).slice(0, max);
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
