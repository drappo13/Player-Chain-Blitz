import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, trackEvent } from "./firebase";
import { isIOS, isStandalone } from "./install";

// Web push. On iPhone this only works from the home-screen app (iOS 16.4+), and the permission
// prompt must come straight from a tap. Messages are sent with the matching private VAPID key.
export const VAPID_PUBLIC = "BBFFBJ-YBC9Onwg72l_RbIi6TGBsEhYC7C72Ep8LTkBc2jz9Spbq3OT718Bd-4y-NH2J8CInE2S0DdJW86gamp4";

export type PushState = "unsupported" | "needs-install" | "denied" | "default" | "granted";

export function pushState(): PushState {
  if (typeof window === "undefined") return "unsupported";
  if (isIOS && !isStandalone()) return "needs-install";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  return Notification.permission as PushState;
}

const keyBytes = (b64: string) => {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (ch) => ch.charCodeAt(0));
};

/** Ask permission (call directly from a tap) and subscribe. Returns the subscription JSON. */
export async function enablePush(): Promise<PushSubscriptionJSON | null> {
  const perm = await Notification.requestPermission();
  trackEvent("push_permission", { result: perm });
  if (perm !== "granted") return null;
  const reg = await navigator.serviceWorker.ready;
  const key = keyBytes(VAPID_PUBLIC);
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with an older key can't be reused
  const old = sub?.options.applicationServerKey;
  if (sub && old && !sameBytes(new Uint8Array(old), key)) { await sub.unsubscribe(); sub = null; }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  return sub.toJSON();
}

const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

// --- Reminder settings (stored with the subscription in push-subs/{username}) ---

export interface ReminderPrefs { streak: boolean; morning: boolean }
const prefsKey = (u: string) => `pcb-reminders-${u.toLowerCase()}`;

export function readPrefs(username: string): ReminderPrefs | null {
  try { return JSON.parse(localStorage.getItem(prefsKey(username)) || "null"); } catch { return null; }
}

/** Turn reminders on (asks permission — call from a tap) or update which ones you get. */
export async function setReminders(username: string, prefs: ReminderPrefs, source: string): Promise<string | null> {
  try {
    const off = !prefs.streak && !prefs.morning;
    let sub: PushSubscriptionJSON | null = null;
    if (!off) {
      sub = (await currentSubscriptionAnyKey()) ?? (await enablePush());
      if (!sub) return "Notifications are blocked for drapk.in";
    }
    await setDoc(doc(db, "push-subs", username.toLowerCase()), {
      ...(sub ? { endpoint: sub.endpoint, keys: sub.keys } : {}),
      streak: prefs.streak, morning: prefs.morning, dead: false,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    try { localStorage.setItem(prefsKey(username), JSON.stringify(prefs)); } catch { /* ignore */ }
    trackEvent("reminders_set", { streak: prefs.streak, morning: prefs.morning, source });
    return null;
  } catch {
    return "Couldn't turn reminders on, try again";
  }
}

async function currentSubscriptionAnyKey(): Promise<PushSubscriptionJSON | null> {
  if (pushState() !== "granted") return null;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  const old = sub?.options.applicationServerKey;
  if (!sub || (old && !sameBytes(new Uint8Array(old), keyBytes(VAPID_PUBLIC)))) return null;
  return sub.toJSON();
}

export async function currentSubscription(): Promise<PushSubscriptionJSON | null> {
  if (pushState() !== "granted") return null;
  const reg = await navigator.serviceWorker.ready;
  return (await reg.pushManager.getSubscription())?.toJSON() ?? null;
}

/** Shows a notification from this device (no server) — checks permission + display. */
export async function localTestNotification() {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification("drapk.in", { body: "Local test: notifications work on this phone", icon: "/icon-192.png", tag: "test" });
}

/** Which service worker version is running (null = none / old one without the debug hook). */
export async function swVersion(): Promise<string | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sw = reg?.active;
  if (!sw) return null;
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    const t = setTimeout(() => resolve("old"), 1500);
    ch.port1.onmessage = (e) => { clearTimeout(t); resolve(String(e.data)); };
    sw.postMessage({ type: "version" }, [ch.port2]);
  });
}

/** Force-check for a new service worker. */
export async function updateSw() {
  const reg = await navigator.serviceWorker.getRegistration();
  await reg?.update();
}

/** Last push the service worker received (written by sw.js). */
export async function lastPush(): Promise<string | null> {
  try {
    const r = await (await caches.open("pcb-debug")).match("/last-push");
    return r ? await r.text() : null;
  } catch { return null; }
}
