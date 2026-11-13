import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, Smartphone } from "lucide-react";
import { useUser } from "@/lib/user-context";
import { pushState, readPrefs, setReminders, type ReminderPrefs } from "@/lib/push";
import { isIOS, isStandalone, openInstallGuide } from "@/lib/install";
import { askedThisVisit, askRecord, noteAsk, neverAsk } from "@/lib/asks";
import { todayKey } from "@/lib/daily";
import { trackEvent } from "@/lib/firebase";

/** iPhone outside the home-screen app can't get notifications: install first. */
const needsInstall = () => isIOS && !isStandalone();

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button onClick={() => onChange(!on)} className="w-full flex items-center gap-3 py-2 text-left">
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <span className={`w-10 h-6 rounded-full p-0.5 transition-colors ${on ? "bg-emerald-500" : "bg-white/15"}`}>
        <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${on ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}

/** Me: reminder settings (named players). */
export function RemindersCard() {
  const { user } = useUser();
  const username = user!.username;
  const [prefs, setPrefs] = useState<ReminderPrefs>(() => readPrefs(username) ?? { streak: false, morning: false });
  const [msg, setMsg] = useState<string | null>(null);
  const state = pushState();

  if (needsInstall()) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 mb-6 flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-300 flex items-center justify-center shrink-0"><Bell className="w-5 h-5" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-foreground">Reminders</p>
          <p className="text-xs text-muted-foreground">On iPhone these need drapk.in on your Home Screen</p>
        </div>
        <button onClick={() => openInstallGuide("me_reminders")} className="shrink-0 rounded-full bg-sky-500 text-white px-4 py-2 text-sm font-black">How</button>
      </section>
    );
  }
  if (state === "unsupported") return null;

  const update = async (next: ReminderPrefs) => {
    const prev = prefs;
    setPrefs(next);
    const err = await setReminders(username, next, "me");
    if (err) { setPrefs(prev); setMsg(err); } else setMsg(null);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 mb-6">
      <h2 className="text-sm font-black text-foreground flex items-center gap-1.5 mb-1"><Bell className="w-4 h-4 text-sky-300" /> Reminders</h2>
      <Toggle on={prefs.streak} onChange={(v) => update({ ...prefs, streak: v })}
        label="Evening streak reminder" hint="Only if you haven't played and have a streak going" />
      <Toggle on={prefs.morning} onChange={(v) => update({ ...prefs, morning: v })}
        label="Morning: new set is out" hint="Once a day, around 8am" />
      {state === "denied" && <p className="mt-1 text-xs text-amber-300">Notifications are blocked for drapk.in in your settings.</p>}
      {msg && <p className="mt-1 text-xs text-amber-300">{msg}</p>}
    </section>
  );
}

/** End screens, day 2+: one ask, once per visit, at most twice ever. iPhone in the browser gets the
 *  Home Screen ask (reminders need it); everywhere else the reminder ask. */
export function ReminderAsk({ daysPlayed }: { daysPlayed: number }) {
  const { user, isGuest } = useUser();
  const [show, setShow] = useState<"install" | "reminders" | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!user || isGuest || daysPlayed < 2 || askedThisVisit()) return;
    const today = todayKey();
    const r = askRecord("reminders");
    if (r.never || r.count >= 2 || r.lastDay === today) return;
    const prefs = readPrefs(user.username);
    let kind: "install" | "reminders" | null = null;
    if (needsInstall()) kind = "install";
    else if (pushState() === "default" && !prefs?.streak && !prefs?.morning) kind = "reminders";
    if (!kind) return;
    noteAsk("reminders", today);
    trackEvent("reminder_ask_view", { kind });
    setShow(kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username, isGuest, daysPlayed]);

  if (!show || !user) return null;
  if (done) return <p className="mb-4 text-center text-xs font-semibold text-emerald-300">{done}</p>;

  const no = () => { neverAsk("reminders"); trackEvent("reminder_ask_no", { kind: show }); setShow(null); };
  const yes = async () => {
    trackEvent("reminder_ask_yes", { kind: show });
    if (show === "install") { openInstallGuide("end_screen"); setShow(null); return; }
    setBusy(true);
    const err = await setReminders(user.username, { streak: true, morning: false }, "end_screen");
    setBusy(false);
    setDone(err ?? "Done. We'll only nudge you if your streak's at risk.");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
      className="mb-4 rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-500/15 via-card to-card p-3.5">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0">
          {show === "install" ? <Smartphone className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        </span>
        <p className="flex-1 min-w-0 text-sm font-bold text-foreground leading-snug">
          {show === "install"
            ? "Add drapk.in to your Home Screen, then it can remind you before your streak runs out"
            : "Want a reminder in the evening if you haven't played?"}
        </p>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={no} className="flex-1 rounded-full bg-white/10 py-2 text-xs font-bold text-foreground">No thanks</button>
        <button onClick={yes} disabled={busy} className="flex-1 rounded-full bg-sky-500 py-2 text-xs font-black text-white">
          {show === "install" ? "Show me how" : busy ? "..." : "Yes please"}
        </button>
      </div>
    </motion.div>
  );
}
