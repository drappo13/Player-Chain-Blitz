import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

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
      const snap = await getDoc(doc(db, "users", key));
      if (!snap.exists()) return { ok: false, error: "Username not found" };
      const data = snap.data() as User;
      setUser(data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return { ok: true };
    } catch {
      return { ok: false, error: "Connection failed — try again" };
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
      const snap = await getDoc(doc(db, "users", key));
      if (snap.exists()) return { ok: false, error: "Username taken" };
      const userData: User = { username: trimmed, avatar };
      await setDoc(doc(db, "users", key), { ...userData, createdAt: serverTimestamp() });
      setUser(userData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      return { ok: true };
    } catch {
      return { ok: false, error: "Connection failed — try again" };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <UserContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </UserContext.Provider>
  );
}
