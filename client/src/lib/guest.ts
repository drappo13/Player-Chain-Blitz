import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, trackEvent } from "./firebase";

// Guest play: first-time visitors play straight away as "Guest". Everything is kept
// on the device; leaderboard writes are queued and sent when they pick a name (claim).
// Guest usernames contain a hyphen, which real usernames can't, so they never collide.

export interface GuestUser { username: string; avatar: string; guest: true }

const GUEST_KEY = "pcb-guest";
const PENDING_KEY = "pcb-pending";

/** Test builds on this machine never write scores to the real leaderboards. */
export const IS_LOCALHOST = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);

export const isGuestName = (name?: string | null) => !!name && name.toLowerCase().startsWith("guest-");

/** Name to show for anyone: guests get their animal, everyone else their username. */
export const displayName = (u: { username: string } | null | undefined) =>
  !u ? "" : isGuestName(u.username) ? "Guest" : u.username;

export function readGuest(): GuestUser | null {
  try {
    const g = JSON.parse(localStorage.getItem(GUEST_KEY) || "null");
    return g && isGuestName(g.username) ? { ...g, guest: true } : null;
  } catch { return null; }
}

export function getOrCreateGuest(): GuestUser {
  const existing = readGuest();
  if (existing) return existing;
  const id = Math.random().toString(36).slice(2, 10);
  const g: GuestUser = { username: `guest-${id}`, avatar: "\uD83D\uDC64", guest: true };
  try { localStorage.setItem(GUEST_KEY, JSON.stringify(g)); } catch { /* ignore */ }
  trackEvent("guest_start", { path: window.location.pathname });
  return g;
}

export function clearGuest() {
  try { localStorage.removeItem(GUEST_KEY); } catch { /* ignore */ }
}

// --- Writes a guest made, waiting for a name ---

export type Pending =
  | { kind: "daily"; game: string; dateKey: string; score: number; found: number; total: number; state?: unknown; late?: boolean }
  | { kind: "arcade"; game: string; score: number };

export function readPending(): Pending[] {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); } catch { return []; }
}

export function queuePending(p: Pending) {
  const list = readPending().filter((x) => !(x.kind === "daily" && p.kind === "daily" && x.game === p.game && x.dateKey === p.dateKey));
  list.push(p);
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-60))); } catch { /* ignore */ }
}

export function clearPending() {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
}

/** Number of daily games a guest has finished (for the claim prompt and analytics). */
export const guestGamesFinished = () => readPending().filter((p) => p.kind === "daily").length;

/** One small anonymous record per finished guest game, so /stats can count guest players. */
export function logGuestPlay(guest: string, game: string, dateKey: string, score: number, late?: boolean) {
  const flag = `pcb-guestplay-${guest.toLowerCase()}-${game}-${dateKey}`;
  try { if (localStorage.getItem(flag)) return; localStorage.setItem(flag, "1"); } catch { /* ignore */ }
  if (IS_LOCALHOST) return;
  addDoc(collection(db, "guest-plays"), { guest: guest.toLowerCase(), game, dateKey, score, late: !!late, at: serverTimestamp() }).catch(() => {});
}

/** After a guest picks (or logs into) a name: move everything stored under the guest name to it.
 *  Never overwrites something the account already has on this device. */
export function migrateGuestKeys(guest: string, username: string) {
  const from = guest.toLowerCase();
  const to = username.toLowerCase();
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.includes(from) && k !== GUEST_KEY) keys.push(k);
    }
    for (const k of keys) {
      const nk = k.split(from).join(to);
      const v = localStorage.getItem(k);
      if (v != null && localStorage.getItem(nk) == null) localStorage.setItem(nk, v);
      localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}
