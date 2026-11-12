import { useCallback, useEffect, useState } from "react";
import { collection, getCountFromServer, getDocs, query, where, Timestamp } from "firebase/firestore";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { RefreshCw } from "lucide-react";
import { db } from "@/lib/firebase";
import { useUser } from "@/lib/user-context";
import { HubPage } from "@/components/app-nav";
import { DAILY_GAMES, shiftDay, todayKey } from "@/lib/daily";
import type { DailyGameSlug } from "@/lib/daily-score";

// Private stats page for the site owner. Not linked anywhere; everything here is readable
// by the client anyway, the username check just keeps it out of other players' way.
const ADMINS = ["tiger"];
const DAYS = 8;

interface Row { username: string; game: DailyGameSlug; score: number; at: number }
interface DayStats { day: string; players: number; games: number; signups: number; fullSets: number; backNext: number | null }

interface Stats {
  loadedAt: Date;
  today: string;
  days: DayStats[];
  todayRows: Row[];
  yesterdayPlayers: Set<string>;
  hourly: { hour: string; playsToday: number | null; playsYesterday: number; signupsToday: number | null; signupsYesterday: number }[];
  invites: { user: string; by: string; at: string }[];
  totalUsers: number;
  arcadeToday: number;
}

const startOfDay = (dateKey: string) => { const [y, m, d] = dateKey.split("-").map(Number); return new Date(y, m - 1, d); };

async function loadStats(): Promise<Stats> {
  const today = todayKey();
  const dayKeys = Array.from({ length: DAYS }, (_, i) => shiftDay(today, -(DAYS - 1 - i)));
  const scores = collection(db, "daily-scores");
  const users = collection(db, "users");

  const [perDay, recentUsers, referred, totalUsers, arcadeToday] = await Promise.all([
    Promise.all(dayKeys.map((d) => getDocs(query(scores, where("dateKey", "==", d))))),
    getDocs(query(users, where("createdAt", ">=", Timestamp.fromDate(startOfDay(dayKeys[0]))))),
    getDocs(query(users, where("referredBy", ">", ""))),
    getCountFromServer(users),
    getCountFromServer(query(collection(db, "scores"), where("timestamp", ">=", Timestamp.fromDate(startOfDay(today))))),
  ]);

  const rowsByDay = perDay.map((snap) => snap.docs.map((d) => {
    const x = d.data() as { username: string; game: DailyGameSlug; score: number; timestamp?: Timestamp };
    return { username: x.username.toLowerCase(), game: x.game, score: x.score, at: x.timestamp?.toMillis() ?? 0 };
  }));
  const playersByDay = rowsByDay.map((rows) => new Set(rows.map((r) => r.username)));
  const signupTimes = recentUsers.docs.map((d) => (d.data().createdAt as Timestamp | undefined)?.toMillis() ?? 0).filter(Boolean);
  const localKey = (ms: number) => { const t = new Date(ms); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };

  const days: DayStats[] = dayKeys.map((day, i) => {
    const perUser = new Map<string, number>();
    for (const r of rowsByDay[i]) perUser.set(r.username, (perUser.get(r.username) ?? 0) + 1);
    const next = playersByDay[i + 1];
    const back = next ? [...playersByDay[i]].filter((u) => next.has(u)).length : null;
    return {
      day,
      players: playersByDay[i].size,
      games: rowsByDay[i].length,
      signups: signupTimes.filter((ms) => localKey(ms) === day).length,
      fullSets: [...perUser.values()].filter((n) => n >= DAILY_GAMES.length).length,
      backNext: back === null || !playersByDay[i].size ? null : back / playersByDay[i].size,
    };
  });

  const nowHour = new Date().getHours();
  const byHour = (msList: number[], day: string) => {
    const c = Array(24).fill(0);
    for (const ms of msList) if (localKey(ms) === day) c[new Date(ms).getHours()]++;
    return c;
  };
  const yesterday = dayKeys[DAYS - 2];
  const pT = byHour(rowsByDay[DAYS - 1].map((r) => r.at), today), pY = byHour(rowsByDay[DAYS - 2].map((r) => r.at), yesterday);
  const sT = byHour(signupTimes, today), sY = byHour(signupTimes, yesterday);
  const hourly = pT.map((_, h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    playsToday: h <= nowHour ? pT[h] : null, playsYesterday: pY[h],
    signupsToday: h <= nowHour ? sT[h] : null, signupsYesterday: sY[h],
  }));

  const invites = referred.docs
    .map((d): { user: string; by: string; ms: number } => ({ user: d.id, by: String(d.data().referredBy), ms: (d.data().createdAt as Timestamp | undefined)?.toMillis() ?? 0 }))
    .sort((a, b) => b.ms - a.ms)
    .map(({ user, by, ms }) => ({ user, by, at: new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) }));

  return {
    loadedAt: new Date(), today, days, todayRows: rowsByDay[DAYS - 1], yesterdayPlayers: playersByDay[DAYS - 2],
    hourly, invites, totalUsers: totalUsers.data().count, arcadeToday: arcadeToday.data().count,
  };
}

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className="text-2xl font-black tabular-nums text-foreground leading-tight mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function HourlyChart({ data, today, yesterday, label }: { data: Stats["hourly"]; today: "playsToday" | "signupsToday"; yesterday: "playsYesterday" | "signupsYesterday"; label: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-black text-foreground">{label} per hour</h2>
        <div className="flex gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5 bg-sky-400" />Today</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 border-t border-dashed border-muted-foreground" />Yesterday</span>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="hour" tick={{ fill: "#888", fontSize: 10 }} interval={3} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "#888", fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "#16181e", border: "1px solid #2a2d35", borderRadius: 10, fontSize: 12 }} />
            <Line type="monotone" dataKey={yesterday} name="Yesterday" stroke="#888780" strokeDasharray="4 4" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey={today} name="Today" stroke="#38bdf8" strokeWidth={2.5} dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);
const shortDay = (k: string) => startOfDay(k).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export default function StatsPage() {
  const { user } = useUser();
  const isAdmin = !!user && ADMINS.includes(user.username.toLowerCase());
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    loadStats().then(setStats).catch((e) => setError(String(e?.message ?? e))).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (isAdmin) refresh(); }, [isAdmin, refresh]);

  if (!isAdmin) return <HubPage><p className="text-muted-foreground">Nothing to see here.</p></HubPage>;

  const t = stats;
  const todayDay = t?.days[t.days.length - 1];
  const todayPlayers = new Set(t?.todayRows.map((r) => r.username) ?? []);
  const back = t ? [...t.yesterdayPlayers].filter((u) => todayPlayers.has(u)).length : 0;

  return (
    <HubPage wide>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">Stats</h1>
          <p className="text-xs text-muted-foreground">{t ? `Updated ${t.loadedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "Loading…"}</p>
        </div>
        <button onClick={refresh} disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold hover:bg-muted disabled:opacity-60">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {t && todayDay && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <Tile label="Players today" value={todayDay.players} sub={`${t.days[t.days.length - 2].players} yesterday`} />
            <Tile label="Daily games" value={todayDay.games} sub={`${(todayDay.games / Math.max(1, todayDay.players)).toFixed(1)} per player`} />
            <Tile label="Sign-ups today" value={todayDay.signups} sub={`${t.totalUsers} accounts total`} />
            <Tile label="Back from yesterday" value={back} sub={`${pct(t.yesterdayPlayers.size ? back / t.yesterdayPlayers.size : null)} of ${t.yesterdayPlayers.size}`} />
            <Tile label="Full sets today" value={todayDay.fullSets} />
            <Tile label="Arcade games today" value={t.arcadeToday} />
          </div>

          <HourlyChart data={t.hourly} today="playsToday" yesterday="playsYesterday" label="Daily games finished" />
          <HourlyChart data={t.hourly} today="signupsToday" yesterday="signupsYesterday" label="Sign-ups" />

          <section className="rounded-2xl border border-border bg-card p-4 mb-4 overflow-x-auto">
            <h2 className="text-sm font-black text-foreground mb-2">Last {DAYS} days</h2>
            <table className="w-full text-sm tabular-nums">
              <thead className="text-[11px] text-muted-foreground">
                <tr><th className="text-left font-semibold py-1">Day</th><th className="text-right font-semibold">Players</th><th className="text-right font-semibold">Games</th><th className="text-right font-semibold">Sign-ups</th><th className="text-right font-semibold">Full sets</th><th className="text-right font-semibold">Back next day</th></tr>
              </thead>
              <tbody>
                {[...t.days].reverse().map((d) => (
                  <tr key={d.day} className="border-t border-border/60">
                    <td className="py-1.5 text-foreground">{shortDay(d.day)}</td>
                    <td className="text-right">{d.players}</td>
                    <td className="text-right">{d.games}</td>
                    <td className="text-right">{d.signups}</td>
                    <td className="text-right">{d.fullSets}</td>
                    <td className="text-right font-bold">{d.backNext === null ? <span className="text-muted-foreground font-normal">today</span> : pct(d.backNext)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 mb-4 overflow-x-auto">
            <h2 className="text-sm font-black text-foreground mb-2">Today by game</h2>
            <table className="w-full text-sm tabular-nums">
              <thead className="text-[11px] text-muted-foreground">
                <tr><th className="text-left font-semibold py-1">Game</th><th className="text-right font-semibold">Finished</th><th className="text-right font-semibold">Avg score</th><th className="text-right font-semibold">Best</th></tr>
              </thead>
              <tbody>
                {DAILY_GAMES.map((g) => {
                  const sc = t.todayRows.filter((r) => r.game === g.slug).map((r) => r.score);
                  return (
                    <tr key={g.slug} className="border-t border-border/60">
                      <td className={`py-1.5 font-bold ${g.accent}`}>{g.name}</td>
                      <td className="text-right">{sc.length}</td>
                      <td className="text-right">{sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : "–"}</td>
                      <td className="text-right">{sc.length ? Math.max(...sc) : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 mb-4">
            <h2 className="text-sm font-black text-foreground mb-2">Invites ({t.invites.length})</h2>
            {t.invites.length === 0 ? <p className="text-sm text-muted-foreground">None yet</p> : (
              <ul className="text-sm space-y-1">
                {t.invites.map((i) => (
                  <li key={i.user} className="flex justify-between gap-3"><span><span className="font-bold text-foreground">{i.user}</span> <span className="text-muted-foreground">via</span> {i.by}</span><span className="text-xs text-muted-foreground">{i.at}</span></li>
                ))}
              </ul>
            )}
          </section>
          <p className="text-[11px] text-muted-foreground">Counts are finished games saved to the scoreboard (Firestore). Behaviour such as drop-off and hints is in Google Analytics.</p>
        </>
      )}
    </HubPage>
  );
}
