import { useEffect, useMemo, useState } from "react";
import { collection, doc, getCountFromServer, getDoc, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Flame, CalendarDays, Award, CheckCircle2, LogOut, UserPlus, Smartphone, Share, SquarePlus, EllipsisVertical } from "lucide-react";
import { useInstall } from "@/lib/install";
import { pushState, enablePush, currentSubscription, localTestNotification } from "@/lib/push";
import { Bell } from "lucide-react";
import { useUser, shareLink } from "@/lib/user-context";
import { useUserStats } from "@/lib/use-user-stats";
import type { GameSlug } from "@/lib/save-score";
import { HubPage } from "@/components/app-nav";
import { GameIcon } from "@/components/game-icons";
import { DAILY_GAMES, shareText, shiftDay, useStreak } from "@/lib/daily";
import { BadgeGrid } from "@/components/badge-grid";
import type { BadgeContext } from "@/lib/badges";

const ARCADE_NAMES: { slug: GameSlug; name: string; emoji: string }[] = [
  { slug: "targetman", name: "Target Man", emoji: "🎯" },
  { slug: "overlap", name: "Overlap", emoji: "🔗" },
  { slug: "clubladder", name: "Ladder Up", emoji: "📈" },
  { slug: "goalchain", name: "Goal Chain", emoji: "⚽" },
  { slug: "slamchain", name: "Slam 16", emoji: "🎾" },
  { slug: "gridlock", name: "Grid Lock", emoji: "🏎️" },
];

const PHONE_WEEKS = 8;
const WIDE_WEEKS = 16;
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const HEAT = ["bg-white/[0.06]", "bg-emerald-500/30", "bg-emerald-500/50", "bg-emerald-400/75", "bg-emerald-300"];

function StatTile({ icon: Icon, label, value, accent, delay, hot = false }: { icon: typeof Flame; label: string; value: string | number; accent: string; delay: number; hot?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`rounded-2xl border p-3.5 ${hot ? "border-orange-400/40 bg-gradient-to-br from-orange-500/25 via-amber-500/10 to-card" : "border-border bg-card"}`}
    >
      <Icon className={`w-4 h-4 mb-2 ${accent}`} />
      <p className={`text-2xl font-black tabular-nums leading-none ${hot ? "bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent" : "text-foreground"}`}>{value}</p>
      <p className="text-[11px] font-semibold text-muted-foreground mt-1">{label}</p>
    </motion.div>
  );
}

/** A column per week, oldest on the left; squares stretch to fill the card. Phones show 8 weeks, wider screens 16. */
function Calendar({ counts, today }: { counts: Map<string, number>; today: string }) {
  const [y, m, d] = today.split("-").map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // Monday = 0
  const start = shiftDay(today, -(dow + (WIDE_WEEKS - 1) * 7));
  return (
    <div className="flex gap-1">
      <div className="flex flex-col gap-1 pr-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="flex-1 flex items-center text-[10px] font-bold text-muted-foreground">{w}</div>
        ))}
      </div>
      {Array.from({ length: WIDE_WEEKS }, (_, w) => (
        <div key={w} className={`flex-1 flex-col gap-1 ${w < WIDE_WEEKS - PHONE_WEEKS ? "hidden sm:flex" : "flex"}`}>
          {Array.from({ length: 7 }, (_, i) => {
            const day = shiftDay(start, w * 7 + i);
            const n = counts.get(day) ?? 0;
            const future = day > today;
            return (
              <div
                key={day}
                title={future ? "" : `${day}: ${n} daily game${n === 1 ? "" : "s"}`}
                className={`aspect-square rounded-md ${future ? "bg-white/[0.02]" : HEAT[Math.min(n, 4)]} ${day === today ? "ring-1 ring-foreground/70" : ""}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** How many people signed up through this user's invite link. */
function useInviteCount(username: string | undefined): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!username) return;
    getCountFromServer(query(collection(db, "users"), where("referredBy", "==", username.toLowerCase())))
      .then((snap) => setN(snap.data().count))
      .catch(() => {});
  }, [username]);
  return n;
}

function InviteCard({ username, streak, invites }: { username: string; streak: number; invites: number }) {
  const [copied, setCopied] = useState(false);
  const invite = async () => {
    const text = [
      "Four daily Premier League games on drapk.in. A new set every day.",
      streak > 1 ? `I'm on a ${streak}-day streak \uD83D\uDD25 come and play` : "Come and play",
      shareLink("/", "invite"),
    ].join("\n");
    if (await shareText(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-4 mb-6 flex items-center gap-3">
      <span className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
        <UserPlus className="w-5 h-5" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-foreground">Invite a mate</p>
        <p className="text-xs text-muted-foreground">
          {invites > 0 ? `${invites} ${invites === 1 ? "mate has" : "mates have"} joined from your link` : "Send your link. When they sign up you unlock Recruiter"}
        </p>
      </div>
      <button onClick={invite} className="shrink-0 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-black">
        {copied ? "Copied!" : "Invite"}
      </button>
    </section>
  );
}

/** "Add to Home Screen": native prompt where the browser offers one, else the steps. Hidden once installed. */
function InstallCard() {
  const { mode, install } = useInstall();
  const [open, setOpen] = useState(false);
  if (mode === "installed" || mode === "none") return null;
  const onClick = () => {
    if (mode === "prompt") { install(); return; }
    if (!open) install(); // logs the click; no native dialog on these browsers
    setOpen((o) => !o);
  };
  const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
    <li className="flex items-center gap-2 text-xs text-foreground">
      <span className="w-5 h-5 rounded-full bg-white/10 text-[11px] font-black flex items-center justify-center shrink-0">{n}</span>
      <span className="flex items-center gap-1 flex-wrap">{children}</span>
    </li>
  );
  return (
    <section className="rounded-2xl border border-border bg-card p-4 mb-6">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-foreground">Add to Home Screen</p>
          <p className="text-xs text-muted-foreground">Opens like an app. One tap to today's set</p>
        </div>
        <button onClick={onClick} className="shrink-0 rounded-full bg-emerald-500 text-white px-4 py-2 text-sm font-black">
          {mode === "prompt" ? "Add" : open ? "Done" : "How"}
        </button>
      </div>
      {open && (
        <ol className="mt-3 pt-3 border-t border-border space-y-2">
          {mode === "ios" ? (
            <>
              <Step n={1}>Tap <Share className="w-4 h-4 text-sky-400" /> Share in Safari's toolbar (in Chrome it's top right)</Step>
              <Step n={2}>Scroll down and tap <SquarePlus className="w-4 h-4" /> <b>Add to Home Screen</b></Step>
              <Step n={3}>Open drapk.in from your home screen. You may need to log in once with your username</Step>
            </>
          ) : (
            <>
              <Step n={1}>Tap the <EllipsisVertical className="w-4 h-4" /> menu in your browser</Step>
              <Step n={2}>Tap <b>Add to Home screen</b> or <b>Install app</b></Step>
            </>
          )}
        </ol>
      )}
    </section>
  );
}

/** Admin-only push test: turn on, fire a local test, copy the subscription for a server-sent test. */
function PushTestCard() {
  const [state, setState] = useState(pushState());
  const [sub, setSub] = useState<string>("");
  const [msg, setMsg] = useState("");
  useEffect(() => { currentSubscription().then((s) => s && setSub(JSON.stringify(s))).catch(() => {}); }, []);
  const turnOn = async () => {
    try {
      const s = await enablePush();
      setState(pushState());
      if (s) setSub(JSON.stringify(s));
      else setMsg("Permission not granted");
    } catch (e) { setMsg(String(e)); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(sub); setMsg("Copied"); } catch { setMsg("Couldn't copy, select the text below"); }
  };
  const btn = "rounded-full bg-sky-500 text-white px-3 py-1.5 text-xs font-black";
  return (
    <section className="rounded-2xl border border-dashed border-sky-500/50 bg-card p-4 mb-6 space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-300 flex items-center justify-center shrink-0"><Bell className="w-5 h-5" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-foreground">Notifications (test, admin only)</p>
          <p className="text-xs text-muted-foreground">Status: {state}</p>
        </div>
      </div>
      {state === "needs-install" && <p className="text-xs text-muted-foreground">Open drapk.in from your home screen icon, then come back here.</p>}
      {state === "unsupported" && <p className="text-xs text-muted-foreground">This browser can't do push notifications.</p>}
      {state === "denied" && <p className="text-xs text-muted-foreground">Blocked. Turn them back on in Settings › Notifications › drapk.in.</p>}
      <div className="flex flex-wrap gap-2">
        {(state === "default" || (state === "granted" && !sub)) && <button onClick={turnOn} className={btn}>Turn on notifications</button>}
        {state === "granted" && <button onClick={() => localTestNotification().catch((e) => setMsg(String(e)))} className={btn}>Test on this phone</button>}
        {sub && <button onClick={copy} className={btn}>Copy subscription</button>}
      </div>
      {msg && <p className="text-xs text-amber-300">{msg}</p>}
      {sub && <textarea readOnly value={sub} rows={3} className="w-full rounded-lg bg-background border border-border p-2 text-[10px] font-mono text-muted-foreground" />}
    </section>
  );
}

/** When the account was made (falls back to the first daily game). */
function useMemberSince(username: string | undefined, firstDay?: string): string | null {
  const [created, setCreated] = useState<Date | null>(null);
  useEffect(() => {
    if (!username) return;
    getDoc(doc(db, "users", username.toLowerCase()))
      .then((snap) => {
        const ts = snap.exists() ? (snap.data() as { createdAt?: { toDate?: () => Date } }).createdAt : undefined;
        if (ts?.toDate) setCreated(ts.toDate());
      })
      .catch(() => {});
  }, [username]);
  const when = created ?? (firstDay ? new Date(firstDay) : null);
  return when ? when.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : null;
}

export default function Me() {
  const [, navigate] = useLocation();
  const { user, logout } = useUser();
  const { current, best, daysPlayed, entries, today } = useStreak(user?.username);
  const { stats } = useUserStats(user?.username);

  const firstDay = useMemo(() => entries.map((e) => e.dateKey).sort()[0], [entries]);
  const memberSince = useMemberSince(user?.username, firstDay);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.dateKey, (m.get(e.dateKey) ?? 0) + 1);
    return m;
  }, [entries]);

  const perGame = DAILY_GAMES.map((g) => {
    const scores = entries.filter((e) => e.game === g.slug).map((e) => e.score);
    return {
      game: g,
      plays: scores.length,
      best: scores.length ? Math.max(...scores) : 0,
      avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    };
  });
  const fullSets = [...counts.values()].filter((n) => n >= DAILY_GAMES.length).length;
  const invites = useInviteCount(user?.username);
  const arcadePlays = Object.values(stats).reduce((sum, s) => sum + (s?.plays ?? 0), 0)
    - DAILY_GAMES.reduce((sum, g) => sum + (stats[g.slug]?.plays ?? 0), 0);
  const badgeCtx: BadgeContext = useMemo(
    () => ({ entries, bestStreak: best, daysPlayed, fullSets, arcadePlays, invites }),
    [entries, best, daysPlayed, fullSets, arcadePlays, invites],
  );

  if (!user) return <HubPage><p className="text-muted-foreground">Sign in to see your stats.</p></HubPage>;

  return (
    <HubPage>
      <div className="flex items-center gap-3 mb-5">
        <span className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center text-3xl">{user.avatar}</span>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black text-foreground truncate">{user.username}</h1>
          <p className="text-sm text-muted-foreground">{memberSince ? `Member since ${memberSince}` : "Your stats live here"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatTile icon={Flame} label="Current streak" value={current} accent="text-orange-400" delay={0.05} hot={current > 0} />
        <StatTile icon={Award} label="Best streak" value={best} accent="text-amber-300" delay={0.1} />
        <StatTile icon={CalendarDays} label="Days played" value={daysPlayed} accent="text-sky-300" delay={0.15} />
        <StatTile icon={CheckCircle2} label="Full sets" value={fullSets} accent="text-emerald-300" delay={0.2} />
      </div>

      <BadgeGrid ctx={badgeCtx} username={user.username} />

      <InviteCard username={user.username} streak={current} invites={invites} />

      <InstallCard />

      {user.username.toLowerCase() === "tiger" && <PushTestCard />}

      <section className="rounded-2xl border border-border bg-card p-4 mb-6">
        <div className="flex items-center justify-between mb-3 gap-3">
          <h2 className="text-sm font-black text-foreground">Daily games played</h2>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>0</span>
            {HEAT.map((c) => <span key={c} className={`w-2.5 h-2.5 rounded-[3px] ${c}`} />)}
            <span>4</span>
          </div>
        </div>
        <Calendar counts={counts} today={today} />
      </section>

      <section className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Daily games</h2>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          {perGame.map(({ game, plays, best: top, avg }) => (
            <div key={game.slug} className="flex items-center gap-3 px-4 py-3">
              <span className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center ${game.accent}`}>
                <GameIcon game={game.slug} className="w-6 h-6" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-foreground truncate">{game.name}</span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {plays ? `${plays} played · avg ${avg.toLocaleString()}` : "Not played yet"}
                </span>
              </span>
              <span className="text-right">
                <span className={`block text-base font-black tabular-nums ${game.accent}`}>{plays ? top.toLocaleString() : "–"}</span>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Best</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Arcade high scores</h2>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          {ARCADE_NAMES.map((g) => {
            const s = stats[g.slug] ?? { plays: 0, highScore: 0 };
            return (
              <div key={g.slug} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl">{g.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-foreground truncate">{g.name}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">{s.plays ? `${s.plays} played` : "Not played yet"}</span>
                </span>
                <span className="text-base font-black tabular-nums text-amber-300 text-right">{s.plays ? s.highScore.toLocaleString() : "–"}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="text-center">
        <button
          onClick={() => { logout(); navigate("/"); }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>
    </HubPage>
  );
}
