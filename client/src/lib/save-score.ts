import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

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
  try {
    await addDoc(collection(db, "scores"), {
      username: username.toLowerCase(),
      game,
      score,
      timestamp: serverTimestamp(),
    });
    // Your new score should show on the leaderboards straight away
    try { localStorage.removeItem("pcb-lb-cache"); } catch { /* ignore */ }
  } catch {
    // Silent failure — never break the game experience
  }
}
