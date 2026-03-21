import { useState, useEffect, useCallback } from "react";
import { fetchDailyLeaderboard, type DailyGameSlug } from "./daily-score";
import type { LeaderboardEntry } from "./use-leaderboard";

export type DailyPeriod = "today" | "yesterday";

function getDateKey(period: DailyPeriod): string {
  const now = new Date();
  if (period === "yesterday") {
    now.setDate(now.getDate() - 1);
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function useDailyLeaderboard(
  game: DailyGameSlug,
  period: DailyPeriod,
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
      const dateKey = getDateKey(period);
      fetchDailyLeaderboard(game, dateKey, max)
        .then((data) => {
          if (!cancelled) {
            setEntries(data.map((e) => ({ username: e.username, avatar: e.avatar, score: e.score })));
            setLoading(false);
          }
        })
        .catch(() => {
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
