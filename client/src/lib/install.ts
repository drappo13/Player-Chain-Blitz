import { useEffect, useState } from "react";
import { trackEvent } from "./firebase";

// "Add to Home Screen". Chrome/Edge on Android (and desktop) fire `beforeinstallprompt`, which we
// hold on to so a button can open the native install dialog. iPhone Safari has no such API, so
// there we show the two taps instead (Share → Add to Home Screen).

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep Chrome's mini-infobar away; we offer it from the Me page
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    trackEvent("app_installed");
    notify();
  });
}

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);

const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
export const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(ua);

/** Which browser's steps to show for adding to the home screen by hand. */
export type GuideKind = "safari26" | "safari" | "chrome-ios" | "inapp" | "android" | "other";
export function guideKind(): GuideKind {
  if (/FBAN|FBAV|Instagram|Snapchat|Reddit|LinkedInApp|Twitter|GSA\/|Line\//.test(ua)) return "inapp";
  if (isIOS) {
    if (/CriOS/.test(ua)) return "chrome-ios";
    const v = Number(ua.match(/Version\/(\d+)/)?.[1] ?? 0);
    return v >= 26 ? "safari26" : "safari";
  }
  if (isAndroid) return "android";
  return "other";
}

const OPEN_EVENT = "pcb-open-install-guide";
/** Open the Add to Home Screen guide from anywhere. */
export function openInstallGuide(source: string) {
  trackEvent("install_guide_open", { source, kind: guideKind() });
  window.dispatchEvent(new Event(OPEN_EVENT));
}
export function onOpenInstallGuide(fn: () => void) {
  window.addEventListener(OPEN_EVENT, fn);
  return () => window.removeEventListener(OPEN_EVENT, fn);
}

export type InstallMode = "installed" | "prompt" | "ios" | "android" | "none";

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const mode: InstallMode = isStandalone()
    ? "installed"
    : deferred
      ? "prompt"
      : isIOS
        ? "ios"
        : isAndroid
          ? "android" // no prompt event (e.g. Firefox, Samsung) — show the menu steps instead
          : "none";

  const install = async (): Promise<boolean> => {
    trackEvent("install_click", { method: mode });
    if (!deferred) return false;
    const ev = deferred;
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    trackEvent("install_result", { outcome });
    deferred = null;
    notify();
    return outcome === "accepted";
  };

  return { mode, install };
}
