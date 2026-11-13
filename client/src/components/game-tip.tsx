import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { trackEvent } from "@/lib/firebase";

// First-time tips inside the daily games, instead of a rules screen. One short line at a time,
// floating next to what it's about (never pushing the game around), shown at the moment it's
// relevant, gone when you do the thing (or tap ✓ / Skip tips). Each game's tips show once ever.

export interface TipDef {
  id: string;
  /** Show it now (when it hasn't been seen) */
  when: boolean;
  /** Done: mark it seen (e.g. the player started typing) */
  until?: boolean;
  text: ReactNode;
}

const key = (game: string) => `pcb-tips-${game}`;
type Store = { seen: string[]; off?: boolean };
const read = (game: string): Store => {
  try { return { seen: [], ...JSON.parse(localStorage.getItem(key(game)) || "{}") }; } catch { return { seen: [] }; }
};
const write = (game: string, s: Store) => { try { localStorage.setItem(key(game), JSON.stringify(s)); } catch { /* ignore */ } };

/** Which tip to show now. `firstTime`: the player hadn't played this game before (tips started then
 *  keep going on later visits until they're all seen). */
export function useGameTips(game: string, firstTime: boolean, tips: TipDef[]) {
  const [store, setStore] = useState<Store>(() => read(game));
  const [enabled] = useState(() => {
    const s = read(game);
    if (s.off) return false;
    return firstTime || (s.seen.length > 0 && s.seen.length < tips.length);
  });
  const mark = (id: string, how: "done" | "ok" | "skip") => {
    setStore((prev) => {
      if (prev.seen.includes(id) && how !== "skip") return prev;
      const next: Store = how === "skip" ? { seen: [...new Set([...prev.seen, id])], off: true } : { ...prev, seen: [...prev.seen, id] };
      write(game, next);
      return next;
    });
    trackEvent(how === "skip" ? "tips_skip" : "tip_done", { game, tip: id, how });
  };
  const active = enabled && !store.off ? tips.find((t) => t.when && !store.seen.includes(t.id)) : undefined;

  // Done by doing: the moment its `until` is true, it's seen
  useEffect(() => {
    for (const t of tips) if (enabled && t.until && !store.seen.includes(t.id) && !store.off) mark(t.id, "done");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tips.map((t) => `${t.id}:${t.until ? 1 : 0}`).join(",")]);

  const shown = useRef(new Set<string>());
  useEffect(() => {
    if (active && !shown.current.has(active.id)) { shown.current.add(active.id); trackEvent("tip_view", { game, tip: active.id }); }
  }, [active?.id, game]);

  return {
    tip: active,
    ok: () => active && mark(active.id, "ok"),
    skip: () => active && mark(active.id, "skip"),
  };
}

/** Wrap the element a tip points at. The bubble floats above or below it, aligned left/centre/right. */
export function TipAnchor({ show, children, text, onOk, onSkip, place = "bottom", align = "center", arrow = true, className = "" }: {
  show: boolean; children: ReactNode; text?: ReactNode; onOk?: () => void; onSkip?: () => void;
  place?: "top" | "bottom"; align?: "start" | "center" | "end"; arrow?: boolean; className?: string;
}) {
  const x = align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2";
  const arrowX = align === "start" ? "left-5" : align === "end" ? "right-5" : "left-1/2 -translate-x-1/2";
  return (
    <div className={`relative ${className}`}>
      {children}
      <AnimatePresence>
        {show && text && (
          // Positioning lives on a plain box: framer's transform would otherwise wipe out the centring
          <div className={`absolute z-40 ${x} ${place === "bottom" ? "top-full mt-2.5" : "bottom-full mb-2.5"} w-[min(280px,calc(100vw-2rem))]`}>
          <motion.div
            initial={{ opacity: 0, y: place === "bottom" ? -4 : 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="relative"
            role="status"
          >
            {arrow && <span className={`absolute ${arrowX} ${place === "bottom" ? "-top-1.5" : "-bottom-1.5"} w-3 h-3 rotate-45 bg-white`} />}
            <div className="relative rounded-xl bg-white text-zinc-900 shadow-xl shadow-black/40 pl-3 pr-1.5 py-2 flex items-start gap-2">
              <p className="flex-1 text-[13px] leading-snug font-medium pt-0.5">{text}</p>
              <button type="button" onClick={onOk} aria-label="Got it"
                className="shrink-0 w-7 h-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
                <Check className="w-4 h-4" strokeWidth={3} />
              </button>
            </div>
            <button type="button" onClick={onSkip}
              className={`absolute ${place === "bottom" ? "-bottom-5" : "-top-5"} ${align === "end" ? "right-1" : "left-1"} text-[10px] font-semibold text-white/60 hover:text-white`}>
              Skip tips
            </button>
          </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Small helper for games: track "has the player done X yet" across renders. */
export function useOnce(cond: boolean): boolean {
  const [v, setV] = useState(cond);
  useEffect(() => { if (cond && !v) setV(true); }, [cond, v]);
  return v || cond;
}
