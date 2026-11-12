import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

// Invite links look like drapk.in/?ref=username; remember the inviter until sign-up
const REF_KEY = "pcb-ref";
if (typeof window !== "undefined") {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref")?.toLowerCase().trim();
    if (ref && /^[a-z0-9_]{2,15}$/.test(ref)) localStorage.setItem(REF_KEY, ref);
  } catch { /* ignore */ }
}

function readReferrer(): string | null {
  try { return localStorage.getItem(REF_KEY); } catch { return null; }
}

export interface User {
  username: string;
  avatar: string;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  login: (username: string) => Promise<{ ok: boolean; error?: string }>;
  signup: (username: string, avatar: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  login: async () => ({ ok: false }),
  signup: async () => ({ ok: false }),
  logout: () => {},
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

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setUser(JSON.parse(saved));
    } catch {}
    setLoading(false);
  }, []);

  const login = async (username: string): Promise<{ ok: boolean; error?: string }> => {
    const key = username.toLowerCase().trim();
    if (!key) return { ok: false, error: "Enter a username" };
    try {
      const snap = await withTimeout(getDoc(doc(db, "users", key)));
      if (!snap.exists()) return { ok: false, error: "Username not found" };
      const data = snap.data() as User;
      setUser(data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
      const record = { ...userData, createdAt: serverTimestamp() };
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
      setUser(userData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      return { ok: true };
    } catch {
      return { ok: false, error: UNREACHABLE };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = "/";
  };

  return (
    <UserContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </UserContext.Provider>
  );
}
