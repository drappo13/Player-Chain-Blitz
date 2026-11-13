import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAnalytics, isSupported, logEvent, setUserId, setUserProperties, type Analytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDgg5sd6bAQAMo2ENtdZJV-lP6ytduPbj4",
  authDomain: "drapk-in.firebaseapp.com",
  databaseURL: "https://drapk-in-default-rtdb.firebaseio.com",
  projectId: "drapk-in",
  storageBucket: "drapk-in.firebasestorage.app",
  messagingSenderId: "262094095705",
  appId: "1:262094095705:web:086cc2a3af9e0cd64c7848",
  measurementId: "G-GNCMCQRCJH",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// End-to-end tests build with VITE_EMULATOR=1: talk to a local Firestore emulator, never production
const EMULATOR = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_EMULATOR === "1";
if (EMULATOR) connectFirestoreEmulator(db, "127.0.0.1", 8080);

// Analytics is loaded lazily and conditionally — only when the SDK supports
// the runtime (browsers with cookies + IndexedDB; not SSR or some embedded
// webviews) AND a measurementId is configured. Calls made before it's ready are
// queued and replayed, so early events (e.g. landing from an invite link) aren't lost.
let analytics: Analytics | null = null;
let pending: ((a: Analytics) => void)[] = [];
const withAnalytics = (fn: (a: Analytics) => void) => {
  if (analytics) fn(analytics);
  else if (pending) pending.push(fn);
};
if (typeof window !== "undefined" && !EMULATOR && (firebaseConfig as { measurementId?: string }).measurementId) {
  isSupported().then((ok) => {
    if (!ok) { pending = []; return; }
    analytics = getAnalytics(app);
    const queued = pending;
    pending = [];
    queued.forEach((fn) => fn(analytics!));
  }).catch(() => { pending = []; });
}

/** Log a page view. Safe to call anywhere. */
export function trackPageView(path: string, title?: string) {
  withAnalytics((a) => logEvent(a, "page_view", {
    page_path: path,
    page_title: title ?? document.title,
    page_location: window.location.href,
  }));
}

/** Log a custom GA event. Safe to call anywhere. Event names are snake_case and shared
 *  across games; pass `game` (slug) and `mode` ("daily" | "arcade") where they apply. */
export function trackEvent(name: string, params?: Record<string, string | number | boolean | undefined>) {
  const clean = params && Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
  withAnalytics((a) => logEvent(a, name as Parameters<typeof logEvent>[1], clean));
}

/** Tie analytics to the account (so retention counts people, not devices) and tag them
 *  with properties every report can be split by. */
export function identify(username: string | null, props?: Record<string, string | number | undefined>) {
  withAnalytics((a) => {
    setUserId(a, username);
    if (props) {
      const clean = Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
      setUserProperties(a, clean);
    }
  });
}
