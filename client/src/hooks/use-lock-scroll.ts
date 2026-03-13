import { useEffect, type RefObject } from "react";

/**
 * On mobile, tapping an input causes the browser to scroll the page
 * so the input sits above the virtual keyboard. This hook snaps
 * the window back to top on focus.
 *
 * Previously also had a scroll event listener that fought the browser
 * on every scroll — removed because it caused jitter on mobile.
 */
export function useLockScroll(inputRef: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const scrollToTop = () => {
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    };

    el.addEventListener("focus", scrollToTop);

    return () => {
      el.removeEventListener("focus", scrollToTop);
    };
  }, [inputRef]);
}
