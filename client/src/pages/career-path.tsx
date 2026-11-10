import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import careerData from "@/data/career-path.json";
import plPlayers from "@/data/pl-players.json";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Home, Trophy, ChevronRight, Info, Lock, Lightbulb, Share2, Check, X, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { playNeutral, playHighScore, playGameEnd, playTick, playBoostHit } from "@/lib/sounds";
import { normalizeName } from "@/lib/normalize";
import type { PLPlayer } from "@/data/pl-player-types";
import { ScreenFlash } from "@/components/screen-flash";
import { useUser } from "@/lib/user-context";
import { submitDailyScore, hasDailySubmission } from "@/lib/daily-score";
import { useDailyLeaderboard, type DailyPeriod } from "@/lib/use-daily-leaderboard";
import { LeaderboardTable } from "@/components/leaderboard-table";

// --- Data ---
// `players` maps a PL playerId to its season rows: [startYear, clubIndex, apps, goals, assists].
// `tiers` are the answer pools, each entry [playerId, first season of the five shown].
interface CareerData {
  clubs: string[];
  players: Record<string, [number, number, number, number, number][]>;
  tiers: { easy: [number, number][]; medium: [number, number][]; hard: [number, number][] };
}
const DATA = careerData as unknown as CareerData;
const PLAYERS = new Map((plPlayers as (PLPlayer & { playerId: number })[]).map(p => [Math.round(p.playerId), p]));

const TIERS = [
  { key: "easy", label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard", label: "Hard" },
] as const;
const WINDOW = 5;
const MAX_STAGE = 5; // 0 = numbers only … 5 = initials; a miss at 5 ends the round
const MAX_POINTS = MAX_STAGE + 1;
const MAX_SCORE = TIERS.length * MAX_POINTS;
const ROUND_VERSION = 1;
const CP_EPOCH = "2026-11-10";

const CLUE_LABELS = ["Just the numbers", "First club", "Last club", "All clubs", "Position & nation", "Initials"];

const seasonLabel = (y: number) => `${y}/${String(y + 1).slice(2)}`;

// Main colour of each club, for the club pills
const CLUB_COLOURS: Record<string, string> = {
  Arsenal: "#EF0107", "Aston Villa": "#670E36", Barnsley: "#D71920", Birmingham: "#0033A0", Blackburn: "#009EE0",
  Blackpool: "#F68712", Bolton: "#263C7E", Bournemouth: "#DA291C", Bradford: "#7A1E3A", Brentford: "#E30613",
  Brighton: "#0057B8", Burnley: "#6C1D45", Cardiff: "#0070B5", Charlton: "#D4021D", Chelsea: "#034694",
  Coventry: "#59CBE8", "Crystal Palace": "#1B458F", Derby: "#333333", Everton: "#003399", Fulham: "#3a3a3a",
  Huddersfield: "#0E63AD", Hull: "#F5A12D", Ipswich: "#3A64A3", Leeds: "#1D428A", Leicester: "#003090",
  Liverpool: "#C8102E", Luton: "#F78F1E", "Man City": "#6CABDD", "Man Utd": "#DA291C", Middlesbrough: "#E11B22",
  Newcastle: "#3a3a3a", Norwich: "#00A650", "Nottingham Forest": "#DD0000", Oldham: "#004A9C", Portsmouth: "#001489",
  QPR: "#1D5BA4", Reading: "#004494", "Sheffield Utd": "#EE2737", "Sheffield Wed": "#0E4C92", Southampton: "#D71920",
  Stoke: "#E03A3E", Sunderland: "#EB172B", Swansea: "#555555", Swindon: "#DC161D", Tottenham: "#132257",
  Watford: "#FBEE23", "West Brom": "#122F67", "West Ham": "#7A263A", Wigan: "#1D59AF", Wimbledon: "#233D7B",
  Wolves: "#FDB913",
};
const LIGHT_CLUBS = new Set(["Watford", "Wolves", "Man City", "Coventry", "Hull", "Luton"]);

// --- Seeded RNG ---
function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rng: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// --- Players ---
interface SeasonRow { year: number; club: string; apps: number; goals: number; assists: number }

function careerOf(id: number): SeasonRow[] {
  return (DATA.players[String(id)] || []).map(([year, c, apps, goals, assists]) => ({ year, club: DATA.clubs[c], apps, goals, assists }));
}

const broadPosition = (p?: PLPlayer) => {
  const pos = p?.position || "";
  return /Goalkeeper/i.test(pos) ? "Goalkeeper" : /Back|Defender/i.test(pos) ? "Defender" : /Midfielder|Winger/i.test(pos) ? "Midfielder" : /Forward|Striker/i.test(pos) ? "Forward" : pos || "Unknown";
};

const initialsOf = (name: string) => name.split(/\s+/).map(w => w[0]).join(".") + ".";

// --- Daily answers ---
// Each tier deals its pool in a seeded shuffle, one a day; a used-up pool reshuffles.
const dealCache = new Map<string, [number, number][]>();
function dealFrom(tier: keyof CareerData["tiers"], n: number): [number, number] {
  const pool = DATA.tiers[tier];
  const cycle = Math.floor(n / pool.length);
  const key = `${tier}:${cycle}`;
  if (!dealCache.has(key)) {
    const deal = [...pool];
    shuffleInPlace(deal, mulberry32(hashString(`careerpath-v${ROUND_VERSION}-${tier}-${cycle}`)));
    dealCache.set(key, deal);
  }
  return dealCache.get(key)![n - cycle * pool.length];
}

function daysSinceEpoch(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [ey, em, ed] = CP_EPOCH.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ey, em - 1, ed)) / 86400000);
}

interface Puzzle { id: number; start: number; rows: SeasonRow[] }

function puzzlesFor(dateKey: string): Puzzle[] {
  const n = daysSinceEpoch(dateKey);
  return TIERS.map(t => {
    const [id, start] = dealFrom(t.key, n);
    return { id, start, rows: careerOf(id).filter(r => r.year >= start && r.year < start + WINDOW) };
  });
}

// A copy served from localhost is a test build: ?day=YYYY-MM-DD plays any day and
// scores never reach the leaderboard.
const IS_LOCAL = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);

function shiftDay(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function getTodayStr(): string {
  if (IS_LOCAL) {
    const day = new URLSearchParams(window.location.search).get("day");
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// --- Daily state persistence ---
interface RoundState { guesses: number[]; stage: number; solved: boolean; failed: boolean }
interface CPState { dateKey: string; puzzleHash: string; rounds: RoundState[]; submitted: boolean }

const emptyRound = (): RoundState => ({ guesses: [], stage: 0, solved: false, failed: false });
const makeHash = (ps: Puzzle[]) => ps.map(p => `${p.id}@${p.start}`).join(",");
const roundDone = (r: RoundState) => r.solved || r.failed;
const roundPoints = (r: RoundState) => (r.solved ? MAX_POINTS - r.stage : 0);

function storageKey(dateKey: string, username?: string): string {
  return username ? `careerpath-${username.toLowerCase()}-${dateKey}` : `careerpath-${dateKey}`;
}

function loadState(dateKey: string, puzzles: Puzzle[], username?: string): CPState {
  const hash = makeHash(puzzles);
  try {
    const raw = localStorage.getItem(storageKey(dateKey, username));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.dateKey === dateKey && parsed.puzzleHash === hash) return parsed;
    }
  } catch { /* ignore */ }
  return { dateKey, puzzleHash: hash, rounds: puzzles.map(emptyRound), submitted: false };
}

function saveState(state: CPState, username?: string) {
  try {
    localStorage.setItem(storageKey(state.dateKey, username), JSON.stringify(state));
  } catch { /* ignore */ }
}

// --- Guess search ---
interface Candidate { id: number; name: string; key: string; surnameKey: string; apps: number; clubs: string }
let candidatesCache: Candidate[] | null = null;
function candidates(): Candidate[] {
  if (candidatesCache) return candidatesCache;
  candidatesCache = [...PLAYERS.entries()].map(([id, p]) => {
    const parts = p.displayName.trim().split(/\s+/);
    return {
      id, name: p.displayName, key: normalizeName(p.displayName), surnameKey: normalizeName(parts[parts.length - 1]),
      apps: p.totalAppearances, clubs: Object.keys(p.clubs).slice(0, 3).join(", "),
    };
  }).sort((a, b) => b.apps - a.apps);
  return candidatesCache;
}

function search(query: string, exclude: Set<number>): Candidate[] {
  const q = normalizeName(query);
  if (q.length < 2) return [];
  const starts: Candidate[] = [];
  const contains: Candidate[] = [];
  for (const c of candidates()) {
    if (exclude.has(c.id)) continue;
    if (c.surnameKey.startsWith(q) || c.key.startsWith(q)) starts.push(c);
    else if (c.key.includes(q)) contains.push(c);
    if (starts.length >= 6) break;
  }
  return [...starts, ...contains].slice(0, 6);
}

// --- Wrong-guess feedback (what the guess shares with the answer) ---
interface Feedback {
  shared: string[];
  era: "overlap" | "earlier" | "later";
  overlap: number;
  samePosition: boolean;
  sameNation: boolean;
  goals: "more" | "fewer" | "same"; // the answer scored more / fewer than the guess
}

function compare(guessId: number, answerId: number): Feedback {
  const g = careerOf(guessId);
  const a = careerOf(answerId);
  const gClubs = new Set(g.map(r => r.club));
  const shared = [...new Set(a.map(r => r.club))].filter(c => gClubs.has(c));
  const gYears = new Set(g.map(r => r.year));
  const aYears = [...new Set(a.map(r => r.year))];
  const overlap = aYears.filter(y => gYears.has(y)).length;
  const gMid = g.reduce((s, r) => s + r.year, 0) / Math.max(1, g.length);
  const aMid = a.reduce((s, r) => s + r.year, 0) / Math.max(1, a.length);
  const gp = PLAYERS.get(guessId);
  const ap = PLAYERS.get(answerId);
  const goalsDiff = (ap?.totalGoals ?? 0) - (gp?.totalGoals ?? 0);
  return {
    shared,
    era: overlap > 0 ? "overlap" : aMid < gMid ? "earlier" : "later",
    overlap,
    samePosition: broadPosition(gp) === broadPosition(ap),
    sameNation: !!gp?.nationality && gp?.nationality === ap?.nationality,
    goals: goalsDiff > 0 ? "more" : goalsDiff < 0 ? "fewer" : "same",
  };
}

function buzz(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}

const formatDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
};

const resultEmoji = (r: RoundState) => (r.solved ? ["🟩", "🟩", "🟨", "🟨", "🟧", "🟧"][r.stage] : roundDone(r) ? "🟥" : "⬜");

export default function CareerPath() {
  const [, navigate] = useLocation();
  const { user } = useUser();
  const dateKey = useMemo(() => getTodayStr(), []);
  const puzzles = useMemo(() => puzzlesFor(dateKey), [dateKey]);

  const [state, setState] = useState<CPState>(() => loadState(dateKey, puzzles, user?.username));
  const [current, setCurrent] = useState(() => {
    const s = loadState(dateKey, puzzles, user?.username);
    const i = s.rounds.findIndex(r => !roundDone(r));
    return i === -1 ? TIERS.length - 1 : i;
  });
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [shake, setShake] = useState(0);
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showRules, setShowRules] = useState(() => {
    const s = loadState(dateKey, puzzles, user?.username);
    return s.rounds.every(r => r.guesses.length === 0 && r.stage === 0) && !s.submitted;
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const checkedRemote = useRef(false);

  const puzzle = puzzles[current];
  const round = state.rounds[current];
  const answer = PLAYERS.get(puzzle.id);
  const done = roundDone(round);
  const allDone = state.rounds.every(roundDone);
  const score = state.rounds.reduce((s, r) => s + roundPoints(r), 0);
  const suggestions = useMemo(() => search(query, new Set(round.guesses)), [query, round.guesses]);

  useEffect(() => {
    if (checkedRemote.current || !user?.username || IS_LOCAL) return;
    checkedRemote.current = true;
    hasDailySubmission(user.username, "careerpath", dateKey).then(result => {
      if (result.submitted && !state.submitted) setState(prev => ({ ...prev, submitted: true }));
    });
  }, [user?.username, dateKey, state.submitted]);

  useEffect(() => { saveState(state, user?.username); }, [state]);
  useEffect(() => { setHighlight(0); }, [query]);

  const updateRound = useCallback((fn: (r: RoundState) => RoundState) => {
    setState(prev => ({ ...prev, rounds: prev.rounds.map((r, i) => (i === current ? fn(r) : r)) }));
  }, [current]);

  const finish = useCallback(async () => {
    setSubmitting(true);
    const total = state.rounds.reduce((s, r) => s + roundPoints(r), 0);
    const solved = state.rounds.filter(r => r.solved).length;
    if (user?.username && !IS_LOCAL && !state.submitted) await submitDailyScore(user.username, "careerpath", dateKey, total, solved, TIERS.length);
    setState(prev => ({ ...prev, submitted: true }));
    setSubmitting(false);
    if (total >= 14) playHighScore(); else playGameEnd();
    setShowEndScreen(true);
  }, [state.rounds, state.submitted, user?.username, dateKey]);

  const guess = useCallback((c: Candidate) => {
    if (done) return;
    setQuery("");
    if (c.id === puzzle.id) {
      updateRound(r => ({ ...r, guesses: [...r.guesses, c.id], solved: true }));
      playHighScore();
      buzz([30, 40, 60]);
      setFlashColor("bg-violet-400");
      setTimeout(() => setFlashColor(null), 300);
    } else {
      const lastChance = round.stage >= MAX_STAGE;
      updateRound(r => ({ ...r, guesses: [...r.guesses, c.id], stage: Math.min(MAX_STAGE, r.stage + 1), failed: lastChance }));
      setShake(s => s + 1);
      buzz([20, 30, 20]);
      if (lastChance) playGameEnd(); else { playNeutral(); setTimeout(playTick, 250); }
    }
  }, [done, puzzle.id, round.stage, updateRound]);

  const revealClue = useCallback(() => {
    if (done) return;
    if (round.stage >= MAX_STAGE) {
      updateRound(r => ({ ...r, failed: true }));
      playGameEnd();
      return;
    }
    updateRound(r => ({ ...r, stage: r.stage + 1 }));
    playBoostHit();
    buzz(10);
  }, [done, round.stage, updateRound]);

  const nextRound = useCallback(() => {
    if (current < TIERS.length - 1) {
      setCurrent(c => c + 1);
      setQuery("");
      window.scrollTo({ top: 0 });
    } else {
      finish();
    }
  }, [current, finish]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => Math.min(h + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const pick = suggestions[highlight];
      if (pick) guess(pick);
    }
  };

  const header = (
    <div className="w-full flex items-center justify-between mb-4">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
          <Home className="w-4 h-4 mr-1" /> Home
        </Button>
        {!showRules && (
          <button onClick={() => setShowRules(true)} title="How to play"
            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors">
            <Info className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 text-xs font-semibold">
          <Calendar className="w-3 h-3" />DAILY
        </span>
        <span className="text-sm text-muted-foreground">{formatDate(dateKey)}</span>
      </div>
      {IS_LOCAL && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 whitespace-nowrap rounded-full border border-violet-500/40 bg-background/90 px-3 py-1.5 text-xs shadow-lg">
          <span className="font-semibold text-violet-300">Test build</span>
          <span className="text-muted-foreground">no leaderboard</span>
          <a href={`/careerpath?day=${shiftDay(dateKey, -1)}`} className="px-2 py-0.5 rounded-full bg-muted/50 hover:bg-muted">← day</a>
          <a href={`/careerpath?day=${shiftDay(dateKey, 1)}`} className="px-2 py-0.5 rounded-full bg-muted/50 hover:bg-muted">day →</a>
        </div>
      )}
    </div>
  );

  const glow = (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full blur-3xl bg-violet-500/5" />
      <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full blur-3xl bg-fuchsia-500/5" />
    </div>
  );

  if (showEndScreen || (state.submitted && !showRules)) {
    return <EndScreen puzzles={puzzles} rounds={state.rounds} dateKey={dateKey} navigate={navigate} username={user?.username} />;
  }

  // --- Rules Screen ---
  if (showRules) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {glow}
        <div className="relative z-10 flex flex-col items-center w-full max-w-lg mx-auto px-4 pt-4 pb-8 flex-1">
          {header}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full text-center">
            <h1 className="text-3xl font-black tracking-tight mb-1">
              <span className="bg-gradient-to-r from-violet-300 to-fuchsia-400 bg-clip-text text-transparent">Career Path</span>
            </h1>
            <p className="text-sm text-muted-foreground mb-6">Name the player from five seasons of their PL career</p>
            <div className="text-left space-y-3 mb-8">
              <RuleItem icon="📊" text="Three players a day: easy, medium, hard. You see five seasons of each one's Premier League numbers, with the clubs hidden" />
              <RuleItem icon="🔓" text={`Every wrong guess unlocks a clue: first club, last club, all clubs, position & nation, initials`} />
              <RuleItem icon="🧭" text="Wrong guesses also tell you what they share with the answer: clubs, era, position, nation, more or fewer goals" />
              <RuleItem icon="🏆" text={`Solve with no clues for ${MAX_POINTS} points, one fewer per clue. ${MAX_SCORE} is a perfect day`} />
            </div>
            <Button className="w-full text-lg py-6 shadow-xl shadow-violet-500/20 bg-gradient-to-r from-violet-400 to-fuchsia-500 hover:from-violet-500 hover:to-fuchsia-600 text-white font-bold border-violet-300/60"
              onClick={() => setShowRules(false)}>
              {state.rounds.some(r => r.guesses.length || r.stage) ? "Back to today's players" : "Play today's players"}
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  const years = Array.from({ length: WINDOW }, (_, i) => puzzle.start + i);
  // Rows within a season are sorted by apps, so these are the season's main club
  const firstClub = puzzle.rows.find(r => r.year === puzzle.start)?.club;
  const lastClub = puzzle.rows.find(r => r.year === puzzle.start + WINDOW - 1)?.club;
  const clubShown = (row: SeasonRow) =>
    done || round.stage >= 3 || (round.stage >= 1 && row.year === puzzle.start && row.club === firstClub)
    || (round.stage >= 2 && row.year === puzzle.start + WINDOW - 1 && row.club === lastClub);
  const totals = puzzle.rows.reduce((t, r) => ({ apps: t.apps + r.apps, goals: t.goals + r.goals, assists: t.assists + r.assists }), { apps: 0, goals: 0, assists: 0 });

  // --- Playing Screen ---
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {glow}
      <ScreenFlash show={flashColor !== null} color={flashColor || "bg-violet-400"} />
      <div className="relative z-10 flex flex-col items-center w-full max-w-lg mx-auto px-4 pt-4 pb-20 flex-1">
        {header}

        {/* Round tabs */}
        <div className="w-full grid grid-cols-3 gap-2 mb-3">
          {TIERS.map((t, i) => {
            const r = state.rounds[i];
            const reachable = i <= current || roundDone(state.rounds[i - 1] ?? r);
            return (
              <button key={t.key} type="button" disabled={!reachable} onClick={() => { setCurrent(i); setQuery(""); }}
                className={`rounded-xl border px-2 py-1.5 text-left transition-colors ${i === current
                  ? "border-violet-400/60 bg-violet-500/10" : "border-border bg-card/40"} ${reachable ? "" : "opacity-40"}`}>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{i + 1} · {t.label}</div>
                <div className="text-sm font-bold tabular-nums">
                  {r.solved ? <span className="text-violet-300">+{roundPoints(r)}</span> : r.failed ? <span className="text-red-400">✗</span> : <span className="text-muted-foreground/60">{MAX_POINTS - r.stage} pts</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Clue ladder */}
        <div className="w-full flex gap-1 mb-3">
          {CLUE_LABELS.map((label, i) => (
            <div key={label} title={label}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= round.stage ? (i === 0 ? "bg-violet-400" : "bg-fuchsia-400") : "bg-muted"}`} />
          ))}
        </div>

        {/* Career table */}
        <motion.div key={`table-${current}-${shake}`} animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : {}} transition={{ duration: 0.3 }}
          className="w-full rounded-2xl border border-border bg-card/60 overflow-hidden">
          <div className="grid grid-cols-[64px_1fr_40px_32px_32px] gap-x-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
            <span>Season</span><span>Club</span><span className="text-right">Apps</span><span className="text-right">G</span><span className="text-right">A</span>
          </div>
          {years.map(y => {
            const rows = puzzle.rows.filter(r => r.year === y);
            return rows.map((row, k) => (
              <div key={`${y}-${k}`} className={`grid grid-cols-[64px_1fr_40px_32px_32px] gap-x-2 items-center px-3 py-2 ${k === 0 ? "border-t border-border/40 first:border-t-0" : ""}`}>
                <span className="text-xs text-muted-foreground tabular-nums">{k === 0 ? seasonLabel(y) : "↳"}</span>
                <ClubPill club={row.club} shown={clubShown(row)} />
                <span className="text-right text-sm tabular-nums text-muted-foreground">{row.apps}</span>
                <span className="text-right text-sm font-bold tabular-nums">{row.goals}</span>
                <span className="text-right text-sm font-bold tabular-nums">{row.assists}</span>
              </div>
            ));
          })}
          <div className="grid grid-cols-[64px_1fr_40px_32px_32px] gap-x-2 px-3 py-2 border-t border-border/60 bg-background/30 text-xs">
            <span className="text-muted-foreground">Total</span><span />
            <span className="text-right tabular-nums text-muted-foreground">{totals.apps}</span>
            <span className="text-right font-bold tabular-nums">{totals.goals}</span>
            <span className="text-right font-bold tabular-nums">{totals.assists}</span>
          </div>
        </motion.div>

        {/* Extra clues */}
        <AnimatePresence>
          {(round.stage >= 4 || done) && answer && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="w-full flex flex-wrap gap-2 mt-2.5">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-200 border border-violet-500/30">{broadPosition(answer)}</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-200 border border-violet-500/30">{answer.nationality}</span>
              {(round.stage >= 5 || done) && (
                <span className="px-2.5 py-1 rounded-full text-xs font-black tracking-widest bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/40">{initialsOf(answer.displayName)}</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Guess box or result */}
        {!done ? (
          <div className="w-full mt-4">
            <div className="relative">
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
                placeholder="Who is it?" aria-label="Guess a player" autoComplete="off" autoCorrect="off" spellCheck={false}
                className="w-full h-12 rounded-xl border border-border bg-card/80 px-4 text-base outline-none focus:border-violet-400/70 transition-colors" />
              <AnimatePresence>
                {suggestions.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
                    {suggestions.map((c, i) => (
                      <button key={c.id} type="button" onMouseDown={e => { e.preventDefault(); guess(c); }} onMouseEnter={() => setHighlight(i)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-left ${i === highlight ? "bg-violet-500/15" : ""}`}>
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground truncate ml-3">{c.clubs}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">
                {round.stage < MAX_STAGE ? <>Next clue: <span className="text-foreground/80">{CLUE_LABELS[round.stage + 1]}</span></> : "Last chance"}
              </span>
              <button type="button" onClick={revealClue}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-border bg-card/60 hover:border-fuchsia-400/50 transition-colors">
                <Lightbulb className="w-3.5 h-3.5" />{round.stage < MAX_STAGE ? "Reveal clue (−1)" : "Give up"}
              </button>
            </div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={`w-full mt-4 rounded-2xl border p-4 ${round.solved ? "border-violet-400/50 bg-violet-500/10" : "border-red-500/40 bg-red-500/10"}`}>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{round.solved ? "Got him" : "It was"}</div>
            <div className="flex items-baseline justify-between mt-0.5">
              <div className="text-2xl font-black">{answer?.displayName}</div>
              {round.solved && <div className="text-2xl font-black text-violet-300 tabular-nums">+{roundPoints(round)}</div>}
            </div>
            <CareerSummary id={puzzle.id} />
            <Button className="w-full mt-4 py-5 bg-gradient-to-r from-violet-400 to-fuchsia-500 hover:from-violet-500 hover:to-fuchsia-600 text-white font-bold border-violet-300/60"
              onClick={allDone || current < TIERS.length - 1 ? nextRound : () => setCurrent(state.rounds.findIndex(r => !roundDone(r)))} disabled={submitting}>
              {current < TIERS.length - 1 ? `Next: ${TIERS[current + 1].label}` : allDone ? (submitting ? "Submitting..." : "See your score") : "Back to unfinished player"}
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </motion.div>
        )}

        {/* Wrong guesses */}
        <div className="w-full mt-4 space-y-2">
          <AnimatePresence initial={false}>
            {[...round.guesses].reverse().filter(id => id !== puzzle.id).map(id => (
              <GuessRow key={id} guessId={id} answerId={puzzle.id} />
            ))}
          </AnimatePresence>
        </div>

        <div className="w-full mt-4 text-center text-xs text-muted-foreground tabular-nums">Today: {score} / {MAX_SCORE}</div>
      </div>
    </div>
  );
}

function ClubPill({ club, shown }: { club: string; shown: boolean }) {
  const colour = CLUB_COLOURS[club] || "#555";
  return (
    <div className="relative h-7 [perspective:400px]">
      <AnimatePresence mode="wait" initial={false}>
        {shown ? (
          <motion.span key="club" initial={{ rotateX: -90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ duration: 0.35 }}
            className="absolute inset-0 inline-flex items-center px-2.5 rounded-lg text-sm font-bold truncate"
            style={{ background: colour, color: LIGHT_CLUBS.has(club) ? "#111" : "#fff" }}>
            {club}
          </motion.span>
        ) : (
          <motion.span key="hidden" exit={{ rotateX: 90, opacity: 0 }} transition={{ duration: 0.2 }}
            className="absolute inset-0 inline-flex items-center gap-1.5 px-2.5 rounded-lg bg-muted/60 text-muted-foreground/60 text-xs">
            <Lock className="w-3 h-3" /> hidden
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function GuessRow({ guessId, answerId }: { guessId: number; answerId: number }) {
  const g = PLAYERS.get(guessId);
  const f = useMemo(() => compare(guessId, answerId), [guessId, answerId]);
  const chip = (ok: boolean, text: string) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${ok
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-muted/40 text-muted-foreground border-border"}`}>
      {ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}{text}
    </span>
  );
  return (
    <motion.div layout initial={{ opacity: 0, y: -10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 26 }}
      className="rounded-xl border border-border bg-card/50 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{g?.displayName}</span>
        <span className="text-[11px] text-red-400/80 font-semibold">not him</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {f.shared.length ? f.shared.map(c => (
          <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border border-white/10"
            style={{ background: CLUB_COLOURS[c] || "#555", color: LIGHT_CLUBS.has(c) ? "#111" : "#fff" }}>
            <Check className="w-3 h-3" />{c}
          </span>
        )) : chip(false, "No clubs in common")}
        {f.era === "overlap" ? chip(true, `Same era · ${f.overlap} season${f.overlap === 1 ? "" : "s"}`)
          : chip(false, f.era === "earlier" ? "Answer's earlier" : "Answer's later")}
        {chip(f.samePosition, broadPosition(g))}
        {chip(f.sameNation, g?.nationality || "?")}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-muted/40 text-muted-foreground border-border">
          {f.goals === "more" ? <ArrowUp className="w-3 h-3" /> : f.goals === "fewer" ? <ArrowDown className="w-3 h-3" /> : <Check className="w-3 h-3" />}
          {f.goals === "same" ? "Same PL goals" : f.goals === "more" ? "More PL goals" : "Fewer PL goals"}
        </span>
      </div>
    </motion.div>
  );
}

// The whole PL career as club spans, e.g. "Leeds 02–04 · Newcastle 04–08"
function CareerSummary({ id }: { id: number }) {
  const p = PLAYERS.get(id);
  const spans: { club: string; from: number; to: number }[] = [];
  for (const r of careerOf(id)) {
    const last = spans.find(s => s.club === r.club && r.year - s.to <= 1);
    if (last) last.to = r.year; else spans.push({ club: r.club, from: r.year, to: r.year });
  }
  spans.sort((a, b) => a.from - b.from || a.to - b.to);
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1.5">
        {spans.map((s, i) => (
          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold"
            style={{ background: CLUB_COLOURS[s.club] || "#555", color: LIGHT_CLUBS.has(s.club) ? "#111" : "#fff" }}>
            {s.club} {String(s.from).slice(2)}–{String(s.to + 1).slice(2)}
          </span>
        ))}
      </div>
      {p && <div className="text-xs text-muted-foreground mt-2">{p.totalAppearances} PL apps · {p.totalGoals} goals · {p.totalAssists} assists</div>}
    </div>
  );
}

function RuleItem({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-lg shrink-0 mt-0.5">{icon}</span>
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  );
}

function EndScreen({ puzzles, rounds, dateKey, navigate, username }: {
  puzzles: Puzzle[];
  rounds: RoundState[];
  dateKey: string;
  navigate: (to: string) => void;
  username?: string;
}) {
  const total = rounds.reduce((s, r) => s + roundPoints(r), 0);
  const [lbPeriod, setLbPeriod] = useState<DailyPeriod>("today");
  const { entries, loading } = useDailyLeaderboard("careerpath", lbPeriod, 10, 1000);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const text = `Career Path ${formatDate(dateKey)}\n${rounds.map(resultEmoji).join(" ")} ${total}/${MAX_SCORE}\ndrapk.in/careerpath`;
    try {
      if (navigator.share && !window.matchMedia?.("(pointer: fine)").matches) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch { /* dismissed */ }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full blur-3xl bg-violet-500/5" />
        <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full blur-3xl bg-fuchsia-500/5" />
      </div>
      <div className="relative z-10 flex flex-col items-center w-full max-w-lg mx-auto px-4 pt-4 pb-8 flex-1">
        <div className="w-full flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            <Home className="w-4 h-4 mr-1" /> Home
          </Button>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 text-xs font-semibold">
              <Calendar className="w-3 h-3" />DAILY
            </span>
            <span className="text-sm text-muted-foreground">{formatDate(dateKey)}</span>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            <span className="bg-gradient-to-r from-violet-300 to-fuchsia-400 bg-clip-text text-transparent">Career Path</span>
            <span className="text-muted-foreground text-lg ml-2">— Complete</span>
          </h1>
          <div className="text-5xl font-black tabular-nums text-violet-300">{total}<span className="text-2xl text-muted-foreground">/{MAX_SCORE}</span></div>
          <div className="flex justify-center gap-2 text-3xl mt-3">
            {rounds.map((r, i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 14, delay: 0.2 + i * 0.12 }}>{resultEmoji(r)}</motion.span>
            ))}
          </div>
          <button onClick={share}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full border border-border bg-card/60 hover:border-violet-400/50 transition-colors">
            {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</> : <><Share2 className="w-3.5 h-3.5" /> Share</>}
          </button>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="w-full mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Trophy className="w-3 h-3" />Leaderboard
            </div>
            <div className="flex gap-1">
              {(["today", "yesterday"] as const).map(p => (
                <button key={p} onClick={() => setLbPeriod(p)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                    lbPeriod === p ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {p === "today" ? "Today" : "Yesterday"}
                </button>
              ))}
            </div>
          </div>
          <LeaderboardTable entries={entries} loading={loading} period="today" onPeriodChange={() => {}}
            currentUser={username} accentBg="bg-violet-500/10 border-violet-500/30" scoreLabel="Score" mini max={10} />
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="w-full mb-6 space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Today's players</h3>
          {puzzles.map((pz, i) => (
            <div key={pz.id} className="rounded-xl border border-border bg-card/50 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold"><span className="text-xs text-muted-foreground mr-2">{TIERS[i].label}</span>{PLAYERS.get(pz.id)?.displayName}</span>
                <span className="font-bold tabular-nums">{resultEmoji(rounds[i])} +{roundPoints(rounds[i])}</span>
              </div>
              <CareerSummary id={pz.id} />
            </div>
          ))}
        </motion.div>

        <div className="w-full text-center py-4 text-muted-foreground">
          <p className="text-sm">Three new players tomorrow!</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/")}>
            <Home className="w-4 h-4 mr-1.5" /> Back to games
          </Button>
        </div>
      </div>
    </div>
  );
}
