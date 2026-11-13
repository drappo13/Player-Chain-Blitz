import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { isGuestName } from "./guest";
import type { GameSlug } from "./save-score";

export interface LeaderboardEntry {
  username: string;
  avatar: string;
  score: number;
  /** Number of plays (only used for global leaderboard) */
  plays?: number;
}

export type LeaderboardPeriod = "today" | "alltime";

// These read every score for a game (or every arcade score, for the global board), so results
// are kept on the device: 6 hours for all-time boards, 30 minutes for today's. Finishing an
// arcade game clears it (saveScore), and end screens / manual refreshes always fetch fresh.
export const LB_CACHE_KEY = "pcb-lb-cache";
type LbCache = Record<string, { at: number; entries: LeaderboardEntry[] }>;

function readLbCache(): LbCache {
  try { return JSON.parse(localStorage.getItem(LB_CACHE_KEY) || "{}"); } catch { return {}; }
}

async function cached(key: string, fresh: boolean, load: () => Promise<LeaderboardEntry[]>): Promise<LeaderboardEntry[]> {
  const ttl = key.includes(":today:") ? 30 * 60 * 1000 : 6 * 60 * 60 * 1000;
  const hit = readLbCache()[key];
  if (!fresh && hit && Date.now() - hit.at < ttl) return hit.entries;
  const entries = await load();
  try { localStorage.setItem(LB_CACHE_KEY, JSON.stringify({ ...readLbCache(), [key]: { at: Date.now(), entries } })); } catch { /* ignore */ }
  return entries;
}

/**
 * Fetch top scores for a specific game.
 * Uses only equality filters to avoid needing composite Firestore indexes.
 * Sorting + dedup is done client-side.
 */
async function fetchGameLeaderboard(
  game: GameSlug,
  period: LeaderboardPeriod,
  max: number,
): Promise<LeaderboardEntry[]> {
  // Simple equality query — no composite index needed
  const q = query(
    collection(db, "scores"),
    where("game", "==", game),
  );

  const snap = await getDocs(q);

  const startOfDay = period === "today"
    ? (() => {
        const now = new Date();
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      })()
    : null;

  // Keep only the best score per username, filtering by period client-side
  const bestByUser = new Map<string, number>();
  snap.forEach((d) => {
    const data = d.data() as { username: string; score: number; timestamp?: Timestamp };
    if (isGuestName(data.username)) return; // guests aren't on the leaderboards
    if (startOfDay && data.timestamp) {
      const docDate = data.timestamp.toDate();
      if (docDate < startOfDay) return;
    }
    const existing = bestByUser.get(data.username);
    if (!existing || data.score > existing) {
      bestByUser.set(data.username, data.score);
    }
  });

  // Sort and take top N
  const sorted = [...bestByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max);

  // Fetch avatars for the top users
  const avatarMap = await fetchAvatars(sorted.map(([u]) => u));

  return sorted.map(([username, score]) => ({
    username,
    avatar: avatarMap.get(username) || "\u26bd",
    score,
  }));
}

/**
 * Fetch global leaderboard: most plays or highest total score.
 * Fetches all scores and aggregates client-side.
 */
async function fetchGlobalLeaderboard(
  mode: "plays" | "points",
  period: LeaderboardPeriod,
  max: number,
): Promise<LeaderboardEntry[]> {
  // Fetch all scores — no index needed
  const q = query(collection(db, "scores"));

  const snap = await getDocs(q);

  const startOfDay = period === "today"
    ? (() => {
        const now = new Date();
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      })()
    : null;

  const userStats = new Map<string, { plays: number; totalScore: number }>();
  snap.forEach((d) => {
    const data = d.data() as { username: string; score: number; timestamp?: Timestamp };
    if (isGuestName(data.username)) return; // guests aren't on the leaderboards
    if (startOfDay && data.timestamp) {
      const docDate = data.timestamp.toDate();
      if (docDate < startOfDay) return;
    }
    const existing = userStats.get(data.username) || { plays: 0, totalScore: 0 };
    existing.plays += 1;
    existing.totalScore += data.score;
    userStats.set(data.username, existing);
  });

  const entries = [...userStats.entries()]
    .map(([username, stats]) => ({
      username,
      value: mode === "plays" ? stats.plays : stats.totalScore,
      plays: stats.plays,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, max);

  const avatarMap = await fetchAvatars(entries.map((e) => e.username));

  return entries.map((e) => ({
    username: e.username,
    avatar: avatarMap.get(e.username) || "\u26bd",
    score: e.value,
    plays: e.plays,
  }));
}

/** Batch-fetch avatars from the users collection */
async function fetchAvatars(usernames: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const promises = usernames.map(async (u) => {
    try {
      const snap = await getDoc(doc(db, "users", u.toLowerCase()));
      if (snap.exists()) {
        const data = snap.data() as { avatar?: string };
        if (data.avatar) map.set(u, data.avatar);
      }
    } catch {
      // Silent — fallback to default avatar
    }
  });
  await Promise.all(promises);
  return map;
}

/** Hook: per-game leaderboard.
 *  Pass `delay` (ms) to wait before fetching — useful on end screens
 *  so the score write has time to land before we query. */
export function useGameLeaderboard(
  game: GameSlug,
  period: LeaderboardPeriod,
  max = 10,
  delay = 0,
) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const doFetch = () => {
      cached(`game:${game}:${period}:${max}`, delay > 0 || refreshKey > 0, () => fetchGameLeaderboard(game, period, max)).then((data) => {
        if (!cancelled) {
          setEntries(data);
          setLoading(false);
        }
      }).catch(() => {
        if (!cancelled) setLoading(false);
      });
    };

    if (delay > 0) {
      const timer = setTimeout(doFetch, delay);
      return () => { cancelled = true; clearTimeout(timer); };
    }

    doFetch();
    return () => { cancelled = true; };
  }, [game, period, max, delay, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { entries, loading, refresh };
}

/** Hook: global leaderboard (plays or total points) */
export function useGlobalLeaderboard(
  mode: "plays" | "points",
  period: LeaderboardPeriod,
  max = 10,
) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cached(`global:${mode}:${period}:${max}`, refreshKey > 0, () => fetchGlobalLeaderboard(mode, period, max)).then((data) => {
      if (!cancelled) {
        setEntries(data);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [mode, period, max, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { entries, loading, refresh };
}
