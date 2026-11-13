import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { db } from "@/lib/firebase";
import { useUser } from "@/lib/user-context";
import { HubPage } from "@/components/app-nav";
import { DAILY_GAMES, shiftDay, todayKey } from "@/lib/daily";
import type { DailyGameSlug } from "@/lib/daily-score";

// Private stats page for the site owner (not linked anywhere). Data is kept on this device and
// only what's new since the last visit is fetched, so refreshing costs a handful of reads.
const ADMINS = ["tiger"];
const WINDOW_DAYS = 14;
const CACHE_KEY = "pcb-stats-cache-v3";
const OVERLAP_MS = 5 * 60 * 1000; // re-read a few minutes back in case of late server timestamps

const C = { signups: "#a78bfa", players: "#38bdf8", guests: "#94a3b8", grid: "rgba(255,255,255,0.06)", axis: "#8a8a86" };
const BANDS = [
  { key: "g1", label: "1 game", colour: "#1e5a7a" },
  { key: "g2", label: "2 games", colour: "#2b84b4" },
  { key: "g3", label: "3 games", colour: "#38bdf8" },
  { key: "g4", label: "All 4", colour: "#34d399" },
] as const;

interface Play { id: string; user: string; game: DailyGameSlug; day: string; score: number; at: number; late?: boolean; fromGuest?: string }
interface ArcadePlay { user: string; game: string; at: number; fromGuest?: string }
interface Cache {
  plays: Record<string, Play>;
  arcade: Record<string, ArcadePlay>;

  users: Record<string, { at: number; ref?: string; fromGuest?: string; guestGames?: number }>;
  playsUntil: number;
  usersUntil: number;
}

const ARCADE: { slug: string; name: string; colour: string }[] = [
  { slug: "clubladder", name: "Ladder Up", colour: "#2a78d6" },
  { slug: "goalchain", name: "GoalChain", colour: "#eb6834" },
  { slug: "overlap", name: "Overlap", colour: "#1baf7a" },
  { slug: "targetman", name: "TargetMan", colour: "#eda100" },
  { slug: "slamchain", name: "Slam16", colour: "#e87ba4" },
  { slug: "gridlock", name: "GridLock", colour: "#6250d6" },
  { slug: "arsenal-champions-2026", name: "Champions Quiz", colour: "#e34948" },
];
const DAILY_COLOURS: Record<string, string> = { careerpath: "#8b5cf6", photofinish: "#fbbf24", centrecircle: "#34d399", griddle: "#38bdf8" };

const dayStart = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d).getTime(); };
const localDay = (ms: number) => { const t = new Date(ms); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
const dayLabel = (k: string) => new Date(dayStart(k)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

function readCache(): Cache | null {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { return null; }
}

async function refreshData(): Promise<{ cache: Cache; reads: number }> {
  const start = dayStart(shiftDay(todayKey(), -(WINDOW_DAYS - 1)));
  const old = readCache();
  const cache: Cache = old && old.playsUntil > start
    ? old
    : { plays: {}, arcade: {}, users: {}, playsUntil: start, usersUntil: start };
  const now = Date.now();
  const since = Timestamp.fromMillis(Math.max(start, cache.playsUntil - OVERLAP_MS));
  const [p, a, u] = await Promise.all([
    getDocs(query(collection(db, "daily-scores"), where("timestamp", ">=", since))),
    getDocs(query(collection(db, "scores"), where("timestamp", ">=", since))),
    getDocs(query(collection(db, "users"), where("createdAt", ">=", Timestamp.fromMillis(Math.max(start, cache.usersUntil - OVERLAP_MS))))),
  ]);
  if (p.metadata.fromCache || a.metadata.fromCache || u.metadata.fromCache) throw new Error("Offline: showing the last saved numbers");
  a.docs.forEach((d) => {
    const x = d.data() as { username?: string; game?: string; timestamp?: Timestamp; playedAt?: Timestamp; fromGuest?: string };
    cache.arcade[d.id] = { user: (x.username ?? "").toLowerCase(), game: x.game ?? "?", at: (x.playedAt ?? x.timestamp)?.toMillis?.() ?? now, fromGuest: x.fromGuest };
  });
  p.docs.forEach((d) => {
    const x = d.data() as { username: string; game: DailyGameSlug; dateKey: string; score: number; timestamp?: Timestamp; playedAt?: Timestamp; late?: boolean; fromGuest?: string };
    cache.plays[d.id] = { id: d.id, user: x.username.toLowerCase(), game: x.game, day: x.dateKey, score: x.score, at: (x.playedAt ?? x.timestamp)?.toMillis?.() ?? now, late: x.late || undefined, fromGuest: x.fromGuest };
  });
  u.docs.forEach((d) => {
    const x = d.data() as { createdAt?: Timestamp; referredBy?: string; fromGuest?: string; guestGames?: number };
    cache.users[d.id] = { at: x.createdAt?.toMillis() ?? now, ref: x.referredBy, fromGuest: x.fromGuest, guestGames: x.guestGames };
  });
  // Drop anything that has fallen out of the window
  for (const [id, x] of Object.entries(cache.plays)) if (x.at < start) delete cache.plays[id];
  for (const [id, x] of Object.entries(cache.arcade)) if (x.at < start) delete cache.arcade[id];
  for (const [id, x] of Object.entries(cache.users)) if (x.at < start) delete cache.users[id];
  cache.playsUntil = now;
  cache.usersUntil = now;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* ignore */ }
  return { cache, reads: p.size + a.size + u.size };
}

function crunch(cache: Cache) {
  const today = todayKey();
  const isGuest = (u: string) => u.startsWith("guest-");
  // Guests who picked a name: their games were copied to the account, so their guest copies are dropped
  // (the account's copy counts). Known from the account (users.fromGuest) or the copies themselves.
  const convertedGuests = new Map<string, string>();
  for (const [n, x] of Object.entries(cache.users)) if (x.fromGuest) convertedGuests.set(x.fromGuest, n);
  for (const p of Object.values(cache.plays)) if (p.fromGuest) convertedGuests.set(p.fromGuest, p.user);
  for (const p of Object.values(cache.arcade)) if (p.fromGuest) convertedGuests.set(p.fromGuest, p.user);
  // Every daily game (old yesterday's-set plays aside), guests included
  const allPlays = Object.values(cache.plays).filter((p) => !p.late);
  const plays = allPlays.filter((p) => !(isGuest(p.user) && convertedGuests.has(p.user)));
  const users = Object.entries(cache.users);
  const days7 = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6));

  // Who played which day (by the puzzle's date) and how many games
  const byDay = new Map<string, Map<string, number>>();
  for (const pl of plays) {
    if (!byDay.has(pl.day)) byDay.set(pl.day, new Map());
    const m = byDay.get(pl.day)!;
    m.set(pl.user, (m.get(pl.user) ?? 0) + 1);
  }
  const signupDay = new Map(users.map(([name, x]) => [name, localDay(x.at)]));
  const guestPlays = plays.filter((p) => isGuest(p.user));
  const guestsOn = (d: string) => new Set(guestPlays.filter((x) => x.day === d).map((x) => x.user)).size;
  const namedOn = (d: string) => [...(byDay.get(d)?.keys() ?? [])].filter((u) => !isGuest(u)).length;

  // Last 24 hours, hour by hour
  const now = Date.now();
  const hourStart = new Date(now); hourStart.setMinutes(0, 0, 0);
  const hours = Array.from({ length: 24 }, (_, i) => hourStart.getTime() - (23 - i) * 3600e3);
  const last24 = hours.map((h) => {
    const inHour = (ms: number) => ms >= h && ms < h + 3600e3;
    return {
      label: new Date(h).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      Signups: users.filter(([, x]) => inHour(x.at)).length,
      Players: new Set(plays.filter((p) => inHour(p.at) && !isGuest(p.user)).map((p) => p.user)).size,
      Guests: new Set(guestPlays.filter((p) => inHour(p.at)).map((p) => p.user)).size,
    };
  });

  // Last 7 days
  const week = days7.map((d) => ({
    label: dayLabel(d),
    Signups: users.filter(([, x]) => localDay(x.at) === d).length,
    Players: namedOn(d),
    Guests: guestsOn(d),
  }));

  // Games per player per day, and sign-ups who finished nothing that day ("bounced")
  const spread = days7.map((d) => {
    const m = byDay.get(d) ?? new Map<string, number>();
    const row: Record<string, number | string> = { label: dayLabel(d), g1: 0, g2: 0, g3: 0, g4: 0 };
    for (const n of m.values()) row[`g${Math.min(4, n)}`] = (row[`g${Math.min(4, n)}`] as number) + 1;
    return row;
  });
  const bounce = days7.map((d) => {
    const signed = [...signupDay].filter(([, sd]) => sd === d).map(([n]) => n);
    const none = signed.filter((n) => !byDay.get(d)?.has(n)).length;
    return { label: dayLabel(d), signed: signed.length, none };
  });

  // Returning vs new players: returning = finished a daily game on an earlier day
  const firstDay = new Map<string, string>();
  for (const [d, m] of [...byDay].sort(([a], [b]) => a.localeCompare(b))) for (const u of m.keys()) if (!firstDay.has(u)) firstDay.set(u, d);
  const returning = days7.map((d) => {
    const m = byDay.get(d) ?? new Map<string, number>();
    let back = 0;
    for (const u of m.keys()) if ((firstDay.get(u) ?? d) < d) back++;
    return { label: dayLabel(d), Returning: back, New: m.size - back };
  });

  // Daily games finished per day, by game
  const gamesByDay = days7.map((d) => {
    const row: Record<string, number | string> = { label: dayLabel(d) };
    for (const g of DAILY_GAMES) row[g.slug] = plays.filter((p) => p.day === d && p.game === g.slug).length;
    return row;
  });

  // Arcade: games per day by game, today's totals
  const arcadePlays = Object.values(cache.arcade).filter((p) => !(isGuest(p.user) && convertedGuests.has(p.user)));
  const arcadeByDay = days7.map((d) => {
    const row: Record<string, number | string> = { label: dayLabel(d) };
    for (const g of ARCADE) row[g.slug] = arcadePlays.filter((p) => localDay(p.at) === d && p.game === g.slug).length;
    return row;
  });
  const arcadeToday = arcadePlays.filter((p) => localDay(p.at) === today);
  const arcadeWeek = arcadePlays.filter((p) => localDay(p.at) >= days7[0]);
  const arcade = {
    today: arcadeToday.length,
    todayPlayers: new Set(arcadeToday.map((p) => p.user)).size,
    week: arcadeWeek.length,
    weekPlayers: new Set(arcadeWeek.map((p) => p.user)).size,
    byGame: ARCADE.map((g) => ({ ...g, week: arcadeWeek.filter((p) => p.game === g.slug).length, players: new Set(arcadeWeek.filter((p) => p.game === g.slug).map((p) => p.user)).size }))
      .sort((a, b) => b.week - a.week),
  };

  // Cohorts by sign-up day: "all" = every sign-up; "played" = only those who finished a daily
  // game on the day they signed up (people who actually engaged, without the bounces).
  const cohortDays = Array.from({ length: 10 }, (_, i) => shiftDay(today, -i)).filter((d) => [...signupDay.values()].includes(d));
  const cohortRow = (d: string, members: string[]) => {
    const playedOn = (offset: number) => {
      const k = shiftDay(d, offset);
      if (k > today) return null;
      const m = byDay.get(k);
      return members.filter((n) => m?.has(n)).length;
    };
    const everBack = members.filter((n) => [...byDay].some(([k, m]) => k > d && m.has(n))).length;
    return { day: d, size: members.length, d: Array.from({ length: 7 }, (_, i) => playedOn(i)), everBack, open: d === today };
  };
  const signedUpOn = (d: string) => [...signupDay].filter(([, sd]) => sd === d).map(([n]) => n);
  const cohorts = {
    all: cohortDays.map((d) => cohortRow(d, signedUpOn(d))),
    played: cohortDays.map((d) => cohortRow(d, signedUpOn(d).filter((n) => byDay.get(d)?.has(n)))).filter((c) => c.size > 0),
  };

  // Today: tiles and per-game
  const todayPlayers = byDay.get(today) ?? new Map();
  const yPlayers = byDay.get(shiftDay(today, -1)) ?? new Map();
  const back = [...yPlayers.keys()].filter((n) => todayPlayers.has(n)).length;
  const newToday = [...signupDay].filter(([, sd]) => sd === today).map(([n]) => n);
  const perGame = DAILY_GAMES.map((g) => {
    const sc = plays.filter((p) => p.day === today && p.game === g.slug).map((p) => p.score);
    return { game: g, n: sc.length, avg: sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : null, best: sc.length ? Math.max(...sc) : null };
  });
  // --- Guests: everyone who played without a name this week, and which of them picked one
  const rawGuestPlays = allPlays.filter((p) => isGuest(p.user));
  const weekGuestPlays = rawGuestPlays.filter((p) => p.day >= days7[0]);
  const guestDays = new Map<string, Set<string>>();
  for (const p of weekGuestPlays) { if (!guestDays.has(p.user)) guestDays.set(p.user, new Set()); guestDays.get(p.user)!.add(p.day); }
  const firstGuestDay = new Map<string, string>();
  for (const p of rawGuestPlays) if (!firstGuestDay.has(p.user) || p.day < firstGuestDay.get(p.user)!) firstGuestDay.set(p.user, p.day);
  const weekGuests = [...guestDays.keys()];
  const guestFunnel = {
    guests: weekGuests.length,
    named: weekGuests.filter((g) => convertedGuests.has(g)).length,
    stayingGuest: weekGuests.filter((g) => !convertedGuests.has(g) && guestDays.get(g)!.size >= 2).length,
    oneAndDone: weekGuests.filter((g) => !convertedGuests.has(g) && guestDays.get(g)!.size === 1).length,
    gamesPerGuest: weekGuests.length ? Math.round((weekGuestPlays.length / weekGuests.length) * 10) / 10 : 0,
    gamesBeforeName: (() => { const n = users.filter(([, x]) => x.fromGuest && x.guestGames != null); return n.length ? Math.round((n.reduce((a, [, x]) => a + x.guestGames!, 0) / n.length) * 10) / 10 : null; })(),
    days: days7.map((d) => {
      const on = new Set(weekGuestPlays.filter((p) => p.day === d).map((p) => p.user));
      return {
        label: dayLabel(d),
        guests: on.size,
        newGuests: [...on].filter((g) => firstGuestDay.get(g) === d).length,
        named: users.filter(([, x]) => x.fromGuest && localDay(x.at) === d).length,
      };
    }),
  };
  const guestsTodayUnnamed = guestsOn(today);

  const invites = users.filter(([, x]) => x.ref).sort((a, b) => b[1].at - a[1].at).map(([n, x]) => ({ user: n, by: x.ref!, at: x.at }));

  return {
    last24, week, spread, bounce, returning, gamesByDay, arcadeByDay, arcade, cohorts, perGame, invites, guestFunnel,
    tiles: {
      guests: guestsTodayUnnamed,
      named: namedOn(today),
      players: todayPlayers.size,
      playersY: yPlayers.size,
      returningToday: returning[returning.length - 1].Returning,
      signups: newToday.length,
      newPlayed: newToday.filter((n) => todayPlayers.has(n)).length,
      back, backOf: yPlayers.size,
      fullSets: [...todayPlayers.values()].filter((n) => n >= 4).length,
    },
  };
}

// --- UI pieces ---

function Card({ title, note, children, right }: { title: string; note?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card/80 p-4 sm:p-5 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-base font-black text-foreground">{title}</h2>
          {note && <p className="text-xs text-muted-foreground mt-0.5">{note}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Legend({ items }: { items: { label: string; colour: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: i.colour }} />{i.label}</span>
      ))}
    </div>
  );
}

function Tile({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/80 p-3.5">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className={`text-3xl font-black tabular-nums leading-tight mt-0.5 ${accent ?? "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

const tooltipStyle = { background: "#16181e", border: "1px solid #2a2d35", borderRadius: 12, fontSize: 12 };

function TwoLines({ data }: { data: { label: string; Signups: number; Players: number; Guests?: number }[] }) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: C.axis, fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
          <YAxis allowDecimals={false} tick={{ fill: C.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="Signups" stroke={C.signups} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="Players" stroke={C.players} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          {data.some((d) => d.Guests) && <Line type="monotone" dataKey="Guests" stroke={C.guests} strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={{ r: 4 }} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function StackedBars({ data, series, height = "h-56" }: { data: Record<string, number | string>[]; series: { key: string; label: string; colour: string }[]; height?: string }) {
  return (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: C.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: C.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }}
            formatter={(v: number, k: string) => [v, series.find((x) => x.key === k)?.label ?? k]} />
          {series.map((x, i) => (
            <Bar key={x.key} dataKey={x.key} stackId="a" fill={x.colour} maxBarSize={44}
              radius={i === series.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function cellStyle(p: number | null) {
  if (p === null) return {};
  return { background: `rgba(56,189,248,${0.08 + (p / 100) * 0.62})` };
}

export default function StatsPage() {
  const { user } = useUser();
  const isAdmin = !!user && ADMINS.includes(user.username.toLowerCase());
  const [cache, setCache] = useState<Cache | null>(() => readCache());
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    refreshData()
      .then(({ cache, reads }) => { setCache(cache); setUpdated(new Date()); setNote(`${reads} new records fetched`); })
      .catch((e) => setNote(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (isAdmin) refresh(); }, [isAdmin, refresh]);

  const s = useMemo(() => (cache ? crunch(cache) : null), [cache]);

  if (!isAdmin) return <HubPage><p className="text-muted-foreground">Nothing to see here.</p></HubPage>;

  return (
    <HubPage wide>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Stats</h1>
          <p className="text-xs text-muted-foreground">
            {updated ? `Updated ${updated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : loading ? "Loading…" : "Showing saved numbers"}
            {note ? ` · ${note}` : ""}
          </p>
        </div>
        <button onClick={refresh} disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-bold hover:bg-muted disabled:opacity-60">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {s && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Tile label="Players today" value={s.tiles.players} sub={`${s.tiles.named} named · ${s.tiles.guests} guests · ${s.tiles.returningToday} returning`} accent="text-sky-300" />
            <Tile label="Sign-ups today" value={s.tiles.signups} sub={`${pct(s.tiles.newPlayed, s.tiles.signups)}% finished a game`} accent="text-violet-300" />
            <Tile label="Back from yesterday" value={`${pct(s.tiles.back, s.tiles.backOf)}%`} sub={`${s.tiles.back} of ${s.tiles.backOf} players`} />
            <Tile label="Full sets today" value={s.tiles.fullSets} sub="finished all four" accent="text-emerald-300" />
          </div>

          <div className="grid lg:grid-cols-2 gap-x-4">
            <Card title="Last 24 hours" note="Per hour: new accounts, and different people finishing a daily game (guests = no name yet)"
              right={<Legend items={[{ label: "Sign-ups", colour: C.signups }, { label: "Players", colour: C.players }, { label: "Guests", colour: C.guests }]} />}>
              <TwoLines data={s.last24} />
            </Card>
            <Card title="Last 7 days" note="Per day: new accounts, and different people finishing a daily game (guests = no name yet)"
              right={<Legend items={[{ label: "Sign-ups", colour: C.signups }, { label: "Players", colour: C.players }, { label: "Guests", colour: C.guests }]} />}>
              <TwoLines data={s.week} />
            </Card>
          </div>

          <Card title="Returning vs new players" note="Different people finishing a daily game each day. Returning = had already played on an earlier day. This is the number that has to hold up without Reddit posts"
            right={<Legend items={[{ label: "Returning", colour: "#34d399" }, { label: "New", colour: "#2b84b4" }]} />}>
            <StackedBars data={s.returning} series={[{ key: "Returning", label: "Returning", colour: "#34d399" }, { key: "New", label: "New", colour: "#2b84b4" }]} />
          </Card>

          <div className="grid lg:grid-cols-2 gap-x-4">
            <Card title="Daily games finished" note="Per day, by game">
              <Legend items={DAILY_GAMES.map((g) => ({ label: g.name, colour: DAILY_COLOURS[g.slug] }))} />
              <div className="mt-2"><StackedBars data={s.gamesByDay} series={DAILY_GAMES.map((g) => ({ key: g.slug, label: g.name, colour: DAILY_COLOURS[g.slug] }))} /></div>
            </Card>
            <Card title="How much people play" note="Players each day by how many daily games they finished">
              <Legend items={BANDS.map((b) => ({ label: b.label, colour: b.colour }))} />
              <div className="mt-2"><StackedBars data={s.spread} series={BANDS.map((b) => ({ key: b.key, label: b.label, colour: b.colour }))} /></div>
            </Card>
          </div>

          <Card title="Sign-ups who finished nothing" note="Share of each day's new accounts that didn't finish a daily game that day (most people now play as a guest before picking a name)">
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {s.bounce.map((b) => (
                <div key={b.label} className="rounded-xl bg-white/[0.03] border border-border px-2 py-2 text-center">
                  <p className="text-[10px] text-muted-foreground">{b.label}</p>
                  <p className="text-lg font-black tabular-nums text-foreground">{b.signed ? `${pct(b.none, b.signed)}%` : "–"}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">{b.none} of {b.signed}</p>
                </div>
              ))}
            </div>
          </Card>

          <CohortCard cohorts={s.cohorts} />

          <Card title="Guests" note="Last 7 days. Guests play without a name. Picked a name = signed up from a guest on that device. Staying guest = played on 2+ days without picking a name (happy as they are)">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {[
                { label: "Guests who played", value: s.guestFunnel.guests, sub: `${s.guestFunnel.gamesPerGuest} games each` },
                { label: "Picked a name", value: `${pct(s.guestFunnel.named, s.guestFunnel.guests)}%`, sub: `${s.guestFunnel.named} of ${s.guestFunnel.guests}${s.guestFunnel.gamesBeforeName != null ? ` · after ${s.guestFunnel.gamesBeforeName} games` : ""}` },
                { label: "Staying guest", value: `${pct(s.guestFunnel.stayingGuest, s.guestFunnel.guests)}%`, sub: `${s.guestFunnel.stayingGuest} back on 2+ days, no name` },
                { label: "One day, no name", value: `${pct(s.guestFunnel.oneAndDone, s.guestFunnel.guests)}%`, sub: `${s.guestFunnel.oneAndDone} so far` },
              ].map((t) => (
                <div key={t.label} className="rounded-xl bg-white/[0.03] border border-border px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">{t.label}</p>
                  <p className="text-lg font-black tabular-nums text-foreground">{t.value}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">{t.sub}</p>
                </div>
              ))}
            </div>
            <table className="w-full text-xs tabular-nums">
              <thead className="text-[10px] text-muted-foreground">
                <tr><th className="text-left font-semibold py-1">Day</th><th className="text-right font-semibold">Guests</th><th className="text-right font-semibold">New guests</th><th className="text-right font-semibold">Picked a name</th></tr>
              </thead>
              <tbody>
                {s.guestFunnel.days.map((d) => (
                  <tr key={d.label} className="border-t border-border/60">
                    <td className="py-1.5 text-foreground">{d.label}</td>
                    <td className="text-right text-foreground">{d.guests || "–"}</td>
                    <td className="text-right text-muted-foreground">{d.newGuests || "–"}</td>
                    <td className="text-right font-bold text-emerald-300">{d.named || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Arcade" note="Arcade games finished per day, by game"
            right={<div className="text-right text-xs text-muted-foreground tabular-nums"><p><span className="text-foreground font-black">{s.arcade.today}</span> today · {s.arcade.todayPlayers} players</p><p>{s.arcade.week} this week · {s.arcade.weekPlayers} players</p></div>}>
            <Legend items={ARCADE.map((g) => ({ label: g.name, colour: g.colour }))} />
            <div className="mt-2"><StackedBars data={s.arcadeByDay} series={ARCADE.map((g) => ({ key: g.slug, label: g.name, colour: g.colour }))} height="h-48" /></div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {s.arcade.byGame.filter((g) => g.week > 0).map((g) => (
                <div key={g.slug} className="rounded-xl bg-white/[0.03] border border-border px-3 py-2">
                  <p className="text-[11px] font-bold" style={{ color: g.colour }}>{g.name}</p>
                  <p className="text-sm text-foreground tabular-nums"><span className="font-black">{g.week}</span> <span className="text-muted-foreground text-xs">games · {g.players} players</span></p>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-x-4">
            <Card title="Today by game" note="Daily games finished today">
              <div className="space-y-2">
                {s.perGame.map(({ game, n, avg, best }) => {
                  const max = Math.max(1, ...s.perGame.map((x) => x.n));
                  return (
                    <div key={game.slug}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className={`font-bold ${game.accent}`}>{game.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">avg {avg ?? "–"} · best {best ?? "–"}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden"><div className={`h-full rounded-full ${game.bar}`} style={{ width: `${(n / max) * 100}%` }} /></div>
                        <span className="w-9 text-right text-sm font-black tabular-nums">{n}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card title={`Invites (${s.invites.length})`} note="Sign-ups that came through someone's link, last two weeks">
              {s.invites.length === 0 ? <p className="text-sm text-muted-foreground">None yet</p> : (
                <ul className="text-sm space-y-1.5">
                  {s.invites.map((i) => (
                    <li key={i.user} className="flex justify-between gap-3">
                      <span><span className="font-bold text-foreground">{i.user}</span> <span className="text-muted-foreground">via</span> {i.by}</span>
                      <span className="text-xs text-muted-foreground">{new Date(i.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <p className="text-[11px] text-muted-foreground">From the scoreboard (finished games and sign-ups). Drop-off, hints and what people opened are in Google Analytics.</p>
        </>
      )}
    </HubPage>
  );
}

type CohortRow = { day: string; size: number; d: (number | null)[]; everBack: number; open: boolean };

function CohortCard({ cohorts }: { cohorts: { all: CohortRow[]; played: CohortRow[] } }) {
  const [mode, setMode] = useState<"played" | "all">("played");
  const rows = cohorts[mode];
  const first = mode === "played" ? 1 : 0; // Day 0 is 100% by definition for players
  const heads = ["Day 0", "Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6"].slice(first);
  const note = mode === "played"
    ? "People who signed up and finished a daily game that same day, and the share who finished one on each day after. Leaves out sign-up bounces. Ever back = played on any later day"
    : "Everyone who signed up on a day, and the share who finished a daily game on each day after. Ever back = played on any later day";
  const toggle = (
    <div className="flex rounded-full bg-white/5 p-0.5 text-[11px] font-bold">
      {([["played", "Players"], ["all", "All sign-ups"]] as const).map(([k, label]) => (
        <button key={k} onClick={() => setMode(k)} className={`rounded-full px-2.5 py-1 ${mode === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{label}</button>
      ))}
    </div>
  );
  return (
    <Card title="Cohorts" note={note} right={toggle}>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs tabular-nums border-separate" style={{ borderSpacing: "3px" }}>
          <thead className="text-[10px] text-muted-foreground">
            <tr>
              <th className="text-left font-semibold px-1">Signed up</th><th className="text-right font-semibold px-1">People</th>
              {heads.map((h) => <th key={h} className="font-semibold px-1">{h}</th>)}
              <th className="font-semibold px-1">Ever back</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.day}>
                <td className="px-1 py-1 text-foreground whitespace-nowrap">{dayLabel(c.day)}</td>
                <td className="px-1 text-right text-muted-foreground">{c.size}</td>
                {c.d.slice(first).map((n, i) => {
                  const p = n === null ? null : pct(n, c.size);
                  return (
                    <td key={i} className="text-center rounded-md px-1.5 py-1.5 text-foreground" style={cellStyle(p)} title={n === null ? "" : `${n} of ${c.size}`}>
                      {p === null ? "" : `${p}%`}
                    </td>
                  );
                })}
                <td className="text-center rounded-md px-1.5 py-1.5 font-bold text-emerald-200" style={c.open ? {} : { background: `rgba(52,211,153,${0.1 + (pct(c.everBack, c.size) / 100) * 0.6})` }}>
                  {c.open ? "" : `${pct(c.everBack, c.size)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
