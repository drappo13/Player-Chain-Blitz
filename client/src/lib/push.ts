import { trackEvent } from "./firebase";
import { isIOS, isStandalone } from "./install";

// Web push. On iPhone this only works from the home-screen app (iOS 16.4+), and the permission
// prompt must come straight from a tap. Messages are sent with the matching private VAPID key.
export const VAPID_PUBLIC = "BJ2VKS_0YB1OD5qapGXQM0e9sPQ0nZzhmjbCTscDwtpDTELtcM14MVWAg9kQ05ApaiisJZ3amriVocPLRL9kpJk";

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
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }));
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
