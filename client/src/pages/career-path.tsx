import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import careerData from "@/data/career-path.json";
import plPlayers from "@/data/pl-players.json";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Home, Trophy, ChevronRight, Info, Lock, Lightbulb, Share2, Check, X, ArrowUp, ArrowDown, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { playNeutral, playHighScore, playGameEnd, playTick, playBoostHit, playExactMatch, playCrowdRoar } from "@/lib/sounds";
import { normalizeName, PL_ALTERNATES, PL_MONONYMS } from "@/lib/normalize";
import type { PLPlayer } from "@/data/pl-player-types";
import { ScreenFlash } from "@/components/screen-flash";
import { useUser, shareLink } from "@/lib/user-context";
import { submitDailyScore, hasDailySubmission } from "@/lib/daily-score";
import { recordDaily, hasPlayedBefore } from "@/lib/daily";
import { trackEvent } from "@/lib/firebase";
import { DailyNext } from "@/components/daily-next";
import { useDailyLeaderboard, type DailyPeriod } from "@/lib/use-daily-leaderboard";
import { LeaderboardTable } from "@/components/leaderboard-table";

// --- Data ---
// `players` maps a PL playerId to its season rows: [startYear, clubIndex, apps, goals, assists],
// sorted by apps within a season. `tiers` are the five answer pools, easiest first: players with
// 4k+ monthly Wikipedia views (seasons ending before 2008 only for the most viewed fifth), scored
// 1-5 on how recent the five seasons are plus 1-5 on views, sorted by the total and cut into fifths. Each entry is [playerId, first of the five seasons
// shown], a stretch that includes a move where the player had one.
interface CareerData {
  clubs: string[];
  players: Record<string, [number, number, number, number, number][]>;
  tiers: [number, number][][];
}
const DATA = careerData as unknown as CareerData;
const PLAYERS = new Map((plPlayers as (PLPlayer & { playerId: number })[]).map(p => [Math.round(p.playerId), p]));

const ROUNDS = 5;
const MULTIPLIERS = [1, 1.5, 2, 2.5, 3];
const WINDOW = 5;
const MAX_STAGE = 4; // 0 = numbers only … 4 = whole career; a miss at 4 ends the round (5 guesses)
// Points by guess (first guess 10 … fifth 2), even so every multiplier gives a whole number
const STAGE_POINTS = [10, 8, 6, 4, 2];
const MAX_SCORE = MULTIPLIERS.reduce((s, m) => s + m * STAGE_POINTS[0], 0);
// Each round's colour, warming up as the multiplier grows
const ROUND_THEMES = [
  { from: "#8b5cf6", to: "#a855f7" },
  { from: "#a855f7", to: "#d946ef" },
  { from: "#d946ef", to: "#ec4899" },
  { from: "#ec4899", to: "#f97316" },
  { from: "#f97316", to: "#f59e0b" },
];
const roundGradient = (k: number) => `linear-gradient(135deg, ${ROUND_THEMES[k].from}, ${ROUND_THEMES[k].to})`;
const ROUND_VERSION = 4;
const CP_EPOCH = "2026-11-10";

const CLUES = [
  { label: "Numbers", full: "Just the numbers" },
  { label: "Yrs 1–2", full: "Clubs for seasons 1–2" },
  { label: "Yrs 3–5", full: "Clubs for seasons 3–5" },
  { label: "Profile", full: "Position & nation" },
  { label: "Career", full: "Whole PL career" },
];

const shortSeason = (y: number) => `${String(y).slice(2)}/${String(y + 1).slice(2)}`;
const fmtPts = (n: number) => String(Math.round(n));

// Main colour of each club, for badges, flips and confetti
const CLUB_COLOURS: Record<string, string> = {
  Arsenal: "#EF0107", "Aston Villa": "#7B1C46", Barnsley: "#D71920", Birmingham: "#1B3F95", Blackburn: "#009EE0",
  Blackpool: "#F68712", Bolton: "#2B4A9B", Bournemouth: "#DA291C", Bradford: "#8A2440", Brentford: "#E30613",
  Brighton: "#0057B8", Burnley: "#7A2050", Cardiff: "#0070B5", Charlton: "#D4021D", Chelsea: "#034694",
  Coventry: "#59CBE8", "Crystal Palace": "#1B458F", Derby: "#e8e8e8", Everton: "#1240A8", Fulham: "#e8e8e8",
  Huddersfield: "#0E63AD", Hull: "#F5A12D", Ipswich: "#3A64A3", Leeds: "#1D428A", Leicester: "#003090",
  Liverpool: "#C8102E", Luton: "#F78F1E", "Man City": "#6CABDD", "Man Utd": "#DA291C", Middlesbrough: "#E11B22",
  Newcastle: "#e8e8e8", Norwich: "#00A650", "Nottingham Forest": "#DD0000", Oldham: "#004A9C", Portsmouth: "#1a3fa0",
  QPR: "#1D5BA4", Reading: "#004494", "Sheffield Utd": "#EE2737", "Sheffield Wed": "#1E5BA8", Southampton: "#D71920",
  Stoke: "#E03A3E", Sunderland: "#EB172B", Swansea: "#e8e8e8", Swindon: "#DC161D", Tottenham: "#1d2f6b",
  Watford: "#FBEE23", "West Brom": "#1F3F7A", "West Ham": "#7A263A", Wigan: "#1D59AF", Wimbledon: "#2b4a8b",
  Wolves: "#FDB913",
};
const LIGHT_CLUBS = new Set(["Watford", "Wolves", "Man City", "Coventry", "Hull", "Luton", "Swansea", "Fulham", "Newcastle", "Derby"]);
const clubColour = (c: string) => CLUB_COLOURS[c] || "#666";
const clubText = (c: string) => (LIGHT_CLUBS.has(c) ? "#111" : "#fff");

// Nationality -> ISO code (from the PL stats API), for flags
const NATION_ISO: Record<string, string> = {"Albania": "AL", "Algeria": "DZ", "Angola": "AO", "Antigua & Barbuda": "AG", "Argentina": "AR", "Armenia": "AM", "Australia": "AU", "Austria": "AT", "Bangladesh": "BD", "Barbados": "BB", "Belarus": "BY", "Belgium": "BE", "Benin": "BJ", "Bermuda": "BM", "Bolivia": "BO", "Bosnia & Herzegovina": "BA", "Brazil": "BR", "Bulgaria": "BG", "Burkina Faso": "BF", "Burundi": "BI", "Cameroon": "CM", "Canada": "CA", "Cape Verde": "CV", "Central African Republic": "CF", "Chile": "CL", "China": "CN", "Colombia": "CO", "Congo": "CG", "Costa Rica": "CR", "Cote D\u2019Ivoire": "CI", "Croatia": "HR", "Cuba": "CU", "Curacao": "CW", "Cyprus": "CY", "Czech Republic": "CZ", "DR Congo": "CD", "Denmark": "DK", "Dominican Republic": "DO", "Ecuador": "EC", "Egypt": "EG", "England": "GB-ENG", "Equatorial Guinea": "GQ", "Estonia": "EE", "Faroe Islands": "FO", "Finland": "FI", "France": "FR", "Gabon": "GA", "Gambia": "GM", "Georgia": "GE", "Germany": "DE", "Ghana": "GH", "Gibraltar": "GI", "Greece": "GR", "Grenada": "GD", "Guadeloupe": "GP", "Guatemala": "GT", "Guinea": "GN", "Guinea-Bissau": "GW", "Guyana": "GY", "Haiti": "HT", "Honduras": "HN", "Hungary": "HU", "Iceland": "IS", "Indonesia": "ID", "Iran": "IR", "Iraq": "IQ", "Ireland": "IE", "Israel": "IL", "Italy": "IT", "Jamaica": "JM", "Japan": "JP", "Kenya": "KE", "Kosovo": "XK", "Latvia": "LV", "Liberia": "LR", "Lithuania": "LT", "Mali": "ML", "Malta": "MT", "Martinique": "MQ", "Mauritania": "MR", "Mexico": "MX", "Montenegro": "ME", "Montserrat": "MS", "Morocco": "MA", "Mozambique": "MZ", "Netherlands": "NL", "New Zealand": "NZ", "Nigeria": "NG", "North Macedonia": "MK", "Northern Ireland": "GB-NIR", "Norway": "NO", "Oman": "OM", "Pakistan": "PK", "Paraguay": "PY", "Peru": "PE", "Philippines": "PH", "Poland": "PL", "Portugal": "PT", "Romania": "RO", "Russia": "RU", "Scotland": "GB-SCT", "Senegal": "SN", "Serbia": "RS", "Seychelles": "SC", "Sierra Leone": "SL", "Slovakia": "SK", "Slovenia": "SI", "South Africa": "ZA", "South Korea": "KR", "Spain": "ES", "St. Kitts & Nevis": "KN", "Suriname": "SR", "Sweden": "SE", "Switzerland": "CH", "Syria": "SY", "Tanzania": "TZ", "Togo": "TG", "Trinidad & Tobago": "TT", "Tunisia": "TN", "Turkiye": "TR", "Ukraine": "UA", "United States": "US", "Uruguay": "UY", "Uzbekistan": "UZ", "Venezuela": "VE", "Wales": "GB-WLS", "Zambia": "ZM", "Zimbabwe": "ZW"};
const HOME_NATIONS: Record<string, string> = { "GB-ENG": "gbeng", "GB-SCT": "gbsct", "GB-WLS": "gbwls" };
function flagOf(country?: string): string {
  const code = country ? NATION_ISO[country] : undefined;
  if (!code) return "";
  if (HOME_NATIONS[code]) {
    // England, Scotland, Wales: black flag + tag letters
    return "\u{1F3F4}" + [...HOME_NATIONS[code]].map(c => String.fromCodePoint(0xe0000 + c.charCodeAt(0))).join("") + "\u{E007F}";
  }
  if (!/^[A-Z]{2}$/.test(code)) return ""; // e.g. Northern Ireland has no flag emoji
  return [...code].map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
}

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

// Within a season with two clubs the data doesn't say which came first, so read it as one
// continuous story: last season's club first, next season's club last.
function careerOf(id: number): SeasonRow[] {
  const rows = (DATA.players[String(id)] || []).map(([year, c, apps, goals, assists]) => ({ year, club: DATA.clubs[c], apps, goals, assists }));
  const playedFor = (club: string, year: number) => rows.some(r => r.year === year && r.club === club);
  const order = (r: SeasonRow) => (playedFor(r.club, r.year - 1) ? 0 : playedFor(r.club, r.year + 1) ? 2 : 1);
  return rows.sort((a, b) => a.year - b.year || order(a) - order(b) || b.apps - a.apps);
}

const broadPosition = (p?: PLPlayer) => {
  const pos = p?.position || "";
  return /Goalkeeper/i.test(pos) ? "Goalkeeper" : /Back|Defender/i.test(pos) ? "Defender"
    : /Forward|Striker/i.test(pos) ? "Forward" : /Midfielder|Winger/i.test(pos) ? "Midfielder" : pos || "Unknown";
};


// --- Daily answers ---
// Round k comes from tier k. Each tier deals its pool in a seeded shuffle, one a day,
// and reshuffles once it has all been used.
const dealCache = new Map<string, [number, number][]>();
function dealFrom(tier: number, n: number): [number, number] {
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

// Days dealt before the tiers were rebuilt, frozen so nobody's game changes mid-day
const PINNED_DAYS: Record<string, [number, number][]> = {"2026-11-10": [[736198, 2014], [322321, 2015], [152954, 2008], [190129, 2022], [2098, 1993]]};

function puzzlesFor(dateKey: string): Puzzle[] {
  const n = daysSinceEpoch(dateKey);
  return Array.from({ length: ROUNDS }, (_, k) => {
    const [id, start] = PINNED_DAYS[dateKey]?.[k] ?? dealFrom(k, n);
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
// remoteScore: finished on another device before rounds were synced with the score
interface CPState { dateKey: string; puzzleHash: string; rounds: RoundState[]; submitted: boolean; remoteScore?: number }

const emptyRound = (): RoundState => ({ guesses: [], stage: 0, solved: false, failed: false });
const makeHash = (ps: Puzzle[]) => ps.map(p => `${p.id}@${p.start}`).join(",");
const roundDone = (r: RoundState) => r.solved || r.failed;
const roundPoints = (r: RoundState, k: number) => (r.solved ? STAGE_POINTS[r.stage] * MULTIPLIERS[k] : 0);
const totalOf = (rounds: RoundState[]) => rounds.reduce((s, r, k) => s + roundPoints(r, k), 0);

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

// --- Guess search (names only: showing clubs would give the answer away) ---
interface Candidate { id: number; name: string; key: string; surnameKey: string; alts: string[] }
let candidatesCache: Candidate[] | null = null;
function candidates(): Candidate[] {
  if (candidatesCache) return candidatesCache;
  candidatesCache = [...PLAYERS.entries()]
    .sort((a, b) => b[1].totalAppearances - a[1].totalAppearances)
    .map(([id, p]) => {
      const parts = p.displayName.trim().split(/\s+/);
      const key = normalizeName(p.displayName);
      const surnameKey = normalizeName(parts[parts.length - 1]);
      // Other spellings people type ("Kuyt" for Kuijt, "Gilberto" for Gilberto Silva)
      const alts = Object.entries({ ...PL_ALTERNATES, ...PL_MONONYMS })
        .filter(([, target]) => target === key || target === surnameKey).map(([alt]) => alt);
      return { id, name: p.displayName, key, surnameKey, alts };
    });
  return candidatesCache;
}

function search(query: string, exclude: Set<number>): Candidate[] {
  const q = normalizeName(query);
  if (q.length < 2) return [];
  const starts: Candidate[] = [];
  const contains: Candidate[] = [];
  for (const c of candidates()) {
    if (exclude.has(c.id)) continue;
    if (c.surnameKey.startsWith(q) || c.key.startsWith(q) || c.alts.some(a => a.startsWith(q))) starts.push(c);
    else if (contains.length < 6 && c.key.includes(q)) contains.push(c);
    if (starts.length >= 6) break;
  }
  return [...starts, ...contains].slice(0, 6);
}

// --- Wrong-guess feedback: what the guess has in common with the answer ---
interface Feedback {
  shared: string[];
  era: "overlap" | "earlier" | "later";
  overlap: number;
  samePosition: boolean;
  sameNation: boolean;
  goals: "more" | "fewer" | "same"; // the answer scored more / fewer PL goals than the guess
}

function compare(guessId: number, answerId: number): Feedback {
  const g = careerOf(guessId);
  const a = careerOf(answerId);
  const gClubs = new Set(g.map(r => r.club));
  const shared = [...new Set(a.map(r => r.club))].filter(c => gClubs.has(c));
  const gYears = new Set(g.map(r => r.year));
  const overlap = [...new Set(a.map(r => r.year))].filter(y => gYears.has(y)).length;
  const mid = (rows: SeasonRow[]) => rows.reduce((s, r) => s + r.year, 0) / Math.max(1, rows.length);
  const gp = PLAYERS.get(guessId);
  const ap = PLAYERS.get(answerId);
  const goalsDiff = (ap?.totalGoals ?? 0) - (gp?.totalGoals ?? 0);
  return {
    shared,
    era: overlap > 0 ? "overlap" : mid(a) < mid(g) ? "earlier" : "later",
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

const resultEmoji = (r: RoundState) => (r.solved ? ["🟣", "🟪", "🟪", "🟨", "🟨"][r.stage] : roundDone(r) ? "🟥" : "⬜");

// Counts towards a number with an ease-out
function useCountUp(target: number, ms = 600) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const v = start + (target - start) * (1 - Math.pow(1 - k, 3));
      setValue(Math.round(v));
      if (k < 1) raf = requestAnimationFrame(step); else { from.current = target; setValue(target); }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export default function CareerPath() {
  const [, navigate] = useLocation();
  const { user } = useUser();
  const dateKey = useMemo(() => getTodayStr(), []);
  const puzzles = useMemo(() => puzzlesFor(dateKey), [dateKey]);

  const [state, setState] = useState<CPState>(() => loadState(dateKey, puzzles, user?.username));
  const [current, setCurrent] = useState(() => {
    const i = loadState(dateKey, puzzles, user?.username).rounds.findIndex(r => !roundDone(r));
    return i === -1 ? ROUNDS - 1 : i;
  });
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [shake, setShake] = useState(0);
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [burst, setBurst] = useState<{ id: number; colours: string[] } | null>(null);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showRules, setShowRules] = useState(() => {
    const s = loadState(dateKey, puzzles, user?.username);
    return s.rounds.every(r => r.guesses.length === 0 && r.stage === 0) && !s.submitted && !hasPlayedBefore(user?.username, "careerpath");
  });
  const checkedRemote = useRef(false);

  const puzzle = puzzles[current];
  const round = state.rounds[current];
  const answer = PLAYERS.get(puzzle.id);
  const done = roundDone(round);
  const total = totalOf(state.rounds);
  const shownTotal = useCountUp(total, 900);
  const suggestions = useMemo(() => search(query, new Set(round.guesses)), [query, round.guesses]);
  const windowClubs = useMemo(() => [...new Set(puzzle.rows.map(r => r.club))], [puzzle]);

  useEffect(() => {
    if (checkedRemote.current || !user?.username || IS_LOCAL) return;
    checkedRemote.current = true;
    hasDailySubmission(user.username, "careerpath", dateKey).then(result => {
      // Also covers devices that already marked it submitted with nothing to show
      const empty = state.rounds.every(r => r.guesses.length === 0 && !roundDone(r)) && state.remoteScore == null;
      if (result.submitted && (!state.submitted || empty)) {
        const remote = result.state as Partial<CPState> | undefined;
        if (remote?.puzzleHash === state.puzzleHash && Array.isArray(remote.rounds)) {
          setState(prev => ({ ...prev, rounds: remote.rounds!, submitted: true }));
        } else {
          setState(prev => ({ ...prev, submitted: true, remoteScore: result.score }));
        }
        setShowRules(false);
      }
    });
  }, [user?.username, dateKey, state.submitted]);

  useEffect(() => {
    saveState(state, user?.username);
    const played = state.rounds.filter(r => roundDone(r) || r.guesses.length > 0).length;
    const finished = state.rounds.filter(roundDone).length;
    recordDaily(user?.username, "careerpath", dateKey, state.submitted || played > 0 ? {
      status: state.submitted ? "done" : "playing",
      score: state.remoteScore ?? totalOf(state.rounds),
      detail: state.submitted
        ? state.remoteScore != null ? "Finished" : `${state.rounds.filter(r => r.solved).length}/${ROUNDS} named`
        : `${finished}/${ROUNDS} players`,
      progress: finished / ROUNDS,
    } : null);
  }, [state]);
  useEffect(() => { setHighlight(0); }, [query]);

  const showToast = (text: string) => {
    const id = Date.now();
    setToast({ id, text });
    setTimeout(() => setToast(t => (t?.id === id ? null : t)), 1600);
  };

  const updateRound = useCallback((fn: (r: RoundState) => RoundState) => {
    setState(prev => ({ ...prev, rounds: prev.rounds.map((r, i) => (i === current ? fn(r) : r)) }));
  }, [current]);

  const finish = useCallback(async () => {
    setSubmitting(true);
    const t = totalOf(state.rounds);
    const solved = state.rounds.filter(r => r.solved).length;
    // Don't hold the end screen hostage to a slow or blocked connection; the write keeps trying
    if (user?.username && !IS_LOCAL && !state.submitted) {
      await Promise.race([submitDailyScore(user.username, "careerpath", dateKey, t, solved, ROUNDS, { puzzleHash: state.puzzleHash, rounds: state.rounds }), new Promise(r => setTimeout(r, 6000))]);
    }
    setState(prev => ({ ...prev, submitted: true }));
    setSubmitting(false);
    if (t >= MAX_SCORE * 0.6) playHighScore(); else playGameEnd();
    setShowEndScreen(true);
  }, [state.rounds, state.submitted, user?.username, dateKey]);

  const unlockNote = (stage: number) => `Clue unlocked · ${CLUES[Math.min(stage, MAX_STAGE)].full}`;

  const guess = useCallback((c: Candidate) => {
    if (done) return;
    setQuery("");
    trackEvent("guess", { game: "careerpath", mode: "daily", round: current + 1, clue_stage: round.stage, result: c.id === puzzle.id ? "correct" : "wrong" });
    if (c.id === puzzle.id) {
      updateRound(r => ({ ...r, guesses: [...r.guesses, c.id], solved: true }));
      playExactMatch();
      playCrowdRoar(1.1);
      setTimeout(playBoostHit, 250);
      buzz([30, 40, 30, 40, 60]);
      setFlashColor("bg-fuchsia-400");
      setTimeout(() => setFlashColor(null), 300);
      setBurst({ id: Date.now(), colours: windowClubs.map(clubColour) });
    } else {
      const lastChance = round.stage >= MAX_STAGE;
      updateRound(r => ({ ...r, guesses: [...r.guesses, c.id], stage: Math.min(MAX_STAGE, r.stage + 1), failed: lastChance }));
      setShake(s => s + 1);
      buzz([20, 30, 20]);
      if (lastChance) playGameEnd();
      else { playNeutral(); setTimeout(playTick, 260); showToast(unlockNote(round.stage + 1)); }
    }
  }, [done, puzzle.id, round.stage, updateRound, windowClubs, current]);

  const revealClue = useCallback(() => {
    if (done) return;
    trackEvent("clue_reveal", { game: "careerpath", mode: "daily", round: current + 1, clue_stage: round.stage + 1 });
    if (round.stage >= MAX_STAGE) {
      updateRound(r => ({ ...r, failed: true }));
      playGameEnd();
      return;
    }
    updateRound(r => ({ ...r, stage: r.stage + 1 }));
    playBoostHit();
    buzz(10);
    showToast(unlockNote(round.stage + 1));
  }, [done, round.stage, updateRound, current]);

  const nextRound = useCallback(() => {
    if (current < ROUNDS - 1) {
      setCurrent(c => c + 1);
      setQuery("");
      setBurst(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
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

  // The first clue opens seasons 1–2, the second seasons 3–5
  const clubShown = (row: SeasonRow) => done || round.stage >= 2 || (round.stage >= 1 && row.year < puzzle.start + 2);
  // The backdrop takes the round's colour, warming up as the multiplier grows
  const tint = ROUND_THEMES[current].to;

  const header = (
    <div className="w-full flex items-center justify-between mb-4">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
          <Home className="w-4 h-4 mr-1" /> Home
        </Button>
        {!showRules && (
          <button onClick={() => { setShowRules(true); trackEvent("rules_open", { game: "careerpath", mode: "daily" }); }} title="How to play"
            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors">
            <Info className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
      </div>
      {IS_LOCAL && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 whitespace-nowrap rounded-full border border-violet-500/40 bg-background/90 px-3 py-1.5 text-xs shadow-lg backdrop-blur">
          <span className="font-semibold text-violet-300">Test build</span>
          <span className="text-muted-foreground">no leaderboard</span>
          <a href={`/careerpath?day=${shiftDay(dateKey, -1)}`} className="px-2 py-0.5 rounded-full bg-muted/50 hover:bg-muted">← day</a>
          <a href={`/careerpath?day=${shiftDay(dateKey, 1)}`} className="px-2 py-0.5 rounded-full bg-muted/50 hover:bg-muted">day →</a>
        </div>
      )}
    </div>
  );

  if (showEndScreen || (state.submitted && !showRules)) {
    return <EndScreen puzzles={puzzles} rounds={state.rounds} remoteScore={state.remoteScore ?? null} dateKey={dateKey} navigate={navigate} username={user?.username} />;
  }

  // --- Rules Screen ---
  if (showRules) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Backdrop tint="#8b5cf6" />
        <div className="relative z-10 flex flex-col items-center w-full max-w-lg mx-auto px-4 pt-4 pb-8 flex-1">
          {header}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full text-center">
            <h1 className="text-4xl font-black tracking-tight mb-1">
              <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">Career Path</span>
            </h1>
            <p className="text-sm text-muted-foreground mb-6">Name the player from five seasons of their Premier League numbers</p>
            <div className="flex justify-center gap-3 mb-6">
              {MULTIPLIERS.map((_, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}
                  className="flex flex-col items-center gap-1.5">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white" style={{ background: roundGradient(i) }}>{i + 1}</div>
                  <MultBadge k={i} />
                </motion.div>
              ))}
            </div>
            <div className="text-left space-y-3 mb-8">
              <RuleItem icon="📊" text="Five players a day, each harder than the last. You see five straight Premier League seasons of goals, assists and apps, with the clubs hidden" />
              <RuleItem icon="🔓" text="Five guesses per player. Every wrong one unlocks a clue: the clubs for seasons 1–2, then seasons 3–5, then position & nation, then every PL club they played for" />
              <RuleItem icon="🧭" text="Wrong guesses show what they share with the answer: clubs, era, nation, more or fewer goals" />
              <RuleItem icon="🏆" text={`10 points first time, then 8, 6, 4, 2, times the round's multiplier. ${MAX_SCORE} is a perfect day`} />
            </div>
            <Button className="w-full text-lg py-6 shadow-xl shadow-fuchsia-500/20 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white font-bold border-violet-300/50"
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
  const prize = STAGE_POINTS[round.stage] * MULTIPLIERS[current];

  // --- Playing Screen ---
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Backdrop tint={tint} />
      <ScreenFlash show={flashColor !== null} color={flashColor || "bg-fuchsia-400"} />
      {burst && <Confetti key={burst.id} colours={burst.colours} />}

      {/* Centred by a full-width row: framer's transform would override a translate-x */}
      <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
        {/* wait: an outgoing toast would otherwise sit beside the new one and push it off-centre */}
        <AnimatePresence mode="wait">
          {toast && (
            <motion.div key={toast.id} initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, transition: { duration: 0.12 } }}
              transition={{ type: "spring", stiffness: 500, damping: 26 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-fuchsia-500 text-white text-sm font-bold shadow-xl shadow-fuchsia-500/40 max-w-full">
              <Unlock className="w-4 h-4 shrink-0" /> <span className="truncate">{toast.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-lg mx-auto px-4 pt-4 pb-24 flex-1">
        {header}

        <RoundTrack rounds={state.rounds} current={current} total={shownTotal} />

        {/* Round, points and clue ladder in one panel */}
        <div className="w-full mt-3 rounded-2xl border border-white/10 bg-card/60 px-4 pt-3 pb-2.5">
          <div className="flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Round {current + 1}</span>
              <MultBadge k={current} />
            </div>
            <motion.div key={`${current}-${round.stage}-${done}`} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="flex items-baseline gap-1 origin-right">
              {done && !round.solved ? (
                <span className="text-sm font-bold text-red-300">Missed · 0 pts</span>
              ) : (
                <>
                  <span className="text-2xl font-black tabular-nums text-white">{done ? `+${fmtPts(roundPoints(round, current))}` : fmtPts(prize)}</span>
                  <span className="text-xs text-muted-foreground">pts</span>
                </>
              )}
            </motion.div>
          </div>
          <div className="grid grid-cols-5 gap-1.5 mt-2">
            {CLUES.map((c, i) => {
              const on = i <= round.stage || done;
              return (
                <div key={c.label}>
                  <div className={`h-1 rounded-full transition-colors duration-300 ${on ? "bg-gradient-to-r from-violet-400 to-fuchsia-400" : "bg-white/10"}`} />
                  <div className={`text-[9px] mt-1 font-semibold uppercase tracking-wide truncate ${on ? "text-fuchsia-200" : "text-muted-foreground/50"}`}>{c.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Season rows */}
        <motion.div key={`cards-${current}-${shake}`} animate={shake ? { x: [0, -8, 8, -5, 5, 0] } : {}} transition={{ duration: 0.35 }}
          className="w-full mt-3 rounded-2xl border border-white/10 bg-card/60 overflow-hidden">
          <div className="flex items-center gap-3 px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            <span className="w-11">Season</span><span className="flex-1">Club</span>
            <span className="w-9 text-center">Apps</span><span className="w-8 text-center">G</span><span className="w-8 text-center">A</span>
          </div>
          {years.map((y, idx) => (
            <SeasonRows key={`${current}-${y}`} index={idx} year={y} rows={puzzle.rows.filter(r => r.year === y)} shown={clubShown} />
          ))}
        </motion.div>

        {/* Profile clues */}
        <AnimatePresence>
          {(round.stage >= 3 || done) && answer && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="w-full flex flex-wrap gap-2 mt-2.5">
              {[broadPosition(answer), `${flagOf(answer.nationality)} ${answer.nationality}`.trim()].map((t, i) => (
                <motion.span key={t} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 16, delay: i * 0.08 }}
                  className="px-3 py-1 rounded-full text-xs font-bold bg-violet-500/20 text-violet-100 border border-violet-400/40">{t}</motion.span>
              ))}
              {round.stage >= 4 && !done && <CareerClue id={puzzle.id} />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Guess box, or the answer */}
        {!done ? (
          <div className="w-full mt-4">
            <div className="relative">
              <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
                placeholder="Who is it?" aria-label="Guess a player" autoComplete="off" autoCorrect="off" spellCheck={false}
                className="w-full h-14 rounded-2xl border border-violet-400/30 bg-card/80 px-5 text-lg font-semibold outline-none focus:border-fuchsia-400/70 focus:shadow-[0_0_30px_-6px_rgba(217,70,239,0.5)] transition-all placeholder:text-muted-foreground/50" />
              <AnimatePresence>
                {suggestions.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="absolute z-30 left-0 right-0 mt-1.5 rounded-2xl border border-white/10 bg-card/95 backdrop-blur shadow-2xl overflow-hidden">
                    {suggestions.map((c, i) => (
                      <motion.button key={c.id} type="button" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.025 }}
                        onMouseDown={e => { e.preventDefault(); guess(c); }} onMouseEnter={() => setHighlight(i)}
                        className={`w-full px-5 py-3 text-left font-semibold transition-colors ${i === highlight ? "bg-gradient-to-r from-violet-500/25 to-transparent text-white" : "text-foreground/90"}`}>
                        {c.name}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center justify-between mt-2.5">
              <span className="text-xs text-muted-foreground">
                {round.stage < MAX_STAGE ? <>Wrong guess unlocks: <span className="text-fuchsia-200 font-semibold">{CLUES[round.stage + 1].full}</span></> : <span className="text-red-300 font-semibold">Last chance</span>}
              </span>
              <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={revealClue}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100 hover:bg-fuchsia-500/20 transition-colors">
                <Lightbulb className="w-3.5 h-3.5" />{round.stage < MAX_STAGE ? "Reveal clue" : "Give up"}
              </motion.button>
            </div>
          </div>
        ) : (
          <AnswerCard puzzle={puzzle} round={round} roundIndex={current} onNext={nextRound} submitting={submitting} />
        )}

        {/* Wrong guesses */}
        <div className="w-full mt-4 space-y-2">
          <AnimatePresence initial={false}>
            {[...round.guesses].reverse().filter(id => id !== puzzle.id).map(id => (
              <GuessRow key={id} guessId={id} answerId={puzzle.id} />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// Soft colour wash behind everything, in the current round's colour
function Backdrop({ tint }: { tint: string }) {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <motion.div className="absolute -top-1/3 left-1/2 -translate-x-1/2 w-[140%] h-2/3 rounded-full blur-3xl"
        animate={{ backgroundColor: tint, opacity: 0.18 }} transition={{ duration: 1.2 }} />
      <div className="absolute bottom-0 -right-1/4 w-2/3 h-1/2 rounded-full blur-3xl bg-fuchsia-600/10" />
      <div className="absolute bottom-1/4 -left-1/4 w-1/2 h-1/2 rounded-full blur-3xl bg-violet-700/10" />
    </div>
  );
}

// The day's five rounds: number in the circle, multiplier badge underneath
function RoundTrack({ rounds, current, total }: { rounds: RoundState[]; current: number; total: number }) {
  return (
    <div className="w-full flex items-start gap-2">
      <div className="flex-1 flex items-start">
        {rounds.map((r, i) => {
          const isCur = i === current;
          const style: React.CSSProperties = r.solved ? { background: roundGradient(i), borderColor: "transparent" }
            : isCur && !r.failed ? { borderColor: ROUND_THEMES[i].to, boxShadow: `0 0 16px -2px ${ROUND_THEMES[i].to}` } : {};
          return (
            <div key={i} className="flex items-start flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div style={style}
                  className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all ${r.solved ? "text-white"
                    : r.failed ? "bg-red-500/20 text-red-300 border-red-500/50" : isCur ? "bg-white/[0.06] text-white" : "bg-card/40 text-muted-foreground border-white/10"}`}>
                  {r.solved ? <Check className="w-4 h-4" /> : r.failed ? <X className="w-4 h-4" /> : <span className="text-sm font-black">{i + 1}</span>}
                </div>
                <MultBadge k={i} dim={!isCur && !roundDone(r)} />
              </div>
              {i < rounds.length - 1 && (
                <div className="flex-1 h-0.5 mx-1 mt-[17px] rounded-full bg-white/10 overflow-hidden">
                  <motion.div className="h-full" style={{ background: `linear-gradient(90deg, ${ROUND_THEMES[i].to}, ${ROUND_THEMES[i + 1].from})` }}
                    animate={{ width: roundDone(r) ? "100%" : "0%" }} transition={{ duration: 0.5 }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-right shrink-0 pl-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Score</div>
        <div className="text-xl font-black tabular-nums text-white">{fmtPts(total)}</div>
      </div>
    </div>
  );
}

// "×2" chip in the round's colour
function MultBadge({ k, dim = false, onDark = false }: { k: number; dim?: boolean; onDark?: boolean }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-px rounded-md text-[10px] font-black leading-tight tabular-nums text-white ${dim ? "opacity-40" : ""} ${onDark ? "ring-1 ring-white/40" : ""}`}
      style={{ background: roundGradient(k) }}>
      ×{MULTIPLIERS[k]}
    </span>
  );
}

function SeasonRows({ index, year, rows, shown }: { index: number; year: number; rows: SeasonRow[]; shown: (r: SeasonRow) => boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24, delay: index * 0.05 }}
      className="border-t border-white/5">
      {rows.map((row, k) => (
        <div key={row.club} className="flex items-center gap-3 px-3 py-2">
          <div className="w-11 shrink-0 text-sm font-black tabular-nums">{k === 0 ? shortSeason(year) : <span className="text-[10px] font-bold text-fuchsia-300">+ also</span>}</div>
          <div className="flex-1 min-w-0"><ClubBadge club={row.club} open={shown(row)} /></div>
          <Stat value={row.apps} className="w-9 text-muted-foreground" />
          <Stat value={row.goals} className="w-8" />
          <Stat value={row.assists} className="w-8" />
        </div>
      ))}
    </motion.div>
  );
}

function Stat({ value, className = "" }: { value: number; className?: string }) {
  return <div className={`shrink-0 text-center text-lg font-black tabular-nums ${value === 0 ? "opacity-35" : ""} ${className}`}>{value}</div>;
}

function ClubBadge({ club, open }: { club: string; open: boolean }) {
  return (
    <div className="relative h-7 [perspective:600px]">
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.div key="open" initial={{ rotateX: -95, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className="absolute inset-0 flex items-center px-3 rounded-lg text-sm font-black truncate"
            style={{ background: `linear-gradient(135deg, ${clubColour(club)}, ${clubColour(club)}cc)`, color: clubText(club), boxShadow: `0 6px 20px -8px ${clubColour(club)}` }}>
            {club}
          </motion.div>
        ) : (
          <motion.div key="locked" exit={{ rotateX: 95, opacity: 0 }} transition={{ duration: 0.18 }}
            className="absolute inset-0 flex items-center gap-1.5 px-3 rounded-lg bg-white/[0.05] border border-white/10 text-muted-foreground/50 text-xs font-semibold">
            <Lock className="w-3 h-3" /> Hidden
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GuessRow({ guessId, answerId }: { guessId: number; answerId: number }) {
  const g = PLAYERS.get(guessId);
  const f = useMemo(() => compare(guessId, answerId), [guessId, answerId]);
  const chips: { ok: boolean; node: React.ReactNode; style?: React.CSSProperties }[] = [
    ...(f.shared.length
      ? f.shared.map(c => ({ ok: true, node: <><Check className="w-3 h-3" />{c}</>, style: { background: clubColour(c), color: clubText(c), borderColor: "transparent" } }))
      : [{ ok: false, node: <><X className="w-3 h-3" />No clubs in common</> }]),
    { ok: f.era === "overlap", node: f.era === "overlap" ? <><Check className="w-3 h-3" />Same era · {f.overlap} season{f.overlap === 1 ? "" : "s"}</> : <>{f.era === "earlier" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}Answer's {f.era}</> },
    { ok: f.sameNation, node: <>{f.sameNation ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}{flagOf(g?.nationality)} {g?.nationality || "?"}</> },
    { ok: f.goals === "same", node: <>{f.goals === "more" ? <ArrowUp className="w-3 h-3" /> : f.goals === "fewer" ? <ArrowDown className="w-3 h-3" /> : <Check className="w-3 h-3" />}{f.goals === "same" ? "Same goals" : f.goals === "more" ? "More PL goals" : "Fewer PL goals"}</> },
  ];
  return (
    <motion.div layout initial={{ opacity: 0, y: -14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className="rounded-2xl border border-red-400/20 bg-card/60 backdrop-blur px-3.5 py-3">
      <div className="flex items-center justify-between">
        <span className="font-bold">{g?.displayName}</span>
        <span className="text-[10px] uppercase tracking-wider text-red-300/80 font-bold">Not him</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {chips.map((c, i) => (
          <motion.span key={i} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18, delay: 0.08 + i * 0.06 }}
            style={c.style}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${c.ok
              ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/40" : "bg-white/[0.04] text-muted-foreground border-white/10"}`}>
            {c.node}
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}

function AnswerCard({ puzzle, round, roundIndex, onNext, submitting }: {
  puzzle: Puzzle; round: RoundState; roundIndex: number; onNext: () => void; submitting: boolean;
}) {
  const p = PLAYERS.get(puzzle.id);
  const pts = roundPoints(round, roundIndex);
  const [target, setTarget] = useState(0);
  useEffect(() => { const t = setTimeout(() => setTarget(pts), 200); return () => clearTimeout(t); }, [pts]);
  const shown = useCountUp(target, 700);
  return (
    <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={`w-full mt-4 rounded-3xl border p-5 backdrop-blur ${round.solved
        ? "border-fuchsia-400/40 bg-gradient-to-br from-violet-600/25 via-fuchsia-600/10 to-transparent"
        : "border-red-400/30 bg-gradient-to-br from-red-600/15 to-transparent"}`}>
      <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">
        {round.solved ? (round.stage === 0 ? "No clues needed!" : `Got him · ${round.stage} clue${round.stage === 1 ? "" : "s"}`) : "It was"}
      </div>
      <div className="flex items-end justify-between gap-3 mt-1">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
          className="text-3xl font-black leading-tight">{p?.displayName}</motion.div>
        {round.solved && (
          <div className="text-right shrink-0">
            <div className="text-3xl font-black tabular-nums bg-gradient-to-r from-violet-200 to-fuchsia-300 bg-clip-text text-transparent">+{fmtPts(shown)}</div>
            <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground tabular-nums">{STAGE_POINTS[round.stage]} <MultBadge k={roundIndex} /></div>
          </div>
        )}
      </div>
      <CareerBar id={puzzle.id} windowStart={puzzle.start} />
      <Button className="w-full mt-5 py-6 text-base bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white font-bold border-violet-300/50 shadow-lg shadow-fuchsia-500/20"
        onClick={onNext} disabled={submitting}>
        {roundIndex < ROUNDS - 1 ? <>Round {roundIndex + 2} <MultBadge k={roundIndex + 1} onDark /></> : submitting ? "Submitting..." : "See your score"}
        <ChevronRight className="w-5 h-5 ml-1" />
      </Button>
    </motion.div>
  );
}

// Final clue: every PL club with its years, and the first and last PL season
function careerSpans(id: number) {
  const spans: { club: string; from: number; to: number }[] = [];
  for (const r of [...careerOf(id)].sort((a, b) => a.year - b.year)) {
    const open = spans.find(s => s.club === r.club && r.year - s.to <= 1);
    if (open) open.to = r.year; else spans.push({ club: r.club, from: r.year, to: r.year });
  }
  return spans.sort((a, b) => a.from - b.from || a.to - b.to);
}

function CareerClue({ id }: { id: number }) {
  const spans = careerSpans(id);
  const first = Math.min(...spans.map(s => s.from));
  const last = Math.max(...spans.map(s => s.to));
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="w-full mt-1 rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-200">PL career {shortSeason(first)} – {shortSeason(last)}</div>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {spans.map((s, i) => (
          <motion.span key={i} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18, delay: i * 0.06 }}
            className="px-2 py-0.5 rounded-md text-[11px] font-bold" style={{ background: clubColour(s.club), color: clubText(s.club) }}>
            {s.club} {String(s.from).slice(2)}–{String(s.to + 1).slice(2)}
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}

// The whole PL career as a strip of seasons in club colours, with the five shown outlined
function CareerBar({ id, windowStart }: { id: number; windowStart?: number }) {
  const p = PLAYERS.get(id);
  const bySeason = new Map<number, SeasonRow>();
  for (const r of careerOf(id)) if ((bySeason.get(r.year)?.apps ?? -1) < r.apps) bySeason.set(r.year, r); // main club = most apps
  const years = [...bySeason.keys()].sort((a, b) => a - b);
  const first = years[0];
  const last = years[years.length - 1];
  const span = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const clubs = [...new Set(years.map(y => bySeason.get(y)!.club))];
  return (
    <div className="mt-3">
      <div className="flex gap-[2px] h-7">
        {span.map((y, i) => {
          const r = bySeason.get(y);
          const inWindow = windowStart !== undefined && y >= windowStart && y < windowStart + WINDOW;
          return (
            <motion.div key={y} title={r ? `${shortSeason(y)} ${r.club}` : `${shortSeason(y)} not in the PL`}
              initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.25 + i * 0.03, type: "spring", stiffness: 400, damping: 20 }}
              className={`flex-1 rounded-[3px] origin-bottom ${inWindow ? "ring-2 ring-white/80" : ""}`}
              style={{ background: r ? clubColour(r.club) : "rgba(255,255,255,0.06)" }} />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1 tabular-nums">
        <span>{shortSeason(first)}</span><span>{shortSeason(last)}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {clubs.map(c => (
          <span key={c} className="px-2 py-0.5 rounded-md text-[11px] font-bold" style={{ background: clubColour(c), color: clubText(c) }}>{c}</span>
        ))}
      </div>
      {p && <div className="text-xs text-muted-foreground mt-2">{p.totalAppearances} PL apps · {p.totalGoals} goals · {p.totalAssists} assists</div>}
    </div>
  );
}

// A burst of confetti in the answer's club colours
const CONFETTI = Array.from({ length: 60 }, (_, i) => {
  const a = -Math.PI / 2 + ((i % 15) / 14 - 0.5) * 2.4;
  const v = 240 + ((i * 37) % 9) * 34;
  return {
    x: Math.cos(a) * v, y: Math.sin(a) * v, drift: ((i * 53) % 7 - 3) * 20, rotate: ((i * 71) % 9 - 4) * 150,
    w: 6 + (i % 3) * 2, h: i % 4 === 0 ? 7 : 13 + (i % 3) * 2, round: i % 4 === 0, delay: (i % 6) * 0.02,
  };
});

function Confetti({ colours }: { colours: string[] }) {
  const palette = [...colours, "#e879f9", "#a78bfa", "#ffffff"];
  return (
    <div className="fixed left-1/2 top-[55%] z-50 pointer-events-none">
      {CONFETTI.map((c, i) => (
        <motion.span key={i} className="absolute block"
          style={{ width: c.w, height: c.h, background: palette[i % palette.length], borderRadius: c.round ? "50%" : 2 }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: [0, c.x, c.x + c.drift], y: [0, c.y, c.y + 540], rotate: [0, c.rotate, c.rotate * 2], opacity: [1, 1, 0] }}
          transition={{ duration: 2, delay: c.delay, times: [0, 0.3, 1], ease: ["easeOut", "easeIn"] }} />
      ))}
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

function EndScreen({ puzzles, rounds, remoteScore = null, dateKey, navigate, username }: {
  puzzles: Puzzle[];
  rounds: RoundState[];
  remoteScore?: number | null;
  dateKey: string;
  navigate: (to: string) => void;
  username?: string;
}) {
  // Played on another device with no rounds to show: just the score
  const scoreOnly = remoteScore !== null;
  const total = scoreOnly ? remoteScore! : totalOf(rounds);
  const [target, setTarget] = useState(0);
  useEffect(() => { const t = setTimeout(() => setTarget(total), 250); return () => clearTimeout(t); }, [total]);
  const shown = useCountUp(target, 1200);
  const [lbPeriod, setLbPeriod] = useState<DailyPeriod>("today");
  const { entries, loading } = useDailyLeaderboard("careerpath", lbPeriod, 10, 1000);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const text = `Career Path ${formatDate(dateKey)}\n${scoreOnly ? "" : `${rounds.map(resultEmoji).join("")} `}${fmtPts(total)}/${MAX_SCORE}\n${shareLink("/careerpath")}`;
    try {
      if (navigator.share && !window.matchMedia?.("(pointer: fine)").matches) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch { /* dismissed */ }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Backdrop tint="#a855f7" />
      <div className="relative z-10 flex flex-col items-center w-full max-w-lg mx-auto px-4 pt-4 pb-8 flex-1">
        <div className="w-full flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            <Home className="w-4 h-4 mr-1" /> Home
          </Button>
          <div className="flex items-center gap-2">
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <h1 className="text-2xl font-black tracking-tight mb-2">
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">Career Path</span>
          </h1>
          <div className="text-6xl font-black tabular-nums bg-gradient-to-b from-white to-fuchsia-200 bg-clip-text text-transparent">{fmtPts(shown)}</div>
          <div className="text-sm text-muted-foreground">out of {MAX_SCORE}{scoreOnly ? " · played on another device" : ""}</div>
          {!scoreOnly && <div className="flex justify-center gap-2 text-3xl mt-3">
            {rounds.map((r, i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 14, delay: 0.3 + i * 0.1 }}>{resultEmoji(r)}</motion.span>
            ))}
          </div>}
          <button onClick={share}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold px-4 py-1.5 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 transition-colors">
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

        <div className="w-full mb-6 space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Today's players</h3>
          {puzzles.map((pz, i) => (
            <motion.div key={pz.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.08 }}
              className="rounded-2xl border border-white/10 bg-card/60 backdrop-blur px-3.5 py-3">
              <div className="flex items-center justify-between">
                <span className="font-bold inline-flex items-center gap-2"><MultBadge k={i} />{PLAYERS.get(pz.id)?.displayName}</span>
                {!scoreOnly && <span className="font-black tabular-nums">{resultEmoji(rounds[i])} +{fmtPts(roundPoints(rounds[i], i))}</span>}
              </div>
              <CareerBar id={pz.id} windowStart={pz.start} />
            </motion.div>
          ))}
        </div>

        <div className="w-full text-center py-4 text-muted-foreground">
          <DailyNext current="careerpath" />
        </div>
      </div>
    </div>
  );
}
