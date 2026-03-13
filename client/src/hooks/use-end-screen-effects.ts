import { useEffect } from "react";
import { playHighScore, playGameEnd } from "@/lib/sounds";
import { saveScore, type GameSlug } from "@/lib/save-score";

export function useEndScreenEffects(opts: {
  isNewHighScore: boolean;
  gameSlug: GameSlug;
  score: number;
  username: string | undefined;
}) {
  useEffect(() => {
    if (opts.isNewHighScore) {
      playHighScore();
    } else {
      playGameEnd();
    }
    saveScore(opts.username, opts.gameSlug, opts.score);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
