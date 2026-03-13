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
import type { GameSlug } from "./save-score";

export interface LeaderboardEntry {
  username: string;
  avatar: string;
  score: number;
  /** Number of plays (only used for global leaderboard) */
  plays?: number;
}

export type LeaderboardPeriod = "today" | "alltime";

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

/** Hook: per-game leaderboard */
export function useGameLeaderboard(
  game: GameSlug,
  period: LeaderboardPeriod,
  max = 10,
) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchGameLeaderboard(game, period, max).then((data) => {
      if (!cancelled) {
        setEntries(data);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [game, period, max, refreshKey]);

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
    fetchGlobalLeaderboard(mode, period, max).then((data) => {
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
