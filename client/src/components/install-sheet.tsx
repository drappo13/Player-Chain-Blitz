import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowUp, Share, SquarePlus, EllipsisVertical, Ellipsis, X } from "lucide-react";
import { guideKind, onOpenInstallGuide, type GuideKind } from "@/lib/install";

// The Add to Home Screen guide: the steps for this browser, with a bouncing arrow at the button to
// press first. iPhone browsers can't be asked to install a site, so this is the best we can do.

const STEPS: Record<GuideKind, React.ReactNode[]> = {
  safari26: [
    <>Tap <Ellipsis className="inline w-4 h-4" /> at the bottom right</>,
    <>Tap <Share className="inline w-4 h-4 text-sky-400" /> <b>Share</b></>,
    <>Scroll down and tap <b>Add to Home Screen</b></>,
    <>Tap <b>Add</b></>,
  ],
  safari: [
    <>Tap <Share className="inline w-4 h-4 text-sky-400" /> <b>Share</b> at the bottom</>,
    <>Scroll down and tap <b>Add to Home Screen</b></>,
    <>Tap <b>Add</b></>,
  ],
  "chrome-ios": [
    <>Tap <Share className="inline w-4 h-4 text-sky-400" /> <b>Share</b> at the top right</>,
    <>Scroll down and tap <b>Add to Home Screen</b></>,
    <>Tap <b>Add</b></>,
  ],
  inapp: [
    <>You're in another app's browser. Open drapk.in in <b>Safari</b> or <b>Chrome</b> first (look for <Ellipsis className="inline w-4 h-4" /> or "Open in browser")</>,
    <>Then add it to your Home Screen from there</>,
  ],
  android: [
    <>Tap <EllipsisVertical className="inline w-4 h-4" /> at the top right</>,
    <>Tap <b>Add to Home screen</b> or <b>Install app</b></>,
  ],
  other: [
    <>Open your browser's menu</>,
    <>Choose <b>Install</b> or <b>Add to Home Screen</b></>,
  ],
};

// Where the first button lives
const ARROW: Partial<Record<GuideKind, { cls: string; up: boolean }>> = {
  safari26: { cls: "bottom-3 right-5", up: false },
  safari: { cls: "bottom-3 left-1/2 -translate-x-1/2", up: false },
  "chrome-ios": { cls: "top-3 right-5", up: true },
  android: { cls: "top-3 right-3", up: true },
};

export function InstallSheet() {
  const [open, setOpen] = useState(false);
  useEffect(() => onOpenInstallGuide(() => setOpen(true)), []);
  const kind = guideKind();
  const arrow = ARROW[kind];
  const ios = kind === "safari26" || kind === "safari" || kind === "chrome-ios";

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          {arrow && (
            <motion.div className={`fixed ${arrow.cls} text-white`}
              animate={{ y: arrow.up ? [0, -10, 0] : [0, 10, 0] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}>
              {arrow.up ? <ArrowUp className="w-10 h-10" strokeWidth={3} /> : <ArrowDown className="w-10 h-10" strokeWidth={3} />}
            </motion.div>
          )}
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute left-4 right-4 top-[16%] mx-auto max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <button onClick={() => setOpen(false)} aria-label="Close" className="absolute top-3 right-3 w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
            <p className="text-lg font-black text-foreground pr-8">Add drapk.in to your Home Screen</p>
            <p className="text-xs text-muted-foreground mt-0.5">Opens like an app, straight to today's set.</p>
            <ol className="mt-4 space-y-3">
              {STEPS[kind].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="pt-0.5 leading-snug">{step}</span>
                </li>
              ))}
            </ol>
            {ios && (
              <>
                {/* What the row to tap looks like in the share sheet */}
                <div className="mt-4 rounded-xl bg-white/[0.06] border border-white/10 px-3.5 py-3 flex items-center justify-between">
                  <span className="text-sm text-foreground">Add to Home Screen</span>
                  <SquarePlus className="w-5 h-5 text-foreground" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Then open it from your Home Screen and log in with your name once. The app keeps its own login.
                </p>
              </>
            )}
            <button onClick={() => setOpen(false)} className="mt-4 w-full rounded-full bg-white/10 py-2.5 text-sm font-bold text-foreground">Got it</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
