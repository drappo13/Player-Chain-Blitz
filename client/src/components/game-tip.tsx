import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

const ACCENTS = {
  green: { border: "border-green-400/60", btn: "bg-green-400 text-green-950", tint: "from-green-400/20", arrow: "bg-[#1f2b24]" },
  blue: { border: "border-sky-400/60", btn: "bg-sky-400 text-sky-950", tint: "from-sky-400/20", arrow: "bg-[#1d2732]" },
  violet: { border: "border-violet-400/60", btn: "bg-violet-400 text-violet-950", tint: "from-violet-400/20", arrow: "bg-[#262236]" },
  amber: { border: "border-amber-400/60", btn: "bg-amber-400 text-amber-950", tint: "from-amber-400/20", arrow: "bg-[#2c2820]" },
} as const;
export type TipAccent = keyof typeof ACCENTS;

/** Wrap the element a tip points at. The bubble floats above or below it (left/centre/right), in the
 *  game's colour, with everything inside it: the tip, "Skip tips" and a Got it button. */
export function TipAnchor({ show, children, text, onOk, onSkip, place = "bottom", align = "center", arrow = true, accent = "green", full = false, className = "" }: {
  show: boolean; children: ReactNode; text?: ReactNode; onOk?: () => void; onSkip?: () => void;
  place?: "top" | "bottom"; align?: "start" | "center" | "end"; arrow?: boolean; accent?: TipAccent;
  /** Span the anchor's full width (how-to tips under a full-width row) instead of a compact bubble */
  full?: boolean; className?: string;
}) {
  const a = ACCENTS[accent];
  const x = full ? "left-0 right-0" : align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2";
  const arrowX = align === "start" ? "left-6" : align === "end" ? "right-6" : "left-1/2 -translate-x-1/2";
  return (
    <div className={`relative ${className}`}>
      {children}
      <AnimatePresence>
        {show && text && (
          // Positioning lives on a plain box: framer's transform would otherwise wipe out the centring
          <div className={`absolute z-40 ${x} ${place === "bottom" ? "top-full mt-2" : "bottom-full mb-2"} ${full ? "" : "w-[min(300px,calc(100vw-2rem))]"}`}>
            <motion.div
              initial={{ opacity: 0, y: place === "bottom" ? -4 : 4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className={`relative rounded-2xl border ${a.border} bg-[#1b1f26] shadow-2xl shadow-black/60 px-3.5 pt-3 pb-2.5`}
              role="status"
            >
              <span aria-hidden className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${a.tint} to-transparent pointer-events-none`} />
              {arrow && (
                <span className={`absolute ${arrowX} w-3 h-3 rotate-45 ${a.arrow} border ${a.border} ${
                  place === "bottom" ? "-top-[7px] border-r-0 border-b-0" : "-bottom-[7px] border-l-0 border-t-0"}`} />
              )}
              <p className="relative text-[13px] leading-snug text-foreground">{text}</p>
              <div className="relative mt-2.5 flex items-center justify-between">
                <button type="button" onClick={onSkip} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                  Skip tips
                </button>
                <button type="button" onClick={onOk} className={`rounded-full px-3.5 py-1 text-xs font-black ${a.btn}`}>
                  Got it
                </button>
              </div>
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
