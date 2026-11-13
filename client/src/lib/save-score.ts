import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, trackEvent } from "./firebase";
import { isGuestName, WRITES_ENABLED } from "./guest";

export type GameSlug =
  | "goalchain"
  | "slamchain"
  | "targetman"
  | "gridlock"
  | "overlap"
  | "clubladder"
  | "griddle"
  | "centrecircle"
  | "photofinish"
  | "careerpath"
  | "arsenal-champions-2026";

export async function saveScore(
  username: string | undefined,
  game: GameSlug,
  score: number,
): Promise<void> {
  if (!username || score <= 0) return;
  // The Champions quiz logs its own finish (it can be played signed out)
  if (game !== "arsenal-champions-2026") trackEvent("game_finish", { game, mode: "arcade", score, guest: isGuestName(username) || undefined });
  if (!WRITES_ENABLED) return;
  try {
    await addDoc(collection(db, "scores"), {
      username: username.toLowerCase(),
      game,
      score,
      timestamp: serverTimestamp(),
      ...(isGuestName(username) ? { guest: true } : {}),
    });
    // Your new score should show on the leaderboards straight away
    try { localStorage.removeItem("pcb-lb-cache"); } catch { /* ignore */ }
  } catch {
    // Silent failure — never break the game experience
  }
}
