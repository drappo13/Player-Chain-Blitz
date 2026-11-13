import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db, trackEvent } from "./firebase";

// Guest play: first-time visitors play straight away as "Guest". A guest is an ordinary player in
// Firestore — their games are written to daily-scores/scores like anyone's, under a guest id
// ("guest-k3x9…", flagged guest: true) — they just have no name, no users doc and are kept off the
// leaderboards. Picking a name copies their games to the account and marks the guest copies
// claimedBy, so stats count each person once and can see who converted.
// Guest ids contain a hyphen, which real usernames can't, so they never collide.

export interface GuestUser { username: string; avatar: string; guest: true }

const GUEST_KEY = "pcb-guest";
const PENDING_KEY = "pcb-pending"; // first release kept guest scores here instead of writing them

/** Test builds on this machine don't write scores, unless they're pointed at the local emulator. */
export const IS_LOCALHOST = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
export const USE_EMULATOR = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_EMULATOR === "1";
export const WRITES_ENABLED = !IS_LOCALHOST || USE_EMULATOR;

export const isGuestName = (name?: string | null) => !!name && name.toLowerCase().startsWith("guest-");

/** Name to show for anyone: guests are "Guest", everyone else their username. */
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
  const g: GuestUser = { username: `guest-${id}`, avatar: "👤", guest: true };
  try { localStorage.setItem(GUEST_KEY, JSON.stringify(g)); } catch { /* ignore */ }
  trackEvent("guest_start", { path: window.location.pathname });
  return g;
}

export function clearGuest() {
  try { localStorage.removeItem(GUEST_KEY); } catch { /* ignore */ }
}

/** Daily games this guest has finished or completed on this device (for analytics / sign-up). */
export function guestGamesFinished(guest?: string): number {
  const g = guest ?? readGuest()?.username;
  if (!g) return 0;
  let n = 0;
  try {
    const prefix = `pcb-day-${g.toLowerCase()}-`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(prefix)) continue;
      const day = JSON.parse(localStorage.getItem(k) || "{}") as Record<string, { status?: string; counted?: boolean; late?: boolean }>;
      for (const p of Object.values(day)) if ((p?.status === "done" || p?.counted) && !p.late) n++;
    }
  } catch { /* ignore */ }
  return n;
}

// --- Scores the first release queued on the device instead of writing (sent once, as the guest) ---

type Pending =
  | { kind: "daily"; game: string; dateKey: string; score: number; found: number; total: number; state?: unknown; late?: boolean }
  | { kind: "arcade"; game: string; score: number };

export async function flushLegacyPending(guest: string) {
  let list: Pending[] = [];
  try { list = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); } catch { /* ignore */ }
  if (!list.length || !WRITES_ENABLED) return;
  try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
  const name = guest.toLowerCase();
  for (const p of list) {
    try {
      if (p.kind === "daily") {
        if (p.late) continue; // yesterday's set is device-only now
        const key = `${p.game}_${p.dateKey}_${name}`;
        const exists = await getDocs(query(collection(db, "daily-scores"), where("key", "==", key)));
        if (!exists.empty) continue;
        await setDoc(doc(db, "daily-scores", key), {
          username: name, game: p.game, dateKey: p.dateKey, score: p.score, found: p.found, total: p.total, key, guest: true,
          timestamp: serverTimestamp(), ...(p.state === undefined ? {} : { state: JSON.stringify(p.state) }),
        });
      } else {
        await addDoc(collection(db, "scores"), { username: name, game: p.game, score: p.score, guest: true, timestamp: serverTimestamp() });
      }
    } catch { /* keep going */ }
  }
}

// --- Picking a name: copy the guest's games to the account ---

const withoutGuest = (x: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(x).filter(([k]) => k !== "guest" && k !== "claimedBy"));

/** Copy every unclaimed guest game to `username` and mark the guest copies claimedBy. Games the
 *  account already has (e.g. logging into an account that played elsewhere) aren't copied. An
 *  open CentreCircle/Griddle game stays open under the account, so it keeps saving as you play. */
export async function claimGuestGames(guest: string, username: string): Promise<{ daily: number; arcade: number }> {
  const from = guest.toLowerCase();
  const to = username.toLowerCase();
  let daily = 0;
  let arcade = 0;
  if (!WRITES_ENABLED) return { daily, arcade };

  const ds = await getDocs(query(collection(db, "daily-scores"), where("username", "==", from)));
  for (const d of ds.docs) {
    const x = d.data() as Record<string, unknown> & { game: string; dateKey: string; claimedBy?: string };
    if (x.claimedBy) continue;
    const key = `${x.game}_${x.dateKey}_${to}`;
    try {
      const has = await getDocs(query(collection(db, "daily-scores"), where("key", "==", key)));
      if (has.empty) {
        // Fresh timestamp so incremental readers (/stats) pick the copy up; when it was played is kept
        await setDoc(doc(db, "daily-scores", key), { ...withoutGuest(x), username: to, key, fromGuest: from, playedAt: x.timestamp ?? null, timestamp: serverTimestamp() });
        daily++;
      }
      await updateDoc(d.ref, { claimedBy: to });
    } catch { /* keep going */ }
  }

  const sc = await getDocs(query(collection(db, "scores"), where("username", "==", from)));
  for (const d of sc.docs) {
    const x = d.data() as Record<string, unknown> & { claimedBy?: string };
    if (x.claimedBy) continue;
    try {
      await addDoc(collection(db, "scores"), { ...withoutGuest(x), username: to, fromGuest: from, playedAt: x.timestamp ?? null, timestamp: serverTimestamp() });
      await updateDoc(d.ref, { claimedBy: to });
      arcade++;
    } catch { /* keep going */ }
  }
  return { daily, arcade };
}

/** After picking (or logging into) a name: move everything stored under the guest id on this device to it.
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
