import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, trackEvent, identify } from "./firebase";
import {
  getOrCreateGuest, readGuest, clearGuest, migrateGuestKeys, guestGamesFinished, claimGuestGames, flushLegacyPending, type GuestUser,
} from "./guest";
import { startFriendsFromInvite } from "./friends";

// Invite links look like drapk.in/?ref=username; remember the inviter until sign-up
const REF_KEY = "pcb-ref";
if (typeof window !== "undefined") {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref")?.toLowerCase().trim();
    if (ref && /^[a-z0-9_]{2,15}$/.test(ref)) {
      localStorage.setItem(REF_KEY, ref);
      trackEvent("invite_landing", { ref, path: window.location.pathname, signed_in: !!localStorage.getItem("pcb-user") });
    }
  } catch { /* ignore */ }
}

/** A drapk.in link that credits the signed-in player as the inviter (plain link if signed out). */
export function shareLink(path = "/", source = "game"): string {
  trackEvent("share", { path, source });
  let ref = "";
  try { ref = (JSON.parse(localStorage.getItem("pcb-user") || "null") as User | null)?.username?.toLowerCase() ?? ""; } catch { /* ignore */ }
  return `https://drapk.in${path}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`;
}

function readReferrer(): string | null {
  try { return localStorage.getItem(REF_KEY); } catch { return null; }
}

export interface User {
  username: string;
  avatar: string;
  guest?: boolean;
}

interface UserContextType {
  /** The named account, or the device's guest when there isn't one */
  user: User | null;
  /** True while playing as a guest (no name picked yet) */
  isGuest: boolean;
  loading: boolean;
  login: (username: string) => Promise<{ ok: boolean; error?: string }>;
  signup: (username: string, avatar: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  /** Open the "pick a name" sheet; `source` is for analytics (e.g. "end_screen", "me") */
  openClaim: (source: string) => void;
  closeClaim: () => void;
  claimSource: string | null;
}

const UserContext = createContext<UserContextType>({
  user: null,
  isGuest: false,
  loading: true,
  login: async () => ({ ok: false }),
  signup: async () => ({ ok: false }),
  logout: () => {},
  openClaim: () => {},
  closeClaim: () => {},
  claimSource: null,
});

export const useUser = () => useContext(UserContext);

const STORAGE_KEY = "pcb-user";

// Firestore waits indefinitely when the browser can't reach it (content blockers,
// VPNs, locked-down networks), which left the sign-up button spinning forever.
const TIMEOUT_MS = 10000;
const UNREACHABLE = "Can't reach the server. Turn off any ad/content blocker or VPN for drapk.in, or try another network, then try again.";

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS))]);
}

/** A guest picked (or logged into) a name: their games are copied to the account in Firestore (guest
 *  copies marked claimedBy), and everything on this device moves to the account. */
async function adoptGuest(guest: GuestUser | null, username: string) {
  if (!guest) return;
  try {
    await flushLegacyPending(guest.username); // anything the first release left queued
    await claimGuestGames(guest.username, username);
  } catch { /* the account still works; worst case the guest games stay unclaimed */ }
  migrateGuestKeys(guest.username, username);
  clearGuest();
  // History was cached under the guest id: lib/daily.ts drops its cache on this
  window.dispatchEvent(new Event("pcb-account-changed"));
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<User | null>(null);
  const [guest, setGuest] = useState<GuestUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimSource, setClaimSource] = useState<string | null>(null);

  useEffect(() => {
    let named: User | null = null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) named = JSON.parse(saved);
    } catch {}
    setAccount(named);
    // No account on this device: play as a guest straight away
    if (!named) {
      const g = getOrCreateGuest();
      setGuest(g);
      flushLegacyPending(g.username).catch(() => {});
    }
    setLoading(false);
  }, []);

  const user: User | null = account ?? guest;
  const isGuest = !account && !!guest;
  const setUser = (u: User) => { setAccount(u); setGuest(null); setClaimSource(null); };

  const login = async (username: string): Promise<{ ok: boolean; error?: string }> => {
    const key = username.toLowerCase().trim();
    if (!key) return { ok: false, error: "Enter a username" };
    try {
      const snap = await withTimeout(getDoc(doc(db, "users", key)));
      if (!snap.exists()) return { ok: false, error: "Username not found" };
      const data = snap.data() as User;
      const g = readGuest();
      const guestGames = guestGamesFinished();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ username: data.username, avatar: data.avatar }));
      await adoptGuest(g, data.username);
      setUser({ username: data.username, avatar: data.avatar });
      trackEvent("login", { method: "username", from_guest: !!g, guest_games: g ? guestGames : undefined, source: claimSource ?? undefined });
      return { ok: true };
    } catch {
      return { ok: false, error: UNREACHABLE };
    }
  };

  const signup = async (username: string, avatar: string): Promise<{ ok: boolean; error?: string }> => {
    const trimmed = username.trim();
    const key = trimmed.toLowerCase();
    if (!key) return { ok: false, error: "Enter a username" };
    if (key.length < 2) return { ok: false, error: "Too short (min 2 characters)" };
    if (key.length > 15) return { ok: false, error: "Too long (max 15 characters)" };
    if (!/^[a-z0-9_]+$/.test(key)) return { ok: false, error: "Letters, numbers & underscores only" };
    try {
      const snap = await withTimeout(getDoc(doc(db, "users", key)));
      if (snap.exists()) return { ok: false, error: "Username taken" };
      const userData: User = { username: trimmed, avatar };
      const g = readGuest();
      const guestGames = guestGamesFinished();
      // fromGuest links the account to its guest plays, so /stats can count guests who picked a name
      const record = { ...userData, createdAt: serverTimestamp(), ...(g ? { fromGuest: g.username.toLowerCase(), guestGames } : {}) };
      const ref = readReferrer();
      if (ref && ref !== key) {
        // Credit whoever invited them; if the extra field is ever rejected, sign up without it
        try {
          await withTimeout(setDoc(doc(db, "users", key), { ...record, referredBy: ref }));
        } catch {
          await withTimeout(setDoc(doc(db, "users", key), record));
        }
      } else {
        await withTimeout(setDoc(doc(db, "users", key), record));
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      await adoptGuest(g, trimmed);
      setUser(userData);
      const invited = !!ref && ref !== key;
      trackEvent("sign_up", {
        method: "username", invited, ref: invited ? ref! : undefined, path: window.location.pathname,
        from_guest: !!g, guest_games: g ? guestGames : undefined, source: claimSource ?? undefined,
      });
      if (invited) startFriendsFromInvite(key, ref!);
      const now = new Date();
      identify(key, {
        signup_month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        acquisition: invited ? "invite" : "organic",
        referred_by: invited ? ref! : undefined,
      });
      return { ok: true };
    } catch {
      return { ok: false, error: UNREACHABLE };
    }
  };

  const logout = () => {
    setAccount(null);
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = "/";
  };

  const openClaim = (source: string) => {
    trackEvent("claim_prompt_view", { source, guest_games: guestGamesFinished() });
    setClaimSource(source);
  };
  const closeClaim = () => setClaimSource(null);

  return (
    <UserContext.Provider value={{ user, isGuest, loading, login, signup, logout, openClaim, closeClaim, claimSource }}>
      {children}
    </UserContext.Provider>
  );
}
