import { useCallback, useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, setDoc, where, serverTimestamp } from "firebase/firestore";
import { db, trackEvent } from "./firebase";
import { avatarsFor, type DailyGameSlug, type DailyScoreDoc } from "./daily-score";
import { isGuestName } from "./guest";

// Friends: follow anyone by username (one-way, no approval; scores are public anyway).
// Stored as one doc per player: friends/{username} = { list: string[] }.
// Joining through someone's invite link makes you friends both ways.

export const MAX_FRIENDS = 50;
const DAILY: DailyGameSlug[] = ["careerpath", "photofinish", "centrecircle", "griddle"];
const LIST_TTL = 10 * 60 * 1000;
const TODAY_TTL = 5 * 60 * 1000;
const EVENT = "pcb-friends-changed";

const listKey = (u: string) => `pcb-friends-${u.toLowerCase()}`;
const todayCacheKey = (u: string, d: string) => `pcb-friends-today-${u.toLowerCase()}-${d}`;
const invitesCheckedKey = (u: string) => `pcb-friends-invited-${u.toLowerCase()}`; // invitees already added

function readList(u: string): { list: string[]; at: number } | null {
  try { return JSON.parse(localStorage.getItem(listKey(u)) || "null"); } catch { return null; }
}
function writeList(u: string, list: string[]) {
  try { localStorage.setItem(listKey(u), JSON.stringify({ list, at: Date.now() })); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Save first, then show it: a failed save never leaves a friend on screen that isn't really there. */
async function saveList(u: string, list: string[]) {
  await setDoc(doc(db, "friends", u.toLowerCase()), { list, updatedAt: serverTimestamp() });
  writeList(u, list);
}

const loads = new Map<string, Promise<string[]>>();

/** Your friends list (from the device, refreshed from Firestore every 10 minutes). Also picks up
 *  anyone who joined through your invite link (checked once a day). */
async function loadList(u: string): Promise<string[]> {
  const key = u.toLowerCase();
  const cached = readList(key);
  if (cached && Date.now() - cached.at < LIST_TTL) return cached.list;
  if (loads.has(key)) return loads.get(key)!;
  const p = (async () => {
    let list: string[] = [];
    try {
      const snap = await getDoc(doc(db, "friends", key));
      list = snap.exists() ? ((snap.data() as { list?: string[] }).list ?? []) : [];
    } catch { return cached?.list ?? []; }
    // Invitees become friends automatically (checked whenever the list refreshes; each invitee is
    // only added once, so removing one later sticks)
    try {
      const inv = await getDocs(query(collection(db, "users"), where("referredBy", "==", key)));
      const added: string[] = JSON.parse(localStorage.getItem(invitesCheckedKey(key)) || "[]");
      const names = inv.docs.map((d) => d.id).filter((n) => n !== key && !list.includes(n) && !added.includes(n));
      if (names.length) {
        list = [...list, ...names].slice(0, MAX_FRIENDS);
        await setDoc(doc(db, "friends", key), { list, updatedAt: serverTimestamp() });
      }
      localStorage.setItem(invitesCheckedKey(key), JSON.stringify([...new Set([...added, ...inv.docs.map((d) => d.id)])]));
    } catch { /* ignore */ }
    writeList(key, list);
    return list;
  })();
  loads.set(key, p);
  p.finally(() => loads.delete(key));
  return p;
}

export function useFriends(username: string | undefined) {
  const named = !!username && !isGuestName(username);
  const [list, setList] = useState<string[]>(() => (named ? readList(username!)?.list ?? [] : []));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!named) { setList([]); return; }
    let cancelled = false;
    setLoading(true);
    loadList(username!).then((l) => { if (!cancelled) setList(l); }).finally(() => { if (!cancelled) setLoading(false); });
    const onChange = () => setList(readList(username!)?.list ?? []);
    window.addEventListener(EVENT, onChange);
    return () => { cancelled = true; window.removeEventListener(EVENT, onChange); };
  }, [username, named]);

  const add = useCallback(async (raw: string): Promise<string | null> => {
    if (!named) return "Pick a name first";
    const name = raw.trim().toLowerCase().replace(/^@/, "");
    if (!name) return "Enter a username";
    if (name === username!.toLowerCase()) return "That's you";
    if (!/^[a-z0-9_]{2,15}$/.test(name)) return "No one has that username";
    const current = readList(username!)?.list ?? list;
    if (current.includes(name)) return "Already in your friends";
    if (current.length >= MAX_FRIENDS) return `You can have up to ${MAX_FRIENDS} friends`;
    try {
      const snap = await getDoc(doc(db, "users", name));
      if (!snap.exists()) return "No one has that username";
      await saveList(username!, [...current, name]);
      try { localStorage.removeItem(todayCacheKey(username!, new Date().toISOString().slice(0, 10))); } catch { /* ignore */ }
      trackEvent("friend_add", { method: "username", friends: current.length + 1 });
      return null;
    } catch {
      return "Couldn't add them, try again";
    }
  }, [username, named, list]);

  const remove = useCallback(async (name: string) => {
    if (!named) return;
    const current = (readList(username!)?.list ?? list).filter((n) => n !== name);
    try { await saveList(username!, current); trackEvent("friend_remove", { friends: current.length }); } catch { /* ignore */ }
  }, [username, named, list]);

  return { list, loading, add, remove, named };
}

const inviteesKey = (u: string) => `pcb-invitees-${u.toLowerCase()}`;

/** People who signed up through your invite link (cached for 10 minutes). */
export function useInvitees(username: string | undefined): string[] {
  const named = !!username && !isGuestName(username);
  const read = () => { try { return JSON.parse(localStorage.getItem(inviteesKey(username!)) || "null"); } catch { return null; } };
  const [list, setList] = useState<string[]>(() => (named ? read()?.list ?? [] : []));
  useEffect(() => {
    if (!named) { setList([]); return; }
    const c = read();
    if (c && Date.now() - c.at < LIST_TTL) { setList(c.list); return; }
    let cancelled = false;
    getDocs(query(collection(db, "users"), where("referredBy", "==", username!.toLowerCase())))
      .then((snap) => {
        if (snap.metadata.fromCache) return;
        const names = snap.docs.map((d) => d.id);
        try { localStorage.setItem(inviteesKey(username!), JSON.stringify({ list: names, at: Date.now() })); } catch { /* ignore */ }
        if (!cancelled) setList(names);
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, named]);
  return list;
}

/** New account that came through an invite link: start friends with the inviter (the inviter
 *  picks up the other direction next time their list loads). */
export async function startFriendsFromInvite(username: string, ref: string) {
  try {
    await setDoc(doc(db, "friends", username.toLowerCase()), { list: [ref.toLowerCase()], updatedAt: serverTimestamp() });
    writeList(username, [ref.toLowerCase()]);
    trackEvent("friend_add", { method: "invite", friends: 1 });
  } catch { /* ignore */ }
}

// --- Friends' scores for a day ---

export interface FriendScore { username: string; avatar: string; score: number; found: number; open?: boolean }
export type FriendsDay = Partial<Record<DailyGameSlug, FriendScore[]>>;

const dayLoads = new Map<string, Promise<FriendsDay>>();

async function loadFriendsDay(me: string, friends: string[], dateKey: string): Promise<FriendsDay> {
  const ck = todayCacheKey(me, dateKey);
  try {
    const c = JSON.parse(localStorage.getItem(ck) || "null");
    if (c && Date.now() - c.at < TODAY_TTL && c.sig === friends.join(",")) return c.data;
  } catch { /* ignore */ }
  const memo = `${ck}|${friends.join(",")}`;
  if (dayLoads.has(memo)) return dayLoads.get(memo)!;
  const p = (async () => {
    const keys = friends.flatMap((f) => DAILY.map((g) => `${g}_${dateKey}_${f}`));
    const rows: DailyScoreDoc[] = [];
    for (let i = 0; i < keys.length; i += 30) {
      const snap = await getDocs(query(collection(db, "daily-scores"), where("key", "in", keys.slice(i, i + 30))));
      if (snap.metadata.fromCache) throw new Error("offline");
      snap.forEach((d) => rows.push(d.data() as DailyScoreDoc));
    }
    const avatars = await avatarsFor([...new Set(rows.map((r) => r.username))]);
    const data: FriendsDay = {};
    for (const r of rows) {
      if (r.late) continue;
      (data[r.game] ??= []).push({ username: r.username, avatar: avatars.get(r.username) || "⚽", score: r.score, found: r.found, open: r.open || undefined });
    }
    for (const g of DAILY) data[g]?.sort((a, b) => b.score - a.score);
    try { localStorage.setItem(ck, JSON.stringify({ at: Date.now(), sig: friends.join(","), data })); } catch { /* ignore */ }
    return data;
  })();
  dayLoads.set(memo, p);
  p.finally(() => dayLoads.delete(memo));
  return p;
}

/** Friends' scores for one day, all four games (one cached fetch shared by every component). */
export function useFriendsDay(username: string | undefined, dateKey: string, includeSelf = false): { friends: string[]; day: FriendsDay } {
  const { list } = useFriends(username);
  const [day, setDay] = useState<FriendsDay>({});
  const names = includeSelf && username ? [username.toLowerCase(), ...list] : list;
  const sig = names.join(",");
  useEffect(() => {
    if (!username || !list.length) { setDay({}); return; }
    let cancelled = false;
    loadFriendsDay(username, names, dateKey).then((d) => { if (!cancelled) setDay(d); }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, sig, dateKey]);
  return { friends: list, day };
}
