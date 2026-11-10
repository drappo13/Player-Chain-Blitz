import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import plPlayers from "@/data/pl-players.json";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Home, Flag, Trophy, ChevronRight, Info, ListChecks, Shuffle, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { playCorrect, playNeutral, playHighScore, playGameEnd, playComboCorrect, playBoostHit } from "@/lib/sounds";
import { normalizeName } from "@/lib/normalize";
import type { PLPlayer } from "@/data/pl-player-types";
import { ScreenFlash } from "@/components/screen-flash";
import { useUser } from "@/lib/user-context";
import { submitDailyScore, hasDailySubmission } from "@/lib/daily-score";
import { useDailyLeaderboard, type DailyPeriod } from "@/lib/use-daily-leaderboard";
import { LeaderboardTable } from "@/components/leaderboard-table";

// Board version — bump to reshuffle the order boards are dealt in
const BOARD_VERSION = 3;
// Day 0 of the rotation. Boards are dealt in a fixed order from here, so no letter set
// comes back until every other set has had a turn.
const HIVE_EPOCH = "2026-11-09";

// --- Board rules ---
// A board is the letters of one surname that uses 8–10 different letters (the pangram).
// That player must be the only answer using every letter, and someone people know:
// 50+ PL apps in the last 10 seasons, 100+ apps in the last 20, or 100+ PL goals ever.
// Every other answer can be anyone with a PL appearance.
const HIVE_SIZES = [8, 9, 10];
const KNOWN_APPS = 100; // a player most fans could name
const MIN_ANSWERS = 40;
const MAX_ANSWERS = 250;
const MIN_KNOWN_ANSWERS = 15;
const MIN_CENTRE_ANSWERS = 15; // a centre letter has to be worth chasing
// Naming a PL great doubles the points, as does using the centre letter.
// Shared surnames count as a legend if any namesake is one.
const LEGEND_APPS = 250;
const LEGEND_GOALS = 75;
const MIN_LEGENDS = 5;

function isLegend(players: PLPlayer[]): boolean {
  return players.some(p => p.totalAppearances >= LEGEND_APPS || p.totalGoals >= LEGEND_GOALS);
}

const LATEST_SEASON = Math.max(...(plPlayers as PLPlayer[]).map(p => p.lastSeason || 0));

function isStar(p: PLPlayer): boolean {
  const last = p.lastSeason || 0;
  return (last > LATEST_SEASON - 10 && p.totalAppearances >= 50)
    || (last > LATEST_SEASON - 20 && p.totalAppearances >= 100)
    || p.totalGoals >= 100;
}

// --- Ranks (% of the day's maximum score) ---
const RANKS = [
  { pct: 0,    label: "Trialist" },
  { pct: 0.03, label: "Academy" },
  { pct: 0.07, label: "Squad player" },
  { pct: 0.12, label: "First team" },
  { pct: 0.2,  label: "Fan favourite" },
  { pct: 0.3,  label: "Captain" },
  { pct: 0.42, label: "Club legend" },
  { pct: 0.6,  label: "Hall of Famer" },
  { pct: 1,    label: "Invincible" },
];

function getRank(score: number, maxScore: number) {
  const pct = maxScore > 0 ? score / maxScore : 0;
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) if (pct >= RANKS[i].pct) index = i;
  const next = RANKS[index + 1] || null;
  return {
    index,
    label: RANKS[index].label,
    next,
    toNext: next ? Math.max(1, Math.ceil(next.pct * maxScore) - score) : 0,
  };
}

// --- Seeded PRNG (mulberry32) ---
function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
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

// --- Letters ---
const letterBit = (ch: string) => 1 << (ch.charCodeAt(0) - 97);

function maskOf(word: string): number {
  let m = 0;
  for (const ch of word) m |= letterBit(ch);
  return m;
}

function bitCount(m: number): number {
  let n = 0;
  while (m) { m &= m - 1; n++; }
  return n;
}

function lettersOf(mask: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < 26; i++) if (mask & (1 << i)) out.push(String.fromCharCode(97 + i));
  return out;
}

// --- Surnames ---
// A player's surname is everything after the first word of their display name
// ("Virgil van Dijk" → "van Dijk"); one-name players use that name. Players who
// share a surname share one answer.
function surnameOf(p: PLPlayer): string {
  const parts = p.displayName.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
}

interface SurnameGroup {
  key: string;
  mask: number;
  players: PLPlayer[]; // most appearances first
}

let groupsCache: SurnameGroup[] | null = null;

function surnameGroups(): SurnameGroup[] {
  if (groupsCache) return groupsCache;
  const byKey = new Map<string, PLPlayer[]>();
  for (const p of plPlayers as PLPlayer[]) {
    if (!(p.totalAppearances > 0)) continue;
    const key = normalizeName(surnameOf(p));
    if (!/^[a-z]+$/.test(key)) continue;
    const list = byKey.get(key);
    if (list) list.push(p);
    else byKey.set(key, [p]);
  }
  const groups: SurnameGroup[] = [];
  byKey.forEach((players, key) => {
    players.sort((a, b) => b.totalAppearances - a.totalAppearances);
    groups.push({ key, mask: maskOf(key), players });
  });
  groupsCache = groups;
  return groups;
}

// --- Boards ---
interface Board {
  letters: string[]; // 8–10, alphabetical
  centre: string;
}

let boardOrderCache: Board[] | null = null;

// Every letter set that qualifies (see Board rules) and gives a fair day — enough
// answers, not too many, a core of well-known players and some legends — with each
// centre letter that enough answers use.
function boardOrder(): Board[] {
  if (boardOrderCache) return boardOrderCache;
  const groups = surnameGroups();
  const usersOfSet = new Map<number, number>();
  for (const g of groups) usersOfSet.set(g.mask, (usersOfSet.get(g.mask) || 0) + 1);
  const sets = new Set<number>();
  for (const g of groups) {
    const star = g.players[0];
    if (HIVE_SIZES.includes(bitCount(g.mask)) && g.players.length === 1 && usersOfSet.get(g.mask) === 1
      && isStar(star)) sets.add(g.mask);
  }

  const bySet: Board[][] = [];
  Array.from(sets).sort((a, b) => a - b).forEach(set => {
    const answers = groups.filter(g => (g.mask & ~set) === 0);
    const known = answers.filter(g => g.players[0].totalAppearances >= KNOWN_APPS).length;
    const legends = answers.filter(g => isLegend(g.players)).length;
    if (answers.length < MIN_ANSWERS || answers.length > MAX_ANSWERS || known < MIN_KNOWN_ANSWERS || legends < MIN_LEGENDS) return;
    const boards: Board[] = [];
    for (const centre of lettersOf(set)) {
      const bit = letterBit(centre);
      if (answers.filter(g => g.mask & bit).length >= MIN_CENTRE_ANSWERS) boards.push({ letters: lettersOf(set), centre });
    }
    if (boards.length) bySet.push(boards);
  });

  // Shuffle the sets, then deal one centre from each set per round, so the same letters
  // (and pangram) only return, with a new centre, after every other set has been used.
  const rng = mulberry32(hashString(`hive-v${BOARD_VERSION}`));
  shuffleInPlace(bySet, rng);
  bySet.forEach(b => shuffleInPlace(b, rng));
  const order: Board[] = [];
  for (let round = 0; ; round++) {
    let dealt = false;
    for (const boards of bySet) {
      if (boards[round]) { order.push(boards[round]); dealt = true; }
    }
    if (!dealt) break;
  }
  boardOrderCache = order;
  return order;
}

function daysSinceEpoch(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [ey, em, ed] = HIVE_EPOCH.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ey, em - 1, ed)) / 86400000);
}

function boardFor(dateKey: string): Board {
  const order = boardOrder();
  const n = order.length;
  return order[((daysSinceEpoch(dateKey) % n) + n) % n];
}

// --- Answers ---
interface Answer {
  key: string;
  label: string;   // the surname as written, e.g. "van Dijk"
  players: PLPlayer[];
  club: string;    // best-known player's club with the most appearances
  points: number;
  pangram: boolean;
  legend: boolean;
  usesCentre: boolean;
}

function topClub(p: PLPlayer): string {
  let best = "";
  let apps = -1;
  for (const [club, s] of Object.entries(p.clubs)) {
    if (s.appearances > apps) { best = club; apps = s.appearances; }
  }
  return best;
}

function answersFor(board: Board): Answer[] {
  const set = board.letters.reduce((m, ch) => m | letterBit(ch), 0);
  const bit = letterBit(board.centre);
  return surnameGroups()
    .filter(g => (g.mask & ~set) === 0)
    .map(g => {
      const pangram = g.mask === set;
      const legend = isLegend(g.players);
      const usesCentre = (g.mask & bit) !== 0;
      // 1 point a letter (+ the board size for the pangram), doubled for the centre
      // letter and doubled again for a legend
      return {
        key: g.key,
        label: surnameOf(g.players[0]),
        players: g.players,
        club: topClub(g.players[0]),
        points: (g.key.length + (pangram ? board.letters.length : 0)) * (usesCentre ? 2 : 1) * (legend ? 2 : 1),
        pangram,
        legend,
        usesCentre,
      };
    })
    .sort((a, b) => b.players[0].totalAppearances - a.players[0].totalAppearances);
}

function answerName(a: Answer): string {
  return a.players.length > 1 ? `${a.label} ×${a.players.length}` : a.players[0].displayName;
}

// A copy served from localhost is a test build: ?day=YYYY-MM-DD plays any day's hive
// and scores never reach the leaderboard.
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
interface HiveState {
  dateKey: string;
  boardHash: string;
  score: number;
  found: string[]; // answer keys, newest first
  submitted: boolean;
}

function makeBoardHash(board: Board): string {
  return `${board.letters.join("")}:${board.centre}`;
}

function storageKey(dateKey: string, username?: string): string {
  return username ? `centrecircle-${username.toLowerCase()}-${dateKey}` : `centrecircle-${dateKey}`;
}

function loadState(dateKey: string, board: Board, username?: string): HiveState {
  const hash = makeBoardHash(board);
  try {
    const raw = localStorage.getItem(storageKey(dateKey, username));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.dateKey === dateKey && parsed.boardHash === hash) {
        return { ...parsed, found: parsed.found || [], submitted: parsed.submitted || false };
      }
    }
  } catch { /* ignore */ }
  return { dateKey, boardHash: hash, score: 0, found: [], submitted: false };
}

function saveState(state: HiveState, username?: string) {
  try {
    localStorage.setItem(storageKey(state.dateKey, username), JSON.stringify(state));
  } catch { /* ignore */ }
}

// --- Hive geometry: the centre hex with the other letters in a ring around it ---
const HEX_W = 60;
const HEX_H = HEX_W * 0.866;
const CENTRE_W = 78;
const HEX_CLIP = "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)";

function ringLayout(count: number) {
  // Far enough out that neighbouring hexes and the centre never touch
  const radius = Math.max((HEX_W + 8) / (2 * Math.sin(Math.PI / count)), CENTRE_W / 2 + HEX_W / 2 + 8);
  const size = Math.ceil(2 * radius + HEX_W);
  const slots = Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    return { x: size / 2 + radius * Math.cos(a) - HEX_W / 2, y: size / 2 + radius * Math.sin(a) - HEX_H / 2 };
  });
  return { size, slots };
}

// --- Feedback types ---
type FeedbackType = "correct" | "pangram" | "wrong" | "neutral" | null;

interface Feedback {
  type: FeedbackType;
  message: string;
  points?: number;
  tags?: string[];
}

// A light tap on phones that support it (Android); silently nothing elsewhere.
function buzz(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}

const finePointer = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches;

// --- Component ---
export default function CentreCircle() {
  const [, navigate] = useLocation();
  const { user } = useUser();
  const dateKey = useMemo(() => getTodayStr(), []);
  const board = useMemo(() => boardFor(dateKey), [dateKey]);
  const answers = useMemo(() => answersFor(board), [board]);
  const answerByKey = useMemo(() => new Map(answers.map(a => [a.key, a] as [string, Answer])), [answers]);
  const maxScore = useMemo(() => answers.reduce((s, a) => s + a.points, 0), [answers]);

  const [state, setState] = useState<HiveState>(() => loadState(dateKey, board, user?.username));
  const [input, setInput] = useState("");
  const [outer, setOuter] = useState(() => board.letters.filter(l => l !== board.centre));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [shake, setShake] = useState(0);
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const [floatingPoints, setFloatingPoints] = useState<{ id: number; value: number } | null>(null);
  const [rankUp, setRankUp] = useState<string | null>(null);
  const [pangramHit, setPangramHit] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  const [popped, setPopped] = useState<{ id: number; word: string; gold: boolean } | null>(null);
  const [showTracker, setShowTracker] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [showRules, setShowRules] = useState(() => {
    const s = loadState(dateKey, board, user?.username);
    return s.found.length === 0 && !s.submitted;
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout>>();
  const floatId = useRef(0);
  const checkedRemote = useRef(false);

  const isFinished = state.submitted;
  const foundSet = useMemo(() => new Set(state.found), [state.found]);
  const rank = getRank(state.score, maxScore);

  // Check remote submission on load — handles cross-device AND failed writes
  useEffect(() => {
    if (checkedRemote.current || !user?.username || IS_LOCAL) return;
    checkedRemote.current = true;
    hasDailySubmission(user.username, "centrecircle", dateKey).then(result => {
      if (result.submitted && !state.submitted) {
        setState(prev => ({ ...prev, submitted: true, score: result.score }));
      } else if (!result.submitted && state.submitted) {
        setState(prev => ({ ...prev, submitted: false }));
      }
    });
  }, [user?.username, dateKey, state.submitted]);

  useEffect(() => {
    saveState(state, user?.username);
  }, [state]);

  // Desktop keeps the cursor in the input; touch screens use the hive so the
  // keyboard doesn't cover it (tapping the word still opens the keyboard).
  useEffect(() => {
    if (!isFinished && !showRules && finePointer()) inputRef.current?.focus();
  }, [isFinished, showRules]);

  useEffect(() => {
    if (isFinished) {
      if (rank.index >= 5) playHighScore();
      else playGameEnd();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished]);

  const showFeedbackMsg = useCallback((fb: Feedback, duration = 2600) => {
    setFeedback(fb);
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    feedbackTimeout.current = setTimeout(() => setFeedback(null), duration);
  }, []);

  // Misses are silent (just a shake, a buzz and a red pill); repeats get the soft blip.
  const reject = useCallback((message: string, sound?: () => void) => {
    if (sound) sound(); else buzz([20, 30, 20]);
    setShake(s => s + 1);
    showFeedbackMsg({ type: sound ? "neutral" : "wrong", message });
  }, [showFeedbackMsg]);

  const handleFinish = useCallback(async () => {
    if (!user?.username) return;
    setSubmitting(true);
    if (!IS_LOCAL) await submitDailyScore(user.username, "centrecircle", dateKey, state.score, state.found.length, answers.length);
    setState(prev => ({ ...prev, submitted: true }));
    setShowConfirm(false);
    setSubmitting(false);
    setShowEndScreen(true);
  }, [user?.username, dateKey, state.score, state.found.length, answers.length]);

  const submitWord = useCallback(() => {
    if (isFinished) return;
    const word = input;
    if (!word) return;
    setInput("");

    const stray = Array.from(word).find(ch => !board.letters.includes(ch));
    if (stray) return reject(`${stray.toUpperCase()} isn't one of today's letters`);
    const answer = answerByKey.get(word);
    if (!answer) return reject(`No PL player called ${word.charAt(0).toUpperCase()}${word.slice(1)}`);
    if (foundSet.has(word)) return reject(`${answerName(answer)} — already found`, playNeutral);

    const prevRank = getRank(state.score, maxScore);
    const newScore = state.score + answer.points;
    const nextRank = getRank(newScore, maxScore);
    setState(prev => ({ ...prev, score: prev.score + answer.points, found: [answer.key, ...prev.found] }));

    setFloatingPoints({ id: ++floatId.current, value: answer.points });
    setTimeout(() => setFloatingPoints(null), 1200);
    setPulse(p => p + 1);
    const popId = floatId.current;
    setPopped({ id: popId, word, gold: answer.pangram });
    setTimeout(() => setPopped(cur => (cur?.id === popId ? null : cur)), 700);
    const tags: string[] = [];
    if (answer.usesCentre) tags.push(`${board.centre.toUpperCase()} ×2`);
    if (answer.legend) tags.push("★ Legend ×2");
    setFlashColor(answer.pangram ? "bg-green-400" : "bg-emerald-500");
    setTimeout(() => setFlashColor(null), 300);

    const who = answer.players.length > 1
      ? `${answer.label} — ${answer.players.length} players`
      : answer.players[0].displayName;
    if (answer.pangram) {
      playHighScore();
      buzz([40, 30, 80]);
      setPangramHit(who);
      setTimeout(() => setPangramHit(null), 2400);
      showFeedbackMsg({ type: "pangram", message: who, points: answer.points, tags });
    } else {
      if (answer.key.length >= 8 || tags.length) playComboCorrect(Math.max(answer.key.length - 5, 3));
      else playCorrect();
      buzz(15);
      showFeedbackMsg({ type: "correct", message: `${who} · ${answer.club}`, points: answer.points, tags });
    }

    if (nextRank.index > prevRank.index) {
      setTimeout(() => {
        playBoostHit();
        setRankUp(nextRank.label);
        setTimeout(() => setRankUp(null), 1800);
      }, answer.pangram ? 2500 : 600);
    }
  }, [input, isFinished, board, answerByKey, foundSet, state.score, maxScore, reject, showFeedbackMsg]);

  const typeLetter = useCallback((ch: string) => {
    if (isFinished) return;
    buzz(6);
    setInput(v => (v + ch).slice(0, 24));
    if (finePointer()) inputRef.current?.focus();
  }, [isFinished]);

  const backspace = useCallback(() => {
    setInput(v => v.slice(0, -1));
    if (finePointer()) inputRef.current?.focus();
  }, []);

  const shuffleOuter = useCallback(() => {
    setOuter(prev => {
      const next = [...prev];
      // Keep shuffling until something moves
      for (let tries = 0; tries < 5 && next.join("") === prev.join(""); tries++) shuffleInPlace(next, Math.random);
      return next;
    });
    if (finePointer()) inputRef.current?.focus();
  }, []);

  // Typing anywhere on the page goes into the word, so a click on a button never
  // strands the keyboard.
  useEffect(() => {
    if (showRules || isFinished || showEndScreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target === inputRef.current || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); typeLetter(e.key.toLowerCase()); }
      else if (e.key === "Backspace") { e.preventDefault(); backspace(); }
      else if (e.key === "Enter" && !showConfirm) { e.preventDefault(); submitWord(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showRules, isFinished, showEndScreen, showConfirm, typeLetter, backspace, submitWord]);

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  };

  const header = (
    <div className="w-full flex items-center justify-between mb-4">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}
          className="text-muted-foreground hover:text-foreground">
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-xs font-semibold">
          <Calendar className="w-3 h-3" />DAILY
        </span>
        <span className="text-sm text-muted-foreground">{formatDate(dateKey)}</span>
      </div>
      {IS_LOCAL && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 whitespace-nowrap rounded-full border border-green-500/40 bg-background/90 px-3 py-1.5 text-xs shadow-lg">
          <span className="font-semibold text-green-300">Test build</span>
          <span className="text-muted-foreground">no leaderboard</span>
          <a href={`/centrecircle?day=${shiftDay(dateKey, -1)}`} className="px-2 py-0.5 rounded-full bg-muted/50 hover:bg-muted">← day</a>
          <a href={`/centrecircle?day=${shiftDay(dateKey, 1)}`} className="px-2 py-0.5 rounded-full bg-muted/50 hover:bg-muted">day →</a>
        </div>
      )}
    </div>
  );

  const glow = (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full blur-3xl bg-green-500/5" />
      <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full blur-3xl bg-emerald-500/5" />
    </div>
  );

  // --- End Screen ---
  if (showEndScreen) {
    return <EndScreen state={state} answers={answers} board={board} maxScore={maxScore}
      dateKey={dateKey} formatDate={formatDate} navigate={navigate} username={user?.username} />;
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
              <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">CentreCircle</span>
            </h1>
            <p className="text-sm text-muted-foreground mb-6">Daily PL surname spelling game</p>


            <div className="text-left space-y-3 mb-8">
              <RuleItem icon="⚽" text={`Spell the surname of any player with a Premier League appearance, using only today's ${board.letters.length} letters. Letters can be used more than once`} />
              <RuleItem icon="📏" text={`1 point per letter. One player's surname uses all ${board.letters.length} letters, worth ${board.letters.length} extra`} />
              <RuleItem icon="🟢" text={`Use the centre letter (${board.centre.toUpperCase()}) for double points`} />
              <RuleItem icon="★" text={`Legends double it again: anyone with ${LEGEND_APPS}+ PL apps or ${LEGEND_GOALS}+ PL goals`} />
              <RuleItem icon="🆓" text="Wrong guesses are free. Players who share a surname count as one answer" />
              <RuleItem icon="🏁" text="When you're done, tap Submit (the flag, next to the hints button) to post your score to the leaderboard" />
            </div>

            <Button className="w-full text-lg py-6 shadow-xl shadow-green-500/20 bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-green-950 font-bold"
              onClick={() => setShowRules(false)}>
              {state.found.length > 0 ? "Back to today's board" : "Play today's board"}
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  const centreUpper = board.centre.toUpperCase();
  const foundAnswers = state.found.map(k => answerByKey.get(k)).filter((a): a is Answer => !!a);

  // --- Playing Screen ---
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {glow}
      <ScreenFlash show={flashColor !== null} color={flashColor || "bg-green-400"} />

      <AnimatePresence>
        {showConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowConfirm(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-card border border-border rounded-xl p-6 max-w-sm w-full text-center"
              onClick={e => e.stopPropagation()}>
              <Flag className="w-8 h-8 text-green-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-2">Submit your score?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your score of <span className="font-bold text-foreground">{state.score}</span> will be submitted to the leaderboard.
                You won't be able to add more names today.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>Keep playing</Button>
                <Button className="flex-1 bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-green-950 font-bold"
                  onClick={handleFinish} disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col items-center w-full max-w-lg mx-auto px-4 pt-4 pb-8 flex-1">
        {header}

        {/* Title + score + found */}
        <div className="w-full grid grid-cols-3 items-center mb-3">
          <h1 className="text-xl font-bold tracking-tight whitespace-nowrap">
            <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">CentreCircle</span>
          </h1>
          <div className="relative flex flex-col items-center">
            <motion.div key={pulse} animate={pulse ? { scale: [1, 1.15, 1] } : {}} transition={{ duration: 0.3, ease: "easeOut" }}
              className="text-3xl font-black tabular-nums text-green-400">
              {state.score}
            </motion.div>
            <AnimatePresence>
              {floatingPoints && (
                <motion.div key={floatingPoints.id} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -30 }} exit={{ opacity: 0 }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="absolute -top-2 left-1/2 -translate-x-1/2 text-sm font-bold text-emerald-400 pointer-events-none whitespace-nowrap">
                  +{floatingPoints.value}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="text-right text-xs text-muted-foreground tabular-nums">{state.found.length} / {answers.length} found</div>
        </div>

        <RankBar score={state.score} maxScore={maxScore} />

        {/* Hive + overlays */}
        <div className="relative w-full flex justify-center mt-4 mb-1">
          <motion.div key={`hive-${pulse}`} animate={pulse ? { scale: [1, 1.03, 1] } : {}} transition={{ duration: 0.3 }}>
            <HiveBoard centre={board.centre} outer={outer} onLetter={typeLetter} celebrate={!!pangramHit} disabled={isFinished}
              scale={boardScale(outer.length)} />
          </motion.div>
          {pangramHit && <BeeBurst />}

          <AnimatePresence>
            {(pangramHit || rankUp) && (
              <motion.div key={pangramHit ? "pangram" : "rank"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-background/75 backdrop-blur-sm pointer-events-none">
                <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.05, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 250, damping: 18 }} className="text-center px-4">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                    {pangramHit ? `All ${board.letters.length} letters` : "Rank up"}
                  </div>
                  <div className="text-3xl font-black bg-gradient-to-r from-green-200 to-green-400 bg-clip-text text-transparent">
                    {pangramHit || rankUp}
                  </div>
                  {pangramHit && <div className="text-sm font-bold text-green-400 mt-1">+{board.letters.length} bonus</div>}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Current word — a transparent input over a coloured copy of the same text */}
        {isFinished ? (
          <button onClick={() => setShowEndScreen(true)}
            className="w-full mb-4 px-4 py-3 rounded-xl font-semibold text-base bg-gradient-to-r from-green-400 to-emerald-500 text-green-950 flex items-center justify-center gap-2">
            <Trophy className="w-5 h-5" /> View Results & Leaderboard
          </button>
        ) : (
          <motion.div key={shake} animate={shake ? { x: [0, -8, 8, -5, 5, 0] } : {}} transition={{ duration: 0.35 }}
            className="relative w-full h-14">
            <div aria-hidden className="absolute inset-0 flex items-center justify-center text-[28px] font-black uppercase tracking-[0.08em] pointer-events-none whitespace-pre">
              {input ? Array.from(input).map((ch, i) => (
                <span key={i} className={ch === board.centre ? "text-green-400" : board.letters.includes(ch) ? "text-foreground" : "text-muted-foreground/35"}>{ch}</span>
              )) : popped ? (
                // The word just scored lifts off letter by letter
                <span key={popped.id} className="inline-flex">
                  {Array.from(popped.word).map((ch, i) => (
                    <motion.span key={i} initial={{ y: 0, opacity: 1, scale: 1 }} animate={{ y: -22, opacity: 0, scale: 1.3 }}
                      transition={{ duration: 0.45, delay: i * 0.025, ease: "easeOut" }}
                      className={popped.gold ? "text-green-300" : "text-emerald-300"}>{ch}</motion.span>
                  ))}
                </span>
              ) : <span className="text-base font-medium normal-case tracking-normal text-muted-foreground/40">Type or tap a surname</span>}
            </div>
            {/* Read-only on phones: letters come from the board, so the keyboard never pops up over it */}
            <input ref={inputRef} value={input} aria-label="Surname" readOnly={!finePointer()}
              onChange={e => setInput(e.target.value.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "").slice(0, 24))}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitWord(); } }}
              autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
              className="absolute inset-0 w-full bg-transparent text-center text-[28px] font-black uppercase tracking-[0.08em] text-transparent caret-green-300 outline-none" />
          </motion.div>
        )}

        {/* Feedback */}
        <div className="w-full h-9 mb-1 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {feedback && (
              <motion.div key={feedback.message} initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}
                className={`max-w-full inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium truncate ${
                  feedback.type === "pangram" ? "bg-green-300 text-green-950"
                  : feedback.type === "correct" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : feedback.type === "wrong" ? "bg-red-500/15 text-red-300 border border-red-500/30"
                  : "bg-muted/60 text-muted-foreground border border-border"}`}>
                <span className="truncate">{feedback.message}</span>
                {feedback.tags?.map(t => (
                  <motion.span key={t} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18, delay: 0.12 }}
                    className={`shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                      feedback.type === "pangram" ? "bg-green-950/15" : "bg-green-400/20 text-green-300"}`}>{t}</motion.span>
                ))}
                {feedback.points !== undefined && <span className="shrink-0 font-bold tabular-nums">+{feedback.points}</span>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls */}
        {!isFinished && (
          <div className="flex items-center justify-center gap-3 mb-5">
            <button type="button" onClick={backspace} aria-label="Delete letter"
              className="h-11 px-4 rounded-full border border-border bg-card/60 text-muted-foreground hover:text-foreground active:scale-95 transition">
              <Delete className="w-5 h-5" />
            </button>
            <button type="button" onClick={shuffleOuter} aria-label="Shuffle letters"
              className="h-11 w-11 rounded-full border border-border bg-card/60 text-muted-foreground hover:text-foreground active:scale-95 transition flex items-center justify-center">
              <Shuffle className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => setShowTracker(v => !v)} aria-pressed={showTracker}
              aria-label="Hints" title="Tracker — what's left to find"
              className={`h-11 w-11 rounded-full border active:scale-95 transition flex items-center justify-center ${showTracker
                ? "bg-green-500/15 border-green-500/40 text-green-300"
                : "border-border bg-card/60 text-muted-foreground hover:text-foreground"}`}>
              <ListChecks className="w-5 h-5" />
            </button>
            <button type="button" onClick={submitWord}
              className="h-11 px-6 rounded-full border border-green-500/40 bg-green-500/15 text-green-300 font-semibold hover:bg-green-500/25 active:scale-95 transition">
              Enter
            </button>
          </div>
        )}

        {/* Found header + tracker / submit */}
        <div className="w-full flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Found <span className="tabular-nums">{state.found.length}</span>
            <span className="font-normal"> · {centreUpper} scores double</span>
          </h3>
          {!isFinished && (
            <div className="flex items-center gap-1.5">
              {state.found.length > 0 && (
                <button type="button" onClick={() => setShowConfirm(true)} title="I'm done — submit score"
                  className="h-[34px] px-2.5 inline-flex items-center gap-1.5 rounded-lg bg-card/80 border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-green-500/50 transition-colors">
                  <Flag className="w-4 h-4" /> Submit
                </button>
              )}
            </div>
          )}
        </div>

        <AnimatePresence initial={false}>
          {showTracker && !isFinished && (
            <motion.div key="tracker" className="w-full overflow-hidden"
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}>
              <Tracker board={board} answers={answers} found={foundSet} />
            </motion.div>
          )}
        </AnimatePresence>

        {foundAnswers.length > 0 ? (
          <div className="w-full flex flex-wrap gap-1.5">
            {foundAnswers.map((a, i) => (
              <motion.div key={a.key} layout
                initial={i === 0 ? { opacity: 0, scale: 0.6, y: -6 } : false}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 22 }}
                title={a.players.map(p => p.displayName).join(", ")}
                className="px-2.5 py-1.5 rounded-lg border text-sm leading-tight bg-card/50 border-border text-foreground">
                <span className="font-medium">{answerName(a)}</span>
                {a.pangram && <span title="The star player" className="ml-1 inline-flex align-[-1px]"><Trophy className="w-3 h-3 text-sky-300" /></span>}
                {a.legend && <span className="ml-1 text-[11px] text-amber-300" title="Legend bonus">★</span>}
                <span className="ml-1.5 text-[11px] text-muted-foreground">{a.club}</span>
                <span className="ml-1.5 text-[11px] font-bold tabular-nums text-green-400/80">+{a.points}</span>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="w-full text-center py-6 text-muted-foreground">
            <p className="text-sm">{answers.length} surnames hide in today's letters</p>
            <p className="text-xs mt-2 opacity-60">Names with {centreUpper} score double, legends double again. One player's uses all {board.letters.length} letters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Grow the board to fill a phone's width (it is small at 8 letters), capped so it
// doesn't balloon on desktop.
function boardScale(count: number) {
  const width = Math.min(typeof window === "undefined" ? 512 : window.innerWidth, 512) - 32;
  return Math.min(1.4, Math.max(1, width / ringLayout(count).size));
}

// Each letter's tap target is a circle a little wider than its hex; the gaps
// between hexes leave room for that without neighbours overlapping.
const TAP_PAD = 4;

function HiveBoard({ centre, outer, onLetter, celebrate = false, disabled = false, scale = 1 }: {
  centre: string;
  outer: string[];
  onLetter: (ch: string) => void;
  celebrate?: boolean;
  disabled?: boolean;
  scale?: number;
}) {
  const { size, slots } = ringLayout(outer.length);
  const hexes = [
    { ch: centre, isCentre: true, w: CENTRE_W, x: size / 2 - CENTRE_W / 2, y: size / 2 - (CENTRE_W * 0.866) / 2 },
    ...outer.map((ch, i) => ({ ch, isCentre: false, w: HEX_W, x: slots[i].x, y: slots[i].y })),
  ];
  return (
    <div className="relative" style={{ width: size * scale, height: size * scale }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: size, height: size, transform: `scale(${scale})` }}>
        {hexes.map(({ ch, isCentre, w, x, y }, i) => (
          <motion.button key={ch} type="button" disabled={disabled} onClick={() => onLetter(ch)}
            aria-label={`Letter ${ch.toUpperCase()}${isCentre ? ", centre" : ""}`}
            initial={{ x: size / 2 - w / 2 - TAP_PAD, y: size / 2 - w / 2 - TAP_PAD, opacity: 0, scale: 0.4 }}
            animate={celebrate
              ? { x: x - TAP_PAD, y: y - (w * 0.134) / 2 - TAP_PAD, opacity: 1, scale: [1, 1.14, 1], rotate: [0, 10, -10, 0], transition: { duration: 0.6, delay: i * 0.05 } }
              : { x: x - TAP_PAD, y: y - (w * 0.134) / 2 - TAP_PAD, opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            whileTap={{ scale: 0.86, filter: "brightness(1.7)" }}
            style={{ width: w + 2 * TAP_PAD, height: w + 2 * TAP_PAD, position: "absolute", left: 0, top: 0, WebkitTapHighlightColor: "transparent" }}
            className="group rounded-full flex items-center justify-center select-none touch-manipulation outline-none">
            <span style={{ width: w, height: w * 0.866, clipPath: HEX_CLIP }}
              className={`flex items-center justify-center font-black uppercase transition-colors ${
                isCentre
                  ? "text-3xl bg-gradient-to-br from-lime-300 to-green-500 text-green-950"
                  : "text-2xl bg-white/[0.09] text-foreground group-hover:bg-white/[0.15] group-active:bg-green-400/25"}`}>
              {ch}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// A one-off burst of footballs from the centre of the board.
const BEES = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * 2 * Math.PI + (i % 2) * 0.2;
  const d = 120 + (i % 3) * 40;
  return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: (i % 2 ? 1 : -1) * (20 + i * 7), size: 16 + (i % 4) * 5, delay: (i % 5) * 0.04 };
});

function BeeBurst() {
  return (
    <div className="absolute left-1/2 top-1/2 z-30 pointer-events-none">
      {BEES.map((b, i) => (
        <motion.span key={i} className="absolute select-none" style={{ fontSize: b.size, left: -b.size / 2, top: -b.size / 2 }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.3, rotate: 0 }}
          animate={{ x: b.x, y: b.y, opacity: [0, 1, 1, 0], scale: [0.3, 1.1, 1, 0.8], rotate: b.r }}
          transition={{ duration: 1.4, delay: b.delay, ease: "easeOut" }}>
          ⚽
        </motion.span>
      ))}
    </div>
  );
}

function RankBar({ score, maxScore }: { score: number; maxScore: number }) {
  const rank = getRank(score, maxScore);
  const steps = RANKS.length - 1;
  // Ranks sit evenly along the bar; the fill runs to the current rank plus progress to the next.
  const from = RANKS[rank.index].pct * maxScore;
  const within = rank.next ? (score - from) / (rank.next.pct * maxScore - from) : 0;
  const fill = Math.min(1, (rank.index + Math.max(0, Math.min(1, within))) / steps);
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-1.5">
        <motion.span key={rank.label} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className="text-sm font-bold text-green-300">{rank.label}</motion.span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {rank.next ? `${rank.toNext} to ${rank.next.label}` : `${maxScore} pts · perfect`}
        </span>
      </div>
      <div className="relative h-2 mx-1">
        <div className="absolute inset-0 rounded-full bg-muted/30" />
        <motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-green-600 to-green-400"
          initial={false} animate={{ width: `${fill * 100}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
        {RANKS.map((r, i) => (
          <div key={r.label} title={`${r.label} · ${Math.ceil(r.pct * maxScore)} pts`}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-colors ${
              i <= rank.index ? "bg-green-300 border-green-500" : "bg-background border-border"} ${i === steps ? "w-3 h-3" : "w-2 h-2"}`}
            style={{ left: `${(i / steps) * 100}%` }} />
        ))}
      </div>
    </div>
  );
}

// Length columns for the hints grid: ≤3, 4 … 9, 10+
const LENGTH_COLS = [3, 4, 5, 6, 7, 8, 9, 10];
const lengthCol = (n: number) => Math.min(Math.max(n, 3), 10) - 3;
const lengthLabel = (n: number) => (n === 3 ? "≤3" : n === 10 ? "10+" : String(n));

interface HintCount { total: number; found: number; legends: number; legendsFound: number; pangram: boolean; pangramFound: boolean }
const emptyCount = (): HintCount => ({ total: 0, found: 0, legends: 0, legendsFound: 0, pangram: false, pangramFound: false });

function addTo(c: HintCount, a: Answer, got: boolean) {
  c.total++;
  if (got) c.found++;
  if (a.legend) { c.legends++; if (got) c.legendsFound++; }
  if (a.pangram) { c.pangram = true; if (got) c.pangramFound = true; }
}

// NYT-style hints: answers by first letter and length, then by first two letters
// (split into answers that use the centre letter and those that don't).
function Tracker({ board, answers, found }: { board: Board; answers: Answer[]; found: Set<string> }) {
  const { rows, all, pairs } = useMemo(() => {
    const rowMap = new Map<string, HintCount[]>();
    const all = emptyCount();
    const pairMap = new Map<string, HintCount>();
    for (const a of answers) {
      const got = found.has(a.key);
      const first = a.key[0];
      let cells = rowMap.get(first);
      if (!cells) { cells = LENGTH_COLS.map(emptyCount); rowMap.set(first, cells); }
      addTo(cells[lengthCol(a.key.length)], a, got);
      addTo(all, a, got);
      const pair = a.key.slice(0, 2);
      if (!pairMap.has(pair)) pairMap.set(pair, emptyCount());
      addTo(pairMap.get(pair)!, a, got);
    }
    const rows = Array.from(rowMap.entries()).sort((x, y) => x[0].localeCompare(y[0]));
    const pairs = Array.from(pairMap.entries()).sort((x, y) => x[0].localeCompare(y[0]));
    return { rows, all, pairs };
  }, [answers, found]);

  const pairGroups = rows.map(([letter]) => [letter, pairs.filter(([p]) => p[0] === letter)] as const);

  return (
    <div className="w-full mb-3 rounded-xl border border-border bg-card/40 p-3 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Hints</span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          <span className="text-amber-300">★</span> {all.legendsFound}/{all.legends} legends found
        </span>
      </div>

      <table className="w-full table-fixed border-separate border-spacing-[2px] text-center tabular-nums">
        <thead>
          <tr className="text-[10px] text-muted-foreground">
            <th className="w-5" />
            {LENGTH_COLS.map(n => <th key={n} className="font-medium pb-0.5">{lengthLabel(n)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(([letter, cells]) => (
            <tr key={letter}>
              <th className={`text-sm font-black uppercase ${letter === board.centre ? "text-green-300" : "text-foreground"}`}>{letter}</th>
              {cells.map((c, i) => <HintCell key={i} c={c} />)}
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Starts with</div>
        <div className="space-y-1">
          {pairGroups.map(([letter, group]) => (
            <div key={letter} className="flex flex-wrap gap-1">
              {group.map(([pair, c]) => {
                const done = c.found === c.total;
                return (
                  <span key={pair} className={`inline-flex items-center gap-1 text-[11px] tabular-nums px-1.5 py-0.5 rounded-md border transition-colors ${
                    done ? "border-green-500 bg-green-600 text-white" : "border-border/60 bg-background/40 text-foreground"}`}>
                    <span className="font-bold uppercase">{pair}</span>
                    {done ? "✓" : <span>{c.found}<span className="text-muted-foreground">/{c.total}</span></span>}
                    {c.legends > 0 && (
                      <span className="text-[9px] tracking-tighter">
                        {Array.from({ length: c.legends }, (_, i) => (
                          <span key={i} className={done || i < c.legendsFound ? "text-amber-300" : "text-muted-foreground/60"}>★</span>
                        ))}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Trophy className="w-3 h-3 text-sky-300" />
          the star player: their surname uses every letter
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="text-amber-300">★</span>
          legend: {LEGEND_APPS}+ PL apps or {LEGEND_GOALS}+ PL goals · double points
        </span>
      </div>
    </div>
  );
}

// One hints-grid cell: fills from the bottom as its answers are found, ticked when
// done, with a star per legend in the corner that lights up once found.
function HintCell({ c }: { c: HintCount }) {
  if (c.total === 0) {
    return <td className="h-8 rounded text-[10px] text-muted-foreground/25">·</td>;
  }
  const done = c.found === c.total;
  const fill = c.found === 0 ? 0 : Math.max(c.found / c.total, 0.08);
  return (
    <td className={`relative h-8 p-0 rounded overflow-hidden border ${
      done ? "border-green-500" : "border-border/50"} bg-background/40`}>
      <div className={`absolute inset-x-0 bottom-0 transition-[height] duration-500 ease-out ${done ? "bg-green-600" : "bg-green-700/70"}`}
        style={{ height: `${fill * 100}%` }} />
      {c.pangram && (
        <Trophy className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 ${c.pangramFound ? "text-sky-300" : "text-muted-foreground/60"}`} />
      )}
      {c.legends > 0 && (
        <span className="absolute top-0 right-0.5 text-[7px] leading-none tracking-tighter">
          {c.legends <= 3
            ? Array.from({ length: c.legends }, (_, i) => (
                <span key={i} className={i < c.legendsFound ? "text-amber-300" : "text-muted-foreground/40"}>★</span>))
            : <span className={c.legendsFound === c.legends ? "text-amber-300" : "text-muted-foreground"}>★{c.legendsFound}/{c.legends}</span>}
        </span>
      )}
      <span className={`relative text-[10px] leading-none font-semibold ${
        done ? "text-white" : c.found ? "text-foreground" : "text-muted-foreground"}`}>
        {done ? "✓" : <>{c.found}<span className="opacity-60">/{c.total}</span></>}
      </span>
    </td>
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

// --- End Screen Component ---
function EndScreen({ state, answers, board, maxScore, dateKey, formatDate, navigate, username }: {
  state: HiveState;
  answers: Answer[];
  board: Board;
  maxScore: number;
  dateKey: string;
  formatDate: (d: string) => string;
  navigate: (to: string) => void;
  username?: string;
}) {
  const rank = getRank(state.score, maxScore);
  const found = useMemo(() => new Set(state.found), [state.found]);
  // Pangram first, then the best-known players
  const missed = useMemo(
    () => answers.filter(a => !found.has(a.key)).sort((a, b) => Number(b.pangram) - Number(a.pangram)),
    [answers, found],
  );
  const [lbPeriod, setLbPeriod] = useState<DailyPeriod>("today");
  const { entries, loading } = useDailyLeaderboard("centrecircle", lbPeriod, 10, 1000);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full blur-3xl bg-green-500/5" />
        <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full blur-3xl bg-emerald-500/5" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-lg mx-auto px-4 pt-4 pb-8 flex-1">
        <div className="w-full flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            <Home className="w-4 h-4 mr-1" /> Home
          </Button>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-xs font-semibold">
              <Calendar className="w-3 h-3" />DAILY
            </span>
            <span className="text-sm text-muted-foreground">{formatDate(dateKey)}</span>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">CentreCircle</span>
            <span className="text-muted-foreground text-lg ml-2">— Complete</span>
          </h1>
          <div className="text-5xl font-black tabular-nums text-green-400">{state.score}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {state.found.length} of {answers.length} surnames · letters {board.letters.map(l => l === board.centre ? `[${l.toUpperCase()}]` : l.toUpperCase()).join(" ")}
          </div>
          <span className="inline-block mt-2 text-sm font-bold px-3 py-1 rounded-full border bg-green-500/10 border-green-400/30 text-green-300">
            {rank.label}
          </span>
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
            currentUser={username} accentBg="bg-green-500/10 border-green-500/30" scoreLabel="Score" mini max={10} />
        </motion.div>

        {missed.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="w-full mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">The {missed.length} you missed</h3>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {missed.map(a => (
                <div key={a.key} className="flex items-center justify-between px-3 py-2 rounded-lg border text-sm bg-card/50 border-border">
                  <div className="flex-1 min-w-0 truncate">
                    <span className="font-medium text-foreground">{answerName(a)}</span>
                    {a.pangram && <span className="ml-1 inline-flex align-[-1px]"><Trophy className="w-3 h-3 text-sky-300" /></span>}
                    {a.legend && <span className="ml-1 text-xs text-amber-300">★</span>}
                    <span className="text-xs text-muted-foreground ml-1.5">
                      {a.club} · {a.players[0].totalAppearances} apps
                    </span>
                  </div>
                  <span className="font-bold tabular-nums text-muted-foreground ml-2">+{a.points}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
          className="w-full text-center py-4 text-muted-foreground">
          <p className="text-sm">Come back tomorrow for new letters!</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/")}>
            <Home className="w-4 h-4 mr-1.5" /> Back to games
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
