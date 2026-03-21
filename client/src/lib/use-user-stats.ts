import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import type { GameSlug } from "./save-score";

export interface GameStats {
  highScore: number;
  plays: number;
}

export type UserStats = Record<GameSlug, GameStats>;

const EMPTY_STATS: GameStats = { highScore: 0, plays: 0 };

const ALL_GAMES: GameSlug[] = [
  "goalchain",
  "slamchain",
  "targetman",
  "gridlock",
  "overlap",
  "clubladder",
  "griddle",
];

const CACHE_KEY_PREFIX = "pcb-stats-";

function makeEmpty(): UserStats {
  return Object.fromEntries(ALL_GAMES.map((g) => [g, { ...EMPTY_STATS }])) as UserStats;
}

/** Read cached stats from localStorage — instant, no network */
function readCache(username: string): UserStats | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + username.toLowerCase());
    if (!raw) return null;
    return JSON.parse(raw) as UserStats;
  } catch {
    return null;
  }
}

/** Write stats to localStorage for instant future loads */
function writeCache(username: string, stats: UserStats) {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + username.toLowerCase(), JSON.stringify(stats));
  } catch {
    // Quota exceeded or private browsing — ignore
  }
}

export function useUserStats(username: string | undefined): {
  stats: UserStats;
  loading: boolean;
  refresh: () => void;
} {
  const [stats, setStats] = useState<UserStats>(() => {
    // Initialize from cache immediately — no layout shift
    if (username) {
      const cached = readCache(username);
      if (cached) return cached;
    }
    return makeEmpty();
  });
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!username) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const q = query(
          collection(db, "scores"),
          where("username", "==", username.toLowerCase()),
        );
        const snap = await getDocs(q);

        const result = makeEmpty();

        snap.forEach((doc) => {
          const d = doc.data() as { game: GameSlug; score: number };
          const entry = result[d.game];
          if (entry) {
            entry.plays += 1;
            if (d.score > entry.highScore) entry.highScore = d.score;
          }
        });

        if (!cancelled) {
          setStats(result);
          writeCache(username, result);
        }
      } catch {
        // Silent failure — stats are non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [username, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { stats, loading, refresh };
}

/** Single-game convenience hook — returns highScore + plays for one game */
export function useGameStats(username: string | undefined, game: GameSlug): {
  highScore: number;
  plays: number;
  loading: boolean;
  refresh: () => void;
} {
  const { stats, loading, refresh } = useUserStats(username);
  const entry = stats[game];
  return { highScore: entry.highScore, plays: entry.plays, loading, refresh };
}
