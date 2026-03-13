import { useEffect, type RefObject } from "react";

/**
 * On mobile, tapping an input causes the browser to scroll the page
 * so the input sits above the virtual keyboard. This hook listens for
 * focus/scroll events on the input and snaps the window back to top.
 */
export function useLockScroll(inputRef: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const scrollToTop = () => {
      // Small delay so the browser finishes its own scroll first
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    };

    el.addEventListener("focus", scrollToTop);
    // Also catch any scroll that happens while input is focused
    const onScroll = () => {
      if (document.activeElement === el && window.scrollY > 0) {
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      el.removeEventListener("focus", scrollToTop);
      window.removeEventListener("scroll", onScroll);
    };
  }, [inputRef]);
}
