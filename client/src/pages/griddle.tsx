import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import plPlayers from "@/data/pl-players.json";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Home, Flag, Trophy, ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { playCorrect, playWrong, playNeutral, playHighScore, playGameEnd } from "@/lib/sounds";
import { gameThemes } from "@/lib/game-themes";
import { normalizeName, getCommonSurname, PL_MONONYMS, PL_ALTERNATES, PL_PRIORITY_MONONYMS } from "@/lib/normalize";
import type { PLPlayer } from "@/data/pl-player-types";
import { ScreenFlash } from "@/components/screen-flash";
import { useUser } from "@/lib/user-context";
import { submitDailyScore, hasDailySubmission } from "@/lib/daily-score";
import { useDailyLeaderboard, type DailyPeriod } from "@/lib/use-daily-leaderboard";
import { LeaderboardTable } from "@/components/leaderboard-table";

const theme = gameThemes.overlap;

// Board version — bump to regenerate all daily boards
const BOARD_VERSION = 2;

// --- Top 25 PL clubs by total appearances ---
const ELIGIBLE_CLUBS = [
  "Chelsea", "Arsenal", "Man Utd", "Liverpool", "Tottenham",
  "Everton", "Newcastle", "Aston Villa", "West Ham", "Man City",
  "Southampton", "Fulham", "Leicester", "Blackburn", "Crystal Palace",
  "Sunderland", "Leeds", "Middlesbrough", "West Brom", "Bolton",
  "Wolves", "Norwich", "Stoke", "Burnley", "Brighton",
];

const BIG_SIX = new Set(["Arsenal", "Chelsea", "Liverpool", "Tottenham", "Man Utd", "Man City"]);

// --- Progress tiers (% of total valid answers) ---
const TIERS = [
  { pct: 0.01, label: "Kickoff",       color: "text-white/70",    bg: "bg-white/10 border-white/20" },
  { pct: 0.02, label: "Squad Player",  color: "text-blue-300",    bg: "bg-blue-500/10 border-blue-400/20" },
  { pct: 0.04, label: "Sub",           color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-400/20" },
  { pct: 0.08, label: "First Team",    color: "text-teal-400",    bg: "bg-teal-500/10 border-teal-400/20" },
  { pct: 0.15, label: "Key Player",    color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-400/20" },
  { pct: 0.25, label: "Captain",       color: "text-green-400",   bg: "bg-green-500/10 border-green-400/20" },
  { pct: 0.35, label: "Legend",         color: "text-lime-400",    bg: "bg-lime-500/10 border-lime-400/20" },
  { pct: 0.50, label: "Encyclopaedia", color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-400/20" },
];

function getCurrentTier(found: number, total: number) {
  const pct = total > 0 ? found / total : 0;
  let current = null;
  let nextTier = TIERS[0];
  for (let i = 0; i < TIERS.length; i++) {
    if (pct >= TIERS[i].pct) {
      current = TIERS[i];
      nextTier = TIERS[i + 1] || null;
    }
  }
  return { current, nextTier, pct };
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

// --- Board generation ---
function getValidAnswers(boardClubs: string[]): PLPlayer[] {
  const boardSet = new Set(boardClubs);
  return (plPlayers as PLPlayer[]).filter(p => {
    const matched = Object.keys(p.clubs).filter(c => boardSet.has(c));
    return matched.length >= 2;
  });
}

function generateBoard(dateStr: string): string[] {
  let seed = hashString(`${dateStr}-v${BOARD_VERSION}`);
  for (let attempt = 0; attempt < 100; attempt++) {
    const rng = mulberry32(seed + attempt);
    const shuffled = [...ELIGIBLE_CLUBS];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const board = shuffled.slice(0, 9);
    const bigSixCount = board.filter(c => BIG_SIX.has(c)).length;
    if (bigSixCount < 2) continue;
    const valid = getValidAnswers(board);
    if (valid.length >= 25) return board;
  }
  return ELIGIBLE_CLUBS.slice(0, 9);
}

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// --- Player lookup ---
function buildPlayerLookup(): Map<string, PLPlayer[]> {
  const lookup = new Map<string, PLPlayer[]>();

  function addToLookup(key: string, player: PLPlayer) {
    const norm = normalizeName(key);
    if (!norm) return;
    const existing = lookup.get(norm);
    if (existing) {
      if (!existing.some(p => p.displayName === player.displayName)) {
        existing.push(player);
      }
    } else {
      lookup.set(norm, [player]);
    }
  }

  for (const p of plPlayers as PLPlayer[]) {
    addToLookup(p.lastName, p);
    const commonSurname = getCommonSurname(p);
    if (commonSurname !== p.lastName) addToLookup(commonSurname, p);
    addToLookup(p.displayName, p);
  }

  for (const [mono, targetKey] of Object.entries(PL_MONONYMS)) {
    const target = lookup.get(targetKey);
    if (!target) continue;
    const existing = lookup.get(mono);
    if (!existing) {
      lookup.set(mono, [...target]);
    } else {
      for (const p of target) {
        if (!existing.some(e => e.displayName === p.displayName)) existing.push(p);
      }
    }
  }

  for (const [alt, official] of Object.entries(PL_ALTERNATES)) {
    const target = lookup.get(official);
    if (target && !lookup.has(alt)) lookup.set(alt, target);
  }

  for (const [key, displayName] of Object.entries(PL_PRIORITY_MONONYMS)) {
    const candidates = lookup.get(key);
    if (candidates) {
      candidates.sort((a, b) => (a.displayName === displayName ? -1 : b.displayName === displayName ? 1 : 0));
    }
  }

  return lookup;
}

// --- Grid adjacency & spatial bonuses ---
const GRID_ROWS = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];
const GRID_COLS = [[0, 3, 6], [1, 4, 7], [2, 5, 8]];
const GRID_DIAGS = [[0, 4, 8], [2, 4, 6]];

const ADJACENCY: number[][] = [
  [1, 3], [0, 2, 4], [1, 5],
  [0, 4, 6], [1, 3, 5, 7], [2, 4, 8],
  [3, 7], [4, 6, 8], [5, 7],
];

function areAllAdjacent(indices: Set<number>): boolean {
  if (indices.size <= 1) return true;
  const arr = Array.from(indices);
  const visited = new Set<number>();
  const queue = [arr[0]];
  visited.add(arr[0]);
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const neighbor of ADJACENCY[curr]) {
      if (indices.has(neighbor) && !visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return visited.size === indices.size;
}

// --- Scoring ---
function getBasePoints(matchCount: number): number {
  if (matchCount >= 6) return 50;
  if (matchCount === 5) return 35;
  if (matchCount === 4) return 22;
  if (matchCount === 3) return 12;
  return 5;
}

interface ScoreResult {
  basePoints: number;
  multiplier: number;
  multiplierLabel: string | null;
  total: number;
  matchedClubs: string[];
  triggeredAllCovered: boolean;
}

function scoreAnswer(
  player: PLPlayer,
  boardClubs: string[],
  coveredClubs: Set<string>,
  allCoveredAwarded: boolean,
): ScoreResult {
  const boardSet = new Set(boardClubs);
  const matchedClubs = Object.keys(player.clubs).filter(c => boardSet.has(c));
  const matchedIndices = new Set(matchedClubs.map(c => boardClubs.indexOf(c)));
  const basePoints = getBasePoints(matchedClubs.length);

  let multiplier = 1;
  let multiplierLabel: string | null = null;

  for (let r = 0; r < GRID_ROWS.length; r++) {
    if (GRID_ROWS[r].every(i => matchedIndices.has(i))) {
      multiplier = 5;
      multiplierLabel = `Row ${r + 1} 5x`;
      break;
    }
  }
  if (multiplier < 5) {
    for (let c = 0; c < GRID_COLS.length; c++) {
      if (GRID_COLS[c].every(i => matchedIndices.has(i))) {
        multiplier = 5;
        multiplierLabel = `Col ${c + 1} 5x`;
        break;
      }
    }
  }
  if (multiplier < 5) {
    for (let d = 0; d < GRID_DIAGS.length; d++) {
      if (GRID_DIAGS[d].every(i => matchedIndices.has(i))) {
        multiplier = 5;
        multiplierLabel = d === 0 ? "Diag ↘ 5x" : "Diag ↗ 5x";
        break;
      }
    }
  }
  if (multiplier < 2 && matchedClubs.length >= 2 && areAllAdjacent(matchedIndices)) {
    multiplier = 2;
    multiplierLabel = "Adjacent 2x";
  }

  const total = basePoints * multiplier;
  const newCovered = new Set(coveredClubs);
  for (const c of matchedClubs) newCovered.add(c);
  const triggeredAllCovered = !allCoveredAwarded && newCovered.size === 9;

  return { basePoints, multiplier, multiplierLabel, total, matchedClubs, triggeredAllCovered };
}

// --- Get top missed players for end screen ---
function getTopMissed(boardClubs: string[], foundNames: Set<string>, limit: number) {
  const boardSet = new Set(boardClubs);
  const missed: { player: PLPlayer; clubs: string[]; score: number }[] = [];

  for (const p of plPlayers as PLPlayer[]) {
    if (foundNames.has(p.displayName)) continue;
    const matchedClubs = Object.keys(p.clubs).filter(c => boardSet.has(c));
    if (matchedClubs.length < 2) continue;
    const matchedIndices = new Set(matchedClubs.map(c => boardClubs.indexOf(c)));
    const base = getBasePoints(matchedClubs.length);
    let mult = 1;
    for (const line of [...GRID_ROWS, ...GRID_COLS, ...GRID_DIAGS]) {
      if (line.every(i => matchedIndices.has(i))) { mult = 5; break; }
    }
    if (mult < 2 && areAllAdjacent(matchedIndices)) mult = 2;
    missed.push({ player: p, clubs: matchedClubs, score: base * mult });
  }

  missed.sort((a, b) => b.score - a.score || b.clubs.length - a.clubs.length);
  return missed.slice(0, limit);
}

// --- Daily state persistence ---
interface FoundPlayer {
  displayName: string;
  matchedClubs: string[];
  points: number;
  bonuses: string[];
}

interface GriddleState {
  dateKey: string;
  boardHash: string;
  score: number;
  foundPlayers: FoundPlayer[];
  coveredClubs: string[];
  clubHits: Record<string, number>;
  allCoveredAwarded: boolean;
  submitted: boolean;
}

function makeBoardHash(clubs: string[]): string {
  return clubs.join(",");
}

const ALL_COVERED_BONUS = 25;

function loadState(dateKey: string, clubs: string[]): GriddleState {
  const hash = makeBoardHash(clubs);
  try {
    const raw = localStorage.getItem(`griddle-${dateKey}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.dateKey === dateKey && parsed.boardHash === hash) {
        return { ...parsed, clubHits: parsed.clubHits || {}, submitted: parsed.submitted || false };
      }
    }
  } catch { /* ignore */ }
  return {
    dateKey,
    boardHash: hash,
    score: 0,
    foundPlayers: [],
    coveredClubs: [],
    clubHits: {},
    allCoveredAwarded: false,
    submitted: false,
  };
}

function saveState(state: GriddleState) {
  try {
    localStorage.setItem(`griddle-${state.dateKey}`, JSON.stringify(state));
  } catch { /* ignore */ }
}

// --- Feedback types ---
type FeedbackType = "correct" | "wrong" | "neutral" | "duplicate" | "ambiguous" | "bonus" | null;

interface Feedback {
  type: FeedbackType;
  message: string;
  points?: number;
  bonuses?: string[];
}

// --- Hit count dot/number color (white → blue → green → yellow at 20+) ---
function getHitIndicatorColor(hits: number): string {
  if (hits >= 20) return "text-yellow-400";
  if (hits >= 16) return "text-amber-400";
  if (hits >= 13) return "text-lime-400";
  if (hits >= 10) return "text-green-400";
  if (hits >= 8) return "text-emerald-400";
  if (hits >= 6) return "text-teal-400";
  if (hits >= 4) return "text-cyan-400";
  if (hits >= 3) return "text-blue-400";
  if (hits >= 2) return "text-blue-300";
  return "text-white/70";
}

function getHitDotBg(hits: number): string {
  if (hits >= 20) return "bg-yellow-400";
  if (hits >= 16) return "bg-amber-400";
  if (hits >= 13) return "bg-lime-400";
  if (hits >= 10) return "bg-green-400";
  if (hits >= 8) return "bg-emerald-400";
  if (hits >= 6) return "bg-teal-400";
  if (hits >= 4) return "bg-cyan-400";
  if (hits >= 3) return "bg-blue-400";
  if (hits >= 2) return "bg-blue-300";
  return "bg-white/70";
}

// --- Component ---
export default function Griddle() {
  const [, navigate] = useLocation();
  const { user } = useUser();
  const dateKey = useMemo(() => getTodayStr(), []);
  const boardClubs = useMemo(() => generateBoard(dateKey), [dateKey]);
  const playerLookup = useMemo(() => buildPlayerLookup(), []);
  const totalValid = useMemo(() => getValidAnswers(boardClubs).length, [boardClubs]);

  const [state, setState] = useState<GriddleState>(() => loadState(dateKey, boardClubs));
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const [highlightClubs, setHighlightClubs] = useState<Set<string>>(new Set());
  const [showCoverBonus, setShowCoverBonus] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showRules, setShowRules] = useState(() => {
    // Skip rules if they already have progress or submitted
    const s = loadState(dateKey, boardClubs);
    return s.foundPlayers.length === 0 && !s.submitted;
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout>>();
  const checkedRemote = useRef(false);

  const isFinished = state.submitted;

  // Check for remote submission on load (cross-device)
  useEffect(() => {
    if (checkedRemote.current || !user?.username || state.submitted) return;
    checkedRemote.current = true;
    hasDailySubmission(user.username, "griddle", dateKey).then(result => {
      if (result.submitted && !state.submitted) {
        setState(prev => ({ ...prev, submitted: true, score: result.score }));
      }
    });
  }, [user?.username, dateKey, state.submitted]);

  // Persist state on change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Auto-focus input
  useEffect(() => {
    if (!isFinished) inputRef.current?.focus();
  }, [isFinished]);

  // Play sound on finish
  useEffect(() => {
    if (isFinished) {
      const tier = getCurrentTier(state.foundPlayers.length, totalValid);
      if (tier.current && TIERS.indexOf(tier.current) >= 5) {
        playHighScore();
      } else {
        playGameEnd();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished]);

  const coveredSet = useMemo(() => new Set(state.coveredClubs), [state.coveredClubs]);
  const tierInfo = useMemo(() => getCurrentTier(state.foundPlayers.length, totalValid), [state.foundPlayers.length, totalValid]);

  const showFeedbackMsg = useCallback((fb: Feedback, duration = 3000) => {
    setFeedback(fb);
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    feedbackTimeout.current = setTimeout(() => setFeedback(null), duration);
  }, []);

  const handleFinish = useCallback(async () => {
    if (!user?.username) return;
    setSubmitting(true);
    await submitDailyScore(
      user.username,
      "griddle",
      dateKey,
      state.score,
      state.foundPlayers.length,
      totalValid,
    );
    setState(prev => ({ ...prev, submitted: true }));
    setShowConfirm(false);
    setSubmitting(false);
  }, [user?.username, dateKey, state.score, state.foundPlayers.length, totalValid]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (isFinished) return;
    const raw = input.trim();
    if (!raw) return;
    setInput("");

    const norm = normalizeName(raw);
    if (!norm) {
      playWrong();
      setFlashColor("bg-red-500");
      setTimeout(() => setFlashColor(null), 300);
      showFeedbackMsg({ type: "wrong", message: "Invalid input", points: -1 });
      setState(prev => ({ ...prev, score: Math.max(0, prev.score - 1) }));
      return;
    }

    const candidates = playerLookup.get(norm);
    if (!candidates || candidates.length === 0) {
      playWrong();
      setFlashColor("bg-red-500");
      setTimeout(() => setFlashColor(null), 300);
      showFeedbackMsg({ type: "wrong", message: "Player not found", points: -1 });
      setState(prev => ({ ...prev, score: Math.max(0, prev.score - 1) }));
      return;
    }

    const boardSet = new Set(boardClubs);
    const validCandidates = candidates.filter(p => {
      const matched = Object.keys(p.clubs).filter(c => boardSet.has(c));
      return matched.length >= 2;
    });

    if (validCandidates.length === 0) {
      const playerName = candidates[0].displayName;
      const matchCount = Object.keys(candidates[0].clubs).filter(c => boardSet.has(c)).length;
      if (matchCount === 1) {
        playNeutral();
        showFeedbackMsg({ type: "neutral", message: `${playerName} only played for 1 club on the board` });
      } else {
        playWrong();
        setFlashColor("bg-red-500");
        setTimeout(() => setFlashColor(null), 300);
        showFeedbackMsg({ type: "wrong", message: `${playerName} didn't play for any clubs on the board`, points: -1 });
        setState(prev => ({ ...prev, score: Math.max(0, prev.score - 1) }));
      }
      return;
    }

    let player = validCandidates[0];
    if (validCandidates.length > 1) {
      const notFound = validCandidates.filter(
        p => !state.foundPlayers.some(fp => fp.displayName === p.displayName)
      );
      if (notFound.length === 0) {
        playNeutral();
        showFeedbackMsg({ type: "duplicate", message: "Already found" });
        return;
      }
      if (notFound.length > 1) {
        playNeutral();
        showFeedbackMsg({ type: "ambiguous", message: `Multiple matches: ${notFound.map(p => p.displayName).join(", ")}. Be more specific.` });
        return;
      }
      player = notFound[0];
    }

    if (state.foundPlayers.some(fp => fp.displayName === player.displayName)) {
      playNeutral();
      showFeedbackMsg({ type: "duplicate", message: `${player.displayName} — already found` });
      return;
    }

    const result = scoreAnswer(player, boardClubs, coveredSet, state.allCoveredAwarded);

    playCorrect();
    setFlashColor("bg-emerald-500");
    setTimeout(() => setFlashColor(null), 300);
    setHighlightClubs(new Set(result.matchedClubs));
    setTimeout(() => setHighlightClubs(new Set()), 1500);

    const bonusLabels: string[] = [];
    if (result.multiplierLabel) bonusLabels.push(result.multiplierLabel);

    const newFound: FoundPlayer = {
      displayName: player.displayName,
      matchedClubs: result.matchedClubs,
      points: result.total,
      bonuses: bonusLabels,
    };

    const newClubHits = { ...state.clubHits };
    for (const c of result.matchedClubs) {
      newClubHits[c] = (newClubHits[c] || 0) + 1;
    }

    const newCovered = new Set(state.coveredClubs);
    for (const c of result.matchedClubs) newCovered.add(c);

    const newAllCoveredAwarded = state.allCoveredAwarded || result.triggeredAllCovered;

    setState(prev => ({
      ...prev,
      score: prev.score + result.total,
      foundPlayers: [newFound, ...prev.foundPlayers],
      coveredClubs: Array.from(newCovered),
      clubHits: newClubHits,
      allCoveredAwarded: newAllCoveredAwarded,
    }));

    showFeedbackMsg({ type: "correct", message: `${player.displayName}`, points: result.total, bonuses: bonusLabels });

    if (result.triggeredAllCovered) {
      setTimeout(() => {
        setShowCoverBonus(true);
        setState(prev => ({ ...prev, score: prev.score + ALL_COVERED_BONUS }));
        setTimeout(() => setShowCoverBonus(false), 3000);
      }, 1500);
    }
  }, [input, playerLookup, boardClubs, state, coveredSet, showFeedbackMsg, isFinished]);

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  };

  // --- End Screen ---
  if (isFinished) {
    return <EndScreen
      state={state}
      boardClubs={boardClubs}
      totalValid={totalValid}
      dateKey={dateKey}
      formatDate={formatDate}
      navigate={navigate}
      username={user?.username}
    />;
  }

  // --- Rules Screen ---
  if (showRules) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full blur-3xl ${theme.glowA}`} />
          <div className={`absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full blur-3xl ${theme.glowB}`} />
        </div>
        <div className="relative z-10 flex flex-col items-center w-full max-w-lg mx-auto px-4 pt-4 pb-8 flex-1">
          <div className="w-full flex items-center justify-between mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}
              className="text-muted-foreground hover:text-foreground">
              <Home className="w-4 h-4 mr-1" /> Home
            </Button>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 text-xs font-semibold">
                <Calendar className="w-3 h-3" />DAILY
              </span>
              <span className="text-sm text-muted-foreground">{formatDate(dateKey)}</span>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full text-center">
            <h1 className="text-3xl font-black tracking-tight mb-1">
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Griddle</span>
            </h1>
            <p className="text-sm text-muted-foreground mb-6">Daily PL Club Grid</p>

            <div className="text-left space-y-3 mb-8">
              <RuleItem icon="🏟️" text="A 3×3 grid of 9 Premier League clubs appears each day" />
              <RuleItem icon="🧠" text="Name players who made Premier League appearances for at least 2 clubs on the board (only PL apps count)" />
              <RuleItem icon="📈" text="More clubs = more points. Base: 5 pts (2 clubs) up to 50 pts (6+ clubs)" />
              <RuleItem icon="🔗" text="Adjacent clubs on the grid score 2× bonus" />
              <RuleItem icon="📐" text="Complete a row, column, or diagonal for 5× bonus" />
              <RuleItem icon="🎯" text="Cover all 9 clubs for a one-time +25 bonus" />
              <RuleItem icon="❌" text="Wrong guesses cost -1 (only if the player has 0 clubs on the board)" />
              <RuleItem icon="🏁" text="When you're done, tap the flag to submit your score to the leaderboard" />
            </div>

            <Button className={`w-full text-lg py-6 ${theme.primaryBtn}`} onClick={() => setShowRules(false)}>
              Play today's board
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  // --- Playing Screen ---
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full blur-3xl ${theme.glowA}`} />
        <div className={`absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full blur-3xl ${theme.glowB}`} />
      </div>

      <ScreenFlash show={flashColor !== null} color={flashColor || "bg-blue-500"} />

      <AnimatePresence>
        {showCoverBonus && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-8 py-4 rounded-2xl shadow-2xl shadow-blue-500/30 text-center">
              <div className="text-lg font-bold">Board Covered!</div>
              <div className="text-3xl font-black mt-1">+{ALL_COVERED_BONUS}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowConfirm(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-card border border-border rounded-xl p-6 max-w-sm w-full text-center"
              onClick={e => e.stopPropagation()}>
              <Flag className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-2">Submit your score?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your score of <span className="font-bold text-foreground">{state.score}</span> will be submitted to the leaderboard.
                You won't be able to add more guesses today.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>
                  Keep playing
                </Button>
                <Button
                  className={`flex-1 ${theme.primaryBtn}`}
                  onClick={handleFinish}
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col items-center w-full max-w-lg mx-auto px-4 pt-4 pb-8 flex-1">
        {/* Header */}
        <div className="w-full flex items-center justify-between mb-4">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}
              className="text-muted-foreground hover:text-foreground">
              <Home className="w-4 h-4 mr-1" /> Home
            </Button>
            <button
              onClick={() => setShowRules(true)}
              className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors"
              title="How to play"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 text-xs font-semibold">
              <Calendar className="w-3 h-3" />DAILY
            </span>
            <span className="text-sm text-muted-foreground">{formatDate(dateKey)}</span>
          </div>
        </div>

        {/* Title + Score + Tier */}
        <div className="w-full flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Griddle</span>
          </h1>
          <div className={`text-3xl font-black tabular-nums ${theme.accent}`}>{state.score}</div>
          <div className="text-right flex flex-col items-end gap-1">
            <div className="text-xs text-muted-foreground">{state.foundPlayers.length} / {totalValid} found</div>
            {tierInfo.current ? (
              <>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tierInfo.current.bg} ${tierInfo.current.color}`}>
                  {tierInfo.current.label}
                </span>
                {tierInfo.nextTier && (
                  <span className="text-[10px] text-muted-foreground">
                    {Math.ceil(tierInfo.nextTier.pct * totalValid) - state.foundPlayers.length} more for {tierInfo.nextTier.label}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[10px] text-muted-foreground">
                {Math.ceil(TIERS[0].pct * totalValid)} more for {TIERS[0].label}
              </span>
            )}
          </div>
        </div>

        {/* 3x3 Grid */}
        <div className="w-full grid grid-cols-3 gap-1.5 mb-4">
          {boardClubs.map((club) => {
            const hits = state.clubHits[club] || 0;
            const isCovered = coveredSet.has(club);
            const isHighlighted = highlightClubs.has(club);
            return (
              <motion.div key={club}
                animate={isHighlighted ? { scale: [1, 1.05, 1], transition: { duration: 0.3 } } : {}}
                className={`relative rounded-lg border p-2 text-center text-sm font-medium transition-all duration-300
                  ${isHighlighted
                    ? "bg-gradient-to-br from-emerald-500/30 to-green-400/20 border-emerald-400/60 text-emerald-200 shadow-lg shadow-emerald-500/25"
                    : isCovered
                      ? "bg-blue-500/10 border-blue-500/30 text-foreground"
                      : "bg-card/50 border-border text-muted-foreground"}`}>
                <span className="block truncate leading-tight">{club}</span>
                {isCovered && !isHighlighted && (
                  <div className="absolute top-1 right-1 flex items-center gap-0.5">
                    {hits > 1 && <span className={`text-[10px] font-bold tabular-nums ${getHitIndicatorColor(hits)}`}>{hits}</span>}
                    <div className={`w-1.5 h-1.5 rounded-full ${getHitDotBg(hits)}`} />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Input + Finish button */}
        <form onSubmit={handleSubmit} className="w-full mb-3 flex gap-2">
          <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
            placeholder="Enter a player name..."
            autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
            className={`flex-1 px-4 py-3 rounded-xl bg-card/80 border border-border text-foreground placeholder:text-muted-foreground/50 outline-none transition-all text-base ${theme.inputFocus}`}
          />
          {state.foundPlayers.length > 0 && (
            <button type="button" onClick={() => setShowConfirm(true)}
              className="px-3 py-3 rounded-xl bg-card/80 border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/40 transition-colors"
              title="I'm done — submit score">
              <Flag className="w-5 h-5" />
            </button>
          )}
        </form>

        {/* Feedback */}
        <AnimatePresence mode="wait">
          {feedback && (
            <motion.div key={feedback.message} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
              className={`w-full rounded-lg px-4 py-2.5 mb-3 text-sm font-medium ${
                feedback.type === "correct" ? "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                : feedback.type === "wrong" ? "bg-red-500/15 text-red-300 border border-red-500/30"
                : feedback.type === "ambiguous" ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                : "bg-muted/50 text-muted-foreground border border-border"}`}>
              <div className="flex items-center justify-between">
                <span>{feedback.message}</span>
                {feedback.points !== undefined && (
                  <span className={`font-bold tabular-nums ${feedback.points > 0 ? "text-blue-300" : "text-red-300"}`}>
                    {feedback.points > 0 ? "+" : ""}{feedback.points}
                  </span>
                )}
              </div>
              {feedback.bonuses && feedback.bonuses.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {feedback.bonuses.map(b => (
                    <span key={b} className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">{b}</span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Coverage bar */}
        <div className="w-full mb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Board coverage {state.allCoveredAwarded ? `— +${ALL_COVERED_BONUS} bonus earned!` : ""}</span>
            <span>{coveredSet.size} / 9 clubs</span>
          </div>
          <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${state.allCoveredAwarded ? "bg-gradient-to-r from-yellow-400 to-amber-400" : "bg-gradient-to-r from-yellow-500 to-orange-500"}`}
              initial={false} animate={{ width: `${(coveredSet.size / 9) * 100}%` }} transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Found players list */}
        {state.foundPlayers.length > 0 && (
          <div className="w-full flex-1">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Found Players</h3>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {state.foundPlayers.map((fp, i) => (
                <motion.div key={fp.displayName} initial={i === 0 ? { opacity: 0, x: -12 } : false} animate={{ opacity: 1, x: 0 }}
                  className="px-3 py-2 rounded-lg bg-card/50 border border-border text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{fp.displayName}</span>
                    <span className={`font-bold tabular-nums ml-2 ${theme.accent}`}>+{fp.points}</span>
                  </div>
                  <div className="flex items-center flex-wrap gap-1.5 mt-1">
                    <span className="text-xs text-muted-foreground">{fp.matchedClubs.join(", ")}</span>
                    {fp.bonuses.map(b => (
                      <span key={b} className="text-xs px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium">{b}</span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {state.foundPlayers.length === 0 && (
          <div className="w-full text-center py-8 text-muted-foreground">
            <p className="text-sm">Name a player who appeared for at least 2 clubs on the board</p>
            <p className="text-xs mt-2 opacity-60">More clubs = more points. Adjacent clubs 2x, complete row/col/diag 5x.</p>
          </div>
        )}
      </div>
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

// --- End Screen Component ---
function EndScreen({
  state, boardClubs, totalValid, dateKey, formatDate, navigate, username,
}: {
  state: GriddleState;
  boardClubs: string[];
  totalValid: number;
  dateKey: string;
  formatDate: (d: string) => string;
  navigate: (to: string) => void;
  username?: string;
}) {
  const tierInfo = getCurrentTier(state.foundPlayers.length, totalValid);
  const topMissed = useMemo(
    () => getTopMissed(boardClubs, new Set(state.foundPlayers.map(fp => fp.displayName)), 5),
    [boardClubs, state.foundPlayers],
  );
  const [lbPeriod, setLbPeriod] = useState<DailyPeriod>("today");
  const { entries, loading } = useDailyLeaderboard("griddle", lbPeriod, 10, 1000);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full blur-3xl ${theme.glowA}`} />
        <div className={`absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full blur-3xl ${theme.glowB}`} />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-lg mx-auto px-4 pt-4 pb-8 flex-1">
        {/* Header */}
        <div className="w-full flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground">
            <Home className="w-4 h-4 mr-1" /> Home
          </Button>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 text-xs font-semibold">
              <Calendar className="w-3 h-3" />DAILY
            </span>
            <span className="text-sm text-muted-foreground">{formatDate(dateKey)}</span>
          </div>
        </div>

        {/* Score display */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Griddle</span>
            <span className="text-muted-foreground text-lg ml-2">— Complete</span>
          </h1>
          <div className={`text-5xl font-black tabular-nums ${theme.accent}`}>{state.score}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {state.foundPlayers.length} of {totalValid} players found
          </div>
          {tierInfo.current && (
            <span className={`inline-block mt-2 text-sm font-bold px-3 py-1 rounded-full border ${tierInfo.current.bg} ${tierInfo.current.color}`}>
              {tierInfo.current.label}
            </span>
          )}
        </motion.div>

        {/* Top missed players */}
        {topMissed.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="w-full mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Top players you missed</h3>
            <div className="space-y-1.5">
              {topMissed.map(({ player, clubs, score }) => (
                <div key={player.displayName} className="flex items-center justify-between px-3 py-2 rounded-lg bg-card/50 border border-border text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">{player.displayName}</span>
                    <span className="text-xs text-muted-foreground ml-1.5">{clubs.join(", ")}</span>
                  </div>
                  <span className="font-bold tabular-nums text-muted-foreground ml-2">+{score}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Leaderboard */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="w-full mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Trophy className="w-3 h-3" />Leaderboard
            </div>
            <div className="flex gap-1">
              {(["today", "yesterday"] as const).map(p => (
                <button key={p} onClick={() => setLbPeriod(p)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                    lbPeriod === p ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {p === "today" ? "Today" : "Yesterday"}
                </button>
              ))}
            </div>
          </div>
          <LeaderboardTable
            entries={entries}
            loading={loading}
            period="today"
            onPeriodChange={() => {}}
            currentUser={username}
            accentBg="bg-blue-500/10 border-blue-500/30"
            scoreLabel="Score"
            mini
            max={10}
          />
        </motion.div>

        {/* Come back tomorrow */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
          className="w-full text-center py-4 text-muted-foreground">
          <p className="text-sm">Come back tomorrow for a new board!</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/")}>
            <Home className="w-4 h-4 mr-1.5" /> Back to games
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
