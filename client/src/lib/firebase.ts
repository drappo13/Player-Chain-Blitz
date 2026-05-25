import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";

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

// Analytics is loaded lazily and conditionally — only when the SDK supports
// the runtime (browsers with cookies + IndexedDB; not SSR or some embedded
// webviews) AND a measurementId is configured.
let analytics: Analytics | null = null;
if (typeof window !== "undefined" && (firebaseConfig as { measurementId?: string }).measurementId) {
  isSupported().then((ok) => {
    if (ok) analytics = getAnalytics(app);
  }).catch(() => {});
}

/** Log a page view. Safe to call anywhere — no-ops if Analytics isn't ready. */
export function trackPageView(path: string, title?: string) {
  if (!analytics) return;
  logEvent(analytics, "page_view", {
    page_path: path,
    page_title: title ?? document.title,
    page_location: window.location.href,
  });
}

/** Log a custom GA event. Safe to call anywhere — no-ops if Analytics isn't ready. */
export function trackEvent(name: string, params?: Record<string, string | number | boolean>) {
  if (!analytics) return;
  logEvent(analytics, name as Parameters<typeof logEvent>[1], params);
}
