import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export type DailyGameSlug = "griddle";

export interface DailyScoreDoc {
  username: string;
  game: DailyGameSlug;
  dateKey: string; // "YYYY-MM-DD"
  score: number;
  found: number; // number of players found
  total: number; // total valid answers
  timestamp: unknown; // serverTimestamp
}

/** Deterministic doc ID to avoid composite index queries */
function docId(username: string, game: DailyGameSlug, dateKey: string): string {
  return `${game}_${dateKey}_${username.toLowerCase()}`;
}

/** Check if a user has already submitted for a given day+game */
export async function hasDailySubmission(
  username: string,
  game: DailyGameSlug,
  dateKey: string,
): Promise<{ submitted: boolean; score: number; found: number; total: number }> {
  try {
    const snap = await getDoc(doc(db, "daily-scores", docId(username, game, dateKey)));
    if (snap.exists()) {
      const data = snap.data() as DailyScoreDoc;
      return { submitted: true, score: data.score, found: data.found, total: data.total };
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
): Promise<boolean> {
  if (!username || score < 0) return false;
  try {
    const id = docId(username, game, dateKey);
    const existing = await getDoc(doc(db, "daily-scores", id));
    if (existing.exists()) return false;

    await setDoc(doc(db, "daily-scores", id), {
      username: username.toLowerCase(),
      game,
      dateKey,
      score,
      found,
      total,
      timestamp: serverTimestamp(),
    });
    return true;
  } catch {
    return false;
  }
}

/** Fetch daily leaderboard for a specific game + date.
 *  Uses a single-field query (dateKey) to avoid composite indexes. */
export async function fetchDailyLeaderboard(
  game: DailyGameSlug,
  dateKey: string,
  max: number,
): Promise<{ username: string; avatar: string; score: number; found: number }[]> {
  try {
    // Query by dateKey only — filter game client-side to avoid composite index
    const q = query(
      collection(db, "daily-scores"),
      where("dateKey", "==", dateKey),
    );
    const snap = await getDocs(q);

    const entries: { username: string; score: number; found: number }[] = [];
    snap.forEach((d) => {
      const data = d.data() as DailyScoreDoc;
      if (data.game === game) {
        entries.push({ username: data.username, score: data.score, found: data.found });
      }
    });

    entries.sort((a, b) => b.score - a.score);
    const top = entries.slice(0, max);

    // Fetch avatars
    const avatarMap = new Map<string, string>();
    await Promise.all(
      top.map(async (e) => {
        try {
          const snap = await getDoc(doc(db, "users", e.username.toLowerCase()));
          if (snap.exists()) {
            const data = snap.data() as { avatar?: string };
            if (data.avatar) avatarMap.set(e.username, data.avatar);
          }
        } catch { /* silent */ }
      }),
    );

    return top.map((e) => ({
      ...e,
      avatar: avatarMap.get(e.username) || "\u26bd",
    }));
  } catch {
    return [];
  }
}
