import { useState, useCallback } from "react";
import { useGameStats } from "@/lib/use-user-stats";
import type { GameSlug } from "@/lib/save-score";

interface UseHighScoreReturn {
  effectiveHighScore: number;
  totalPlays: number;
  checkAndUpdate: (score: number) => void;
  refreshStats: () => void;
}

export function useHighScore(
  sessionKey: string,
  gameSlug: GameSlug,
  username: string | undefined,
): UseHighScoreReturn {
  const [localHighScore, setLocalHighScore] = useState(() => {
    try {
      return parseInt(sessionStorage.getItem(sessionKey) || "0");
    } catch {
      return 0;
    }
  });

  const {
    highScore: firebaseHighScore,
    plays: totalPlays,
    refresh: refreshStats,
  } = useGameStats(username, gameSlug);

  const effectiveHighScore = Math.max(localHighScore, firebaseHighScore);

  const checkAndUpdate = useCallback(
    (score: number) => {
      if (score > localHighScore) {
        setLocalHighScore(score);
        try {
          sessionStorage.setItem(sessionKey, score.toString());
        } catch {}
      }
      refreshStats();
    },
    [localHighScore, sessionKey, refreshStats],
  );

  return { effectiveHighScore, totalPlays, checkAndUpdate, refreshStats };
}
