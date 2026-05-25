import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { GameSlug } from "./save-score";

const ANON_ID_KEY = "pcb-anon-id";

function getOrCreateAnonId(): string {
  try {
    const existing = localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(ANON_ID_KEY, id);
    return id;
  } catch {
    return "anon-unknown";
  }
}

export async function saveQuizPlay(
  gameId: GameSlug,
  score: number,
  username: string | null,
): Promise<void> {
  try {
    await addDoc(collection(db, "quiz_plays"), {
      anonId: getOrCreateAnonId(),
      gameId,
      score,
      username: username ? username.toLowerCase() : null,
      completedAt: serverTimestamp(),
    });
  } catch {
    // Silent failure — analytics shouldn't break the game
  }
}
