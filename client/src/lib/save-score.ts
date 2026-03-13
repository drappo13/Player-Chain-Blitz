import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export type GameSlug =
  | "goalchain"
  | "slamchain"
  | "targetman"
  | "gridlock"
  | "overlap"
  | "clubladder";

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
  } catch {
    // Silent failure — never break the game experience
  }
}
