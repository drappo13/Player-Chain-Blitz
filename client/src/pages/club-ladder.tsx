import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import plPlayers from "@/data/pl-players.json";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Trophy, ChevronRight, RotateCcw, Star, Home, Shield, SkipForward, TrendingUp, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { playTick, playGameEnd, playHighScore, playScoreSound, playShieldBlock } from "@/lib/sounds";
import { gameThemes } from "@/lib/game-themes";
import { useUser } from "@/lib/user-context";
import { saveScore } from "@/lib/save-score";

const theme = gameThemes.ladder;

const TURN_TIME = 30;
const MIN_VALID_CLUBS = 3;

// --- Types ---

interface PLPlayer {
  displayName: string;
  firstName: string;
  lastName: string;
  position: string;
  nationality: string;
  dob: string;
  clubs: Record<string, { appearances: number; goals: number; assists: number }>;
  totalAppearances: number;
  totalGoals: number;
  totalAssists: number;
}

interface ClubOption {
  club: string;
  multiplier: number;
}

interface Board {
  clubs: ClubOption[];
}

interface TurnResult {
  id: number;
  turnNum: number;
  player: PLPlayer | null;
  club: string;
  clubGoals: number;
  multiplier: number;
  basePoints: number;
  efficiencyBonus: number;
  finalPoints: number;
  elapsed: number;
  threshold: number;
  wasShield: boolean;
  wasPass: boolean;
  wasTimeout: boolean;
}

type GameState = "idle" | "playing" | "finished";
type FailReason = "not_found" | "already_used" | "no_club" | "below_threshold";

// --- Name normalization (copied per convention) ---

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ð/g, "d")
    .replace(/þ/g, "th")
    .replace(/đ/g, "d")
    .replace(/['\-\s]/g, "");
}

function getCommonSurname(p: PLPlayer): string {
  const displayParts = p.displayName.trim().split(/\s+/);
  if (displayParts.length > 1) {
    return displayParts[displayParts.length - 1];
  }
  return p.lastName;
}

function buildPlayerLookup(): Map<string, PLPlayer[]> {
  const lookup = new Map<string, PLPlayer[]>();

  function addToLookup(key: string, player: PLPlayer) {
    const norm = normalizeName(key);
    if (!norm) return;
    const existing = lookup.get(norm);
    if (existing) {
      if (!existing.some((p) => p.displayName === player.displayName)) {
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

  const mononyms: Record<string, string> = {
    gabriel: "gabrielmagalhaes",
    gilberto: "gilbertosilva",
  };
  for (const [mono, targetKey] of Object.entries(mononyms)) {
    const target = lookup.get(targetKey);
    if (!target) continue;
    const existing = lookup.get(mono);
    if (!existing) {
      lookup.set(mono, [...target]);
    } else {
      for (const p of target) {
        if (!existing.some((e) => e.displayName === p.displayName)) existing.push(p);
      }
    }
  }

  const alternates: Record<string, string> = {
    vannistelrooij: "vannistelrooy",
    nistelrooij: "nistelrooy",
  };
  for (const [alt, official] of Object.entries(alternates)) {
    const target = lookup.get(official);
    if (target && !lookup.has(alt)) lookup.set(alt, target);
  }

  return lookup;
}

// --- Club-Goals index ---

interface ClubPlayerEntry {
  player: PLPlayer;
  goals: number;
}

function buildClubGoalsIndex(): Map<string, ClubPlayerEntry[]> {
  const index = new Map<string, ClubPlayerEntry[]>();
  for (const p of plPlayers as PLPlayer[]) {
    for (const [club, stats] of Object.entries(p.clubs)) {
      if (stats.goals > 0) {
        if (!index.has(club)) index.set(club, []);
        index.get(club)!.push({ player: p, goals: stats.goals });
      }
    }
  }
  // Sort each club's players by goals descending
  for (const entries of index.values()) {
    entries.sort((a, b) => b.goals - a.goals);
  }
  return index;
}

// --- Scoring ---

function getBasePoints(elapsed: number): number {
  // 50 at 0s, linearly down to 25 at 30s
  const t = Math.min(elapsed, TURN_TIME) / TURN_TIME;
  return Math.round(50 - t * 25);
}

function getEfficiencyBonus(jump: number): { points: number; label: string } {
  if (jump <= 2) return { points: 20, label: "Tiny increment +20" };
  if (jump <= 5) return { points: 16, label: "Small increment +16" };
  if (jump <= 10) return { points: 11, label: "Modest increment +11" };
  if (jump <= 20) return { points: 6, label: "Medium increment +6" };
  return { points: 0, label: "" };
}

function computeScore(elapsed: number, jump: number, multiplier: number): { base: number; efficiency: number; effLabel: string; final: number } {
  const base = getBasePoints(elapsed);
  const eff = getEfficiencyBonus(jump);
  const final = Math.round((base + eff.points) * multiplier);
  return { base, efficiency: eff.points, effLabel: eff.label, final };
}

// --- Board generation ---

/** Count valid (unused, above threshold) players per club. */
function getClubWeights(
  clubIndex: Map<string, ClubPlayerEntry[]>,
  threshold: number,
  usedPlayerKeys: Set<string>,
): Map<string, number> {
  const weights = new Map<string, number>();
  for (const [club, entries] of clubIndex) {
    let count = 0;
    for (const e of entries) {
      if (e.goals > threshold && !usedPlayerKeys.has(e.player.displayName.toLowerCase())) {
        count++;
      }
    }
    if (count > 0) weights.set(club, count);
  }
  return weights;
}

/** Weighted random pick from a weights map, excluding certain clubs. Returns null if empty. */
function weightedPick(weights: Map<string, number>, exclude: Set<string>): string | null {
  let total = 0;
  for (const [club, w] of weights) {
    if (!exclude.has(club)) total += w;
  }
  if (total === 0) return null;
  let r = Math.random() * total;
  for (const [club, w] of weights) {
    if (exclude.has(club)) continue;
    r -= w;
    if (r <= 0) return club;
  }
  return null;
}

function generateBoard(
  clubIndex: Map<string, ClubPlayerEntry[]>,
  threshold: number,
  usedPlayerKeys: Set<string>,
  lastAnswerClub?: string,
): Board | null {
  const weights = getClubWeights(clubIndex, threshold, usedPlayerKeys);
  if (weights.size < MIN_VALID_CLUBS) return null;

  // Pick 3 clubs via weighted sampling. Exclude last-answered club from first pick.
  const picked: string[] = [];
  const excluded = new Set<string>();
  if (lastAnswerClub && weights.has(lastAnswerClub) && weights.size > MIN_VALID_CLUBS) {
    excluded.add(lastAnswerClub);
  }

  for (let i = 0; i < 3; i++) {
    const club = weightedPick(weights, excluded);
    if (!club) return null;
    picked.push(club);
    excluded.add(club); // don't pick the same club twice in one board
  }

  // Always assign in order: 1x, 2x, 3x
  return {
    clubs: picked.map((club, i) => ({ club, multiplier: i + 1 })),
  };
}

// --- Answer validation ---

function validateAnswer(
  guess: string,
  playerLookup: Map<string, PLPlayer[]>,
  board: Board,
  threshold: number,
  usedPlayerKeys: Set<string>,
): {
  valid: boolean;
  player?: PLPlayer;
  club?: string;
  clubGoals?: number;
  multiplier?: number;
  jump?: number;
  failReason?: FailReason;
  /** For failed lookups: the matched player's name + their goals at each shown club */
  failPlayer?: string;
  failClubGoals?: { club: string; goals: number }[];
} {
  const norm = normalizeName(guess);
  const candidates = playerLookup.get(norm);

  if (!candidates || candidates.length === 0) {
    return { valid: false, failReason: "not_found" };
  }

  // Check for already used
  const unusedCandidates = candidates.filter(
    (c) => !usedPlayerKeys.has(c.displayName.toLowerCase())
  );

  if (unusedCandidates.length === 0) {
    // Return info about the used player
    const used = candidates.find((c) => usedPlayerKeys.has(c.displayName.toLowerCase()));
    return { valid: false, failReason: "already_used", failPlayer: used?.displayName };
  }

  // For each unused candidate, check if they have goals > threshold at any shown club
  // Pick the one that produces the highest score (best club x multiplier)
  let bestMatch: {
    player: PLPlayer;
    club: string;
    clubGoals: number;
    multiplier: number;
    score: number;
  } | null = null;

  for (const candidate of unusedCandidates) {
    for (const co of board.clubs) {
      const clubData = candidate.clubs[co.club];
      if (clubData && clubData.goals > threshold) {
        const jump = clubData.goals - threshold;
        const score = (50 + getEfficiencyBonus(jump).points) * co.multiplier;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            player: candidate,
            club: co.club,
            clubGoals: clubData.goals,
            multiplier: co.multiplier,
            score,
          };
        }
      }
    }
  }

  if (!bestMatch) {
    // Build detail: show the player's goals at each shown club
    const bestCandidate = unusedCandidates[0];
    const clubGoals = board.clubs.map((co) => ({
      club: co.club,
      goals: bestCandidate.clubs[co.club]?.goals ?? 0,
    }));
    const hasAnyClub = clubGoals.some((cg) => cg.goals > 0);

    return {
      valid: false,
      failReason: hasAnyClub ? "below_threshold" : "no_club",
      failPlayer: bestCandidate.displayName,
      failClubGoals: clubGoals,
    };
  }

  return {
    valid: true,
    player: bestMatch.player,
    club: bestMatch.club,
    clubGoals: bestMatch.clubGoals,
    multiplier: bestMatch.multiplier,
    jump: bestMatch.clubGoals - threshold,
  };
}

// --- Component ---

export default function ClubLadder() {
  const [, navigate] = useLocation();

  const playerLookup = useMemo(() => buildPlayerLookup(), []);
  const clubIndex = useMemo(() => buildClubGoalsIndex(), []);

  const [gameState, setGameState] = useState<GameState>("idle");
  const [turnNum, setTurnNum] = useState(1);
  const [turnTimeLeft, setTurnTimeLeft] = useState(TURN_TIME);
  const [currentBoard, setCurrentBoard] = useState<Board | null>(null);
  const [threshold, setThreshold] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [usedPlayerKeys, setUsedPlayerKeys] = useState<Set<string>>(new Set());
  const [totalScore, setTotalScore] = useState(0);
  const [hasShield, setHasShield] = useState(true);
  const [hasPass, setHasPass] = useState(true);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(sessionStorage.getItem("clubladder-highscore") || "0");
    } catch {
      return 0;
    }
  });

  // Feedback state
  const [lastResult, setLastResult] = useState<TurnResult | null>(null);
  const [showCorrect, setShowCorrect] = useState(false);
  const [showWrong, setShowWrong] = useState(false);
  const [showShield, setShowShield] = useState(false);
  const [failFeedback, setFailFeedback] = useState<{
    reason: FailReason;
    guess: string;
    playerName?: string;
    clubGoals?: { club: string; goals: number }[];
  } | null>(null);
  const [turnResults, setTurnResults] = useState<TurnResult[]>([]);
  const [endReason, setEndReason] = useState<string>("");

  const inputRef = useRef<HTMLInputElement>(null);
  const turnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const turnStartRef = useRef<number>(Date.now());
  const turnResolvedRef = useRef(false);
  const turnTimeRef = useRef(TURN_TIME);
  const lastAnswerClubRef = useRef<string | undefined>(undefined);

  const clearTurnTimer = useCallback(() => {
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current);
      turnTimerRef.current = null;
    }
  }, []);

  const endGame = useCallback((reason: string) => {
    setGameState("finished");
    setEndReason(reason);
    clearTurnTimer();
    setTotalScore((prev) => {
      if (prev > highScore) {
        setHighScore(prev);
        try {
          sessionStorage.setItem("clubladder-highscore", prev.toString());
        } catch {}
      }
      return prev;
    });
  }, [highScore, clearTurnTimer]);

  const advanceTurn = useCallback((
    newThreshold: number,
    newUsedKeys: Set<string>,
    answeredClub?: string,
  ) => {
    if (answeredClub) lastAnswerClubRef.current = answeredClub;
    const board = generateBoard(clubIndex, newThreshold, newUsedKeys, lastAnswerClubRef.current);
    if (!board) {
      endGame("Reached the top! No more valid clubs.");
      return;
    }

    setTurnNum((prev) => prev + 1);
    setTurnTimeLeft(TURN_TIME);
    turnTimeRef.current = TURN_TIME;
    setCurrentBoard(board);
    setInputValue("");
    setFailFeedback(null);
    turnResolvedRef.current = false;
    turnStartRef.current = Date.now();
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50);
  }, [clubIndex, endGame]);

  const shieldRecover = useCallback((
    currentThreshold: number,
    currentUsedKeys: Set<string>,
  ) => {
    setHasShield(false);
    setShowShield(true);
    playShieldBlock();
    setTimeout(() => {
      setShowShield(false);
      setFailFeedback(null);
    }, 3000);

    const board = generateBoard(clubIndex, currentThreshold, currentUsedKeys, lastAnswerClubRef.current);
    if (!board) {
      endGame("Reached the top! No more valid clubs.");
      return;
    }
    setCurrentBoard(board);
    setTurnTimeLeft(TURN_TIME);
    turnTimeRef.current = TURN_TIME;
    setInputValue("");
    turnResolvedRef.current = false;
    turnStartRef.current = Date.now();
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50);
  }, [clubIndex, endGame]);

  const startGame = useCallback(() => {
    setGameState("playing");
    setTurnNum(1);
    setTurnTimeLeft(TURN_TIME);
    turnTimeRef.current = TURN_TIME;
    setInputValue("");
    setUsedPlayerKeys(new Set());
    setTotalScore(0);
    setThreshold(0);
    setHasShield(true);
    setHasPass(true);
    setLastResult(null);
    setShowCorrect(false);
    setShowWrong(false);
    setShowShield(false);
    setFailFeedback(null);
    setTurnResults([]);
    setEndReason("");
    lastAnswerClubRef.current = undefined;

    const board = generateBoard(clubIndex, 0, new Set());
    if (board) {
      setCurrentBoard(board);
    }
    turnStartRef.current = Date.now();
    turnResolvedRef.current = false;

    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100);
  }, [clubIndex]);

  const goHome = useCallback(() => {
    clearTurnTimer();
    navigate("/");
  }, [navigate, clearTurnTimer]);

  // Timer effect
  useEffect(() => {
    if (gameState === "playing") {
      turnResolvedRef.current = false;

      turnTimerRef.current = setInterval(() => {
        if (turnResolvedRef.current) return;

        turnTimeRef.current -= 0.1;
        const t = turnTimeRef.current;

        if (t <= 0) {
          clearTurnTimer();
          turnResolvedRef.current = true;
          setTurnTimeLeft(0);

          if (hasShield) {
            setLastResult(null);
            shieldRecover(threshold, usedPlayerKeys);
          } else {
            endGame("Time's up!");
          }
          return;
        }

        setTurnTimeLeft(t);
        const rounded = Math.round(t * 10) / 10;
        if (rounded <= 5 && Math.abs(rounded - Math.round(rounded)) < 0.05) playTick();
      }, 100);
    }
    return () => clearTurnTimer();
  }, [gameState, turnNum, currentBoard, hasShield, threshold, usedPlayerKeys, clearTurnTimer, endGame, shieldRecover]);

  const handlePass = useCallback(() => {
    if (gameState !== "playing" || !currentBoard || turnResolvedRef.current || !hasPass) return;
    turnResolvedRef.current = true;
    clearTurnTimer();
    setHasPass(false);

    const result: TurnResult = {
      id: Date.now(),
      turnNum,
      player: null,
      club: "",
      clubGoals: 0,
      multiplier: 0,
      basePoints: 0,
      efficiencyBonus: 0,
      finalPoints: 0,
      elapsed: (Date.now() - turnStartRef.current) / 1000,
      threshold,
      wasShield: false,
      wasPass: true,
      wasTimeout: false,
    };
    setLastResult(result);
    setTurnResults((prev) => [...prev, result]);

    advanceTurn(threshold, usedPlayerKeys);
  }, [gameState, currentBoard, hasPass, turnNum, threshold, usedPlayerKeys, advanceTurn, clearTurnTimer]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (gameState !== "playing" || !currentBoard || turnResolvedRef.current) return;

      const guess = inputValue.trim();
      if (!guess) return;

      const result = validateAnswer(guess, playerLookup, currentBoard, threshold, usedPlayerKeys);

      if (!result.valid) {
        setShowWrong(true);
        setTimeout(() => setShowWrong(false), 400);
        setFailFeedback({
          reason: result.failReason!,
          guess,
          playerName: result.failPlayer,
          clubGoals: result.failClubGoals,
        });
        setInputValue("");

        if (hasShield) {
          clearTurnTimer();
          turnResolvedRef.current = true;
          shieldRecover(threshold, usedPlayerKeys);
        } else {
          clearTurnTimer();
          turnResolvedRef.current = true;
          endGame("Wrong answer!");
        }
        return;
      }

      // Correct answer!
      turnResolvedRef.current = true;
      clearTurnTimer();
      setFailFeedback(null);

      const playerKey = result.player!.displayName.toLowerCase();
      const newUsedKeys = new Set(usedPlayerKeys).add(playerKey);
      setUsedPlayerKeys(newUsedKeys);

      const elapsed = (Date.now() - turnStartRef.current) / 1000;
      const jump = result.jump!;
      const scoring = computeScore(elapsed, jump, result.multiplier!);

      playScoreSound({
        finalPoints: scoring.final,
        basePoints: scoring.base + scoring.efficiency,
        isExact: scoring.final >= 100,
        isBoostHit: false,
        comboStreak: 1,
      });

      setShowCorrect(true);
      setTimeout(() => setShowCorrect(false), 500);
      setTotalScore((prev) => prev + scoring.final);

      const newThreshold = result.clubGoals!;
      setThreshold(newThreshold);

      const turnResult: TurnResult = {
        id: Date.now(),
        turnNum,
        player: result.player!,
        club: result.club!,
        clubGoals: result.clubGoals!,
        multiplier: result.multiplier!,
        basePoints: scoring.base,
        efficiencyBonus: scoring.efficiency,
        finalPoints: scoring.final,
        elapsed,
        threshold: newThreshold,
        wasShield: false,
        wasPass: false,
        wasTimeout: false,
      };
      setLastResult(turnResult);
      setTurnResults((prev) => [...prev, turnResult]);

      setInputValue("");
      setTimeout(() => advanceTurn(newThreshold, newUsedKeys, result.club), 400);
    },
    [gameState, inputValue, currentBoard, threshold, usedPlayerKeys, playerLookup, turnNum, hasShield, advanceTurn, clearTurnTimer, endGame, shieldRecover]
  );

  const timePercent = (turnTimeLeft / TURN_TIME) * 100;
  const isUrgent = turnTimeLeft <= 5;
  const isWarning = turnTimeLeft <= 10;
  const liveElapsed = TURN_TIME - turnTimeLeft;
  const liveBase = getBasePoints(liveElapsed);

  if (gameState === "idle") {
    return <StartScreen highScore={highScore} onStart={startGame} onHome={goHome} />;
  }

  if (gameState === "finished") {
    return (
      <EndScreen
        turnResults={turnResults}
        totalScore={totalScore}
        highScore={highScore}
        endReason={endReason}
        failFeedback={failFeedback}
        threshold={threshold}
        onRestart={startGame}
        onHome={goHome}
      />
    );
  }

  return (
    <div className="bg-background relative transition-colors duration-1000 overflow-x-hidden sm:min-h-screen">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none transition-opacity duration-1000">
        <div className={`absolute top-0 left-1/4 w-96 h-96 ${theme.glowA} rounded-full blur-3xl`} />
        <div className={`absolute bottom-0 right-1/4 w-80 h-80 ${theme.glowB} rounded-full blur-3xl`} />
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 py-2 sm:py-4 flex flex-col sm:min-h-screen">
        {/* Header bar */}
        <div className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-2.5">
            <button
              onClick={goHome}
              className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Home className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/20">
              <span className="text-sm font-bold text-purple-400 tabular-nums">Turn {turnNum}</span>
            </div>
            {/* Shield indicator */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md border ${
              hasShield
                ? "bg-emerald-500/10 border-emerald-500/20"
                : "bg-muted/30 border-border/30"
            }`}>
              <Shield className={`w-3.5 h-3.5 ${hasShield ? "text-emerald-400" : "text-muted-foreground/30"}`} />
              {hasShield && <span className="text-xs font-bold text-emerald-400">1</span>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Timer */}
            <div className="flex items-center gap-1.5">
              <Timer className={`w-3.5 h-3.5 ${isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : theme.timerIconColor}`} />
              <span
                className={`text-lg font-mono font-bold tabular-nums ${isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : "text-foreground"} ${isUrgent ? "animate-countdown-pulse" : ""}`}
              >
                {Math.ceil(turnTimeLeft)}s
              </span>
            </div>

            {highScore > 0 && (
              <div className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-sm font-medium text-amber-400/80">{highScore}</span>
              </div>
            )}
          </div>
        </div>

        {/* Timer bar with live pts */}
        <div className="relative w-full mb-3 sm:mb-4">
          <div className="w-full h-2.5 rounded-full bg-muted/50">
            <motion.div
              className={`h-full rounded-full transition-colors duration-300 ${isUrgent ? "bg-red-500" : isWarning ? "bg-amber-500" : theme.timerBar}`}
              style={{ width: `${timePercent}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
          {!turnResolvedRef.current && turnTimeLeft > 0 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none flex items-center"
              style={{ left: `${timePercent}%` }}
            >
              <span className={`text-[10px] font-bold tabular-nums ml-2 leading-none ${isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : "text-purple-400"}`}>
                {liveBase}pts
              </span>
            </div>
          )}
        </div>

        <div className="sm:flex-1 flex flex-col items-center min-h-0">
          {/* Threshold — big and prominent */}
          <motion.div
            key={threshold}
            initial={{ scale: 0.9, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center mb-2"
          >
            <div className="text-5xl sm:text-6xl font-black tabular-nums bg-gradient-to-b from-purple-400 to-purple-600 bg-clip-text text-transparent">
              {threshold}
            </div>
            <span className="text-[10px] text-purple-400/70 uppercase tracking-widest font-bold">
              goals to beat
            </span>
          </motion.div>

          {/* Score — secondary */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg font-bold tabular-nums text-foreground/70">{totalScore}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">pts</span>
          </div>

          {/* Last result feedback */}
          <AnimatePresence mode="wait">
            {lastResult && !lastResult.wasPass && lastResult.player && (
              <motion.div
                key={lastResult.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="mb-3 sm:mb-4 px-4 py-2 rounded-md border w-full max-w-sm bg-purple-500/10 border-purple-500/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-bold text-foreground text-sm">
                      {lastResult.player.displayName}
                    </span>
                    <span className="text-xs text-purple-400 font-bold ml-2">
                      {lastResult.club} ({lastResult.clubGoals}g)
                    </span>
                  </div>
                  <span className="font-bold tabular-nums text-sm text-emerald-400 flex-shrink-0">
                    +{lastResult.finalPoints}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>Speed {lastResult.basePoints}</span>
                  {lastResult.efficiencyBonus > 0 && (
                    <>
                      <span className="text-muted-foreground/30">&middot;</span>
                      <span className="text-cyan-400">
                        {lastResult.clubGoals - lastResult.threshold + (lastResult.clubGoals - (lastResult.threshold - lastResult.efficiencyBonus)) <= 2 ? "Tiny" : lastResult.clubGoals - lastResult.threshold <= 5 ? "Small" : lastResult.clubGoals - lastResult.threshold <= 10 ? "Modest" : "Medium"} increment +{lastResult.efficiencyBonus}
                      </span>
                    </>
                  )}
                  <span className="text-muted-foreground/30">&middot;</span>
                  <span>{lastResult.multiplier}x</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Shield popup — includes fail reason inline */}
          <AnimatePresence>
            {showShield && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, y: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="mb-3 px-5 py-3 rounded-lg border-2 border-emerald-500/40 bg-emerald-500/10 w-full max-w-sm"
              >
                <div className="flex items-center justify-center gap-3 mb-1">
                  <motion.div
                    animate={{ rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.2, 1.1, 1.15, 1.05, 1] }}
                    transition={{ duration: 0.6 }}
                  >
                    <Shield className="w-7 h-7 text-emerald-400" />
                  </motion.div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-emerald-400">Shield Activated!</div>
                    <div className="text-[10px] text-muted-foreground">New clubs drawn</div>
                  </div>
                </div>
                {failFeedback && (
                  <FailDetail feedback={failFeedback} threshold={threshold} muted />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fail feedback — shown standalone when no shield (game over state) */}
          <AnimatePresence>
            {failFeedback && !showShield && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-3 px-4 py-2 rounded-md border border-red-500/20 bg-red-500/5 w-full max-w-sm"
              >
                <FailDetail feedback={failFeedback} threshold={threshold} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Club tiles — always sorted 1x 2x 3x */}
          {currentBoard && (
            <motion.div
              key={currentBoard.clubs.map(c => c.club).join("|")}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="w-full max-w-lg mb-4"
            >
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[...currentBoard.clubs].sort((a, b) => a.multiplier - b.multiplier).map((co) => (
                  <div
                    key={co.club}
                    className="relative rounded-lg border border-border/60 bg-card p-3 sm:p-4 text-center"
                  >
                    <div className="text-base sm:text-xl font-black text-foreground leading-tight mb-2">
                      {co.club}
                    </div>
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                      co.multiplier === 3
                        ? "bg-purple-500/15 border border-purple-500/30 text-purple-400"
                        : co.multiplier === 2
                          ? "bg-indigo-500/15 border border-indigo-500/30 text-indigo-400"
                          : "bg-muted/50 border border-border/40 text-muted-foreground"
                    }`}>
                      {co.multiplier}x
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Input */}
          <div className="w-full max-w-md mx-auto mb-2 sm:mb-4 sm:mt-auto mt-4">
            <form onSubmit={handleSubmit} className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => { setInputValue(e.target.value); setFailFeedback(null); }}
                placeholder="Name a goalscorer..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                onFocus={() => setTimeout(() => window.scrollTo({ top: 0 }), 300)}
                className={`w-full text-center text-lg sm:text-xl font-semibold px-4 sm:px-6 py-3 sm:py-4 rounded-md border-2 bg-card text-foreground placeholder:text-muted-foreground/50 outline-none transition-all duration-150 ${
                  showCorrect
                    ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/20"
                    : showWrong
                      ? "border-red-500 bg-red-500/10 shadow-lg shadow-red-500/20 animate-shake"
                      : `border-border/60 ${theme.inputFocus}`
                }`}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {hasPass && (
                  <button
                    type="button"
                    onClick={handlePass}
                    className="p-2 rounded-md text-muted-foreground/40 hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
                    title="Pass (one use)"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="p-2 rounded-md text-muted-foreground/50 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </form>
            <p className="text-center text-[11px] text-muted-foreground/60 uppercase tracking-wider mt-2">
              Enter to submit
              {hasPass && " \u00b7 pass to redraw"}
            </p>
          </div>
        </div>
      </div>

      {/* Correct flash */}
      <AnimatePresence>
        {showCorrect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 pointer-events-none z-50"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.06 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-emerald-500"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wrong flash */}
      <AnimatePresence>
        {showWrong && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 pointer-events-none z-50"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.06 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-red-500"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shield flash */}
      <AnimatePresence>
        {showShield && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 pointer-events-none z-50"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.1, 0.05, 0.08, 0] }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 bg-emerald-500"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Fail Detail ---

function FailDetail({
  feedback,
  threshold,
  muted,
}: {
  feedback: {
    reason: FailReason;
    guess: string;
    playerName?: string;
    clubGoals?: { club: string; goals: number }[];
  };
  threshold: number;
  muted?: boolean;
}) {
  const nameColor = muted ? "text-foreground/70" : "text-foreground";
  const reasonColor = muted ? "text-red-400/70" : "text-red-400";
  const detailColor = muted ? "text-muted-foreground/50" : "text-muted-foreground";

  const showReason = feedback.reason === "not_found" || feedback.reason === "already_used" || feedback.reason === "no_club";

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className={`font-bold text-sm ${nameColor}`}>
          {feedback.playerName || feedback.guess}
        </span>
        {showReason && (
          <span className={`text-xs font-medium ${reasonColor}`}>
            {feedback.reason === "not_found" && "Not found in PL data"}
            {feedback.reason === "already_used" && "Already used"}
            {feedback.reason === "no_club" && "Not at these clubs"}
          </span>
        )}
      </div>
      {feedback.clubGoals && feedback.clubGoals.some((cg) => cg.goals > 0) && (
        <div className={`flex items-center gap-3 mt-1 text-xs ${detailColor}`}>
          {feedback.clubGoals.filter((cg) => cg.goals > 0).map((cg) => (
            <span key={cg.club}>
              {cg.club}: {cg.goals}g
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Start Screen ---

function StartScreen({
  highScore,
  onStart,
  onHome,
}: {
  highScore: number;
  onStart: () => void;
  onHome: () => void;
}) {
  return (
    <div className="min-h-screen bg-background flex items-start pt-12 sm:items-center sm:pt-0 justify-center p-4 relative overflow-x-hidden">
      <button
        onClick={onHome}
        className="absolute top-4 left-4 z-20 p-2 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <Home className="w-5 h-5" />
      </button>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-1/4 left-1/3 w-80 h-80 ${theme.glowA} rounded-full blur-3xl`} />
        <div className={`absolute bottom-1/3 right-1/4 w-64 h-64 ${theme.glowB} rounded-full blur-3xl`} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-xl w-full relative z-10"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", delay: 0.1, stiffness: 200 }}
          className="w-16 h-16 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-8 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/5 border border-purple-500/20 flex items-center justify-center shadow-xl shadow-purple-500/10"
        >
          <TrendingUp className="w-8 h-8 sm:w-12 sm:h-12 text-purple-400" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl sm:text-5xl font-black text-foreground mb-4 sm:mb-8 tracking-tight"
        >
          Ladder
          <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            Up
          </span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-2 sm:space-y-3 mb-6 sm:mb-10 inline-flex flex-col items-start"
        >
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-purple-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              Each turn shows <span className="font-semibold text-foreground">3 PL clubs</span> with <span className="font-semibold text-foreground">1x, 2x, 3x</span> point multipliers
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-indigo-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Star className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              Name a goalscorer at one of those clubs &mdash; each guess must beat the <span className="font-semibold text-foreground">previous player's goal tally</span>. Only their <span className="font-semibold text-foreground">goals at that single club</span> count
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-cyan-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Timer className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              <span className="font-semibold text-foreground">{TURN_TIME}s per turn</span> &middot; keep climbing until you run out of players who can beat the total
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-emerald-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              <span className="font-semibold text-foreground">1 shield</span> saves you from a wrong answer or timeout &middot; <span className="font-semibold text-foreground">1 pass</span> redraws the clubs
            </p>
          </div>
        </motion.div>

        {highScore > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mb-4 sm:mb-8 flex items-center justify-center gap-2"
          >
            <Trophy className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-lg text-amber-400">{highScore} pts</span>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Button
            onClick={onStart}
            size="lg"
            className={`text-lg px-12 py-6 font-bold ${theme.primaryBtn}`}
          >
            Start Game
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}

// --- End Screen ---

function EndScreen({
  turnResults,
  totalScore,
  highScore,
  endReason,
  failFeedback,
  threshold,
  onRestart,
  onHome,
}: {
  turnResults: TurnResult[];
  totalScore: number;
  highScore: number;
  endReason: string;
  failFeedback: {
    reason: FailReason;
    guess: string;
    playerName?: string;
    clubGoals?: { club: string; goals: number }[];
  } | null;
  threshold: number;
  onRestart: () => void;
  onHome: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const { user } = useUser();
  const isNewHighScore = totalScore >= highScore && totalScore > 0;
  const scoringRounds = turnResults.filter((r) => r.finalPoints > 0);
  const bestRound = scoringRounds.length > 0
    ? scoringRounds.reduce((best, r) => (r.finalPoints > best.finalPoints ? r : best))
    : null;
  const peakThreshold = turnResults.length > 0
    ? Math.max(...turnResults.map((r) => r.threshold))
    : 0;

  const handleShare = async () => {
    const text = `I scored ${totalScore.toLocaleString()} on LadderUp ⚽ Can you beat me?\nhttps://drapk.in/clubladder`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    if (isNewHighScore) {
      playHighScore();
    } else {
      playGameEnd();
    }
    try { (window as any).goatcounter?.count({ path: `game-played-ladderup?${Date.now()}`, title: `LadderUp: ${totalScore}pts`, event: true }); } catch {}
    saveScore(user?.username, "clubladder", totalScore);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 py-12 relative overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none">
        {isNewHighScore && (
          <>
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl animate-pulse-glow" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500/8 rounded-full blur-3xl animate-pulse-glow" />
          </>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-lg w-full relative z-10"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between gap-3 sm:hidden mb-3">
            <Button onClick={onHome} variant="outline" size="lg" className={`${theme.outlineBtn} flex-1`}>
              <Home className="w-5 h-5 mr-2" />
              Home
            </Button>
            <Button onClick={handleShare} variant="outline" size="lg" className="font-bold flex-1 border-purple-500/40 text-purple-400 hover:bg-purple-500/10">
              <Share2 className="w-5 h-5 mr-2" />
              {copied ? "Copied!" : "Share"}
            </Button>
          </div>
          <div className="flex justify-center sm:hidden">
            <Button
              onClick={onRestart}
              size="lg"
              className={`text-lg px-10 font-bold w-full ${theme.primaryBtn}`}
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Play Again
            </Button>
          </div>
          <div className="hidden sm:flex items-center justify-center gap-3">
            <Button onClick={onHome} variant="outline" size="lg" className={theme.outlineBtn}>
              <Home className="w-5 h-5 mr-2" />
              Home
            </Button>
            <Button
              onClick={onRestart}
              size="lg"
              className={`text-lg px-10 font-bold ${theme.primaryBtn}`}
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Play Again
            </Button>
            <Button onClick={handleShare} variant="outline" size="lg" className="font-bold border-purple-500/40 text-purple-400 hover:bg-purple-500/10">
              <Share2 className="w-5 h-5 mr-2" />
              {copied ? "Copied!" : "Share"}
            </Button>
          </div>
        </motion.div>

        {isNewHighScore && (
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            className="mb-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/15 to-indigo-600/10 border border-purple-500/20 text-purple-400 font-bold text-sm shadow-lg shadow-purple-500/10"
          >
            <Star className="w-4 h-4 fill-current" />
            New High Score!
          </motion.div>
        )}

        {/* Score — headline */}
        <motion.div
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
          className="mb-2"
        >
          <div className="text-8xl font-black tabular-nums bg-gradient-to-b from-foreground via-foreground to-foreground/40 bg-clip-text text-transparent">
            {totalScore}
          </div>
          <div className="text-muted-foreground text-xs uppercase tracking-widest mt-1">
            points
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-4"
        >
          <div className="text-muted-foreground text-[10px] uppercase tracking-widest mb-2">
            {endReason}
          </div>
          {failFeedback && (
            <div className="inline-block px-4 py-2 rounded-md border border-red-500/20 bg-red-500/5 text-left max-w-sm">
              <FailDetail feedback={failFeedback} threshold={threshold} />
            </div>
          )}
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="flex items-center justify-center gap-6 mb-8 mt-4"
        >
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{scoringRounds.length}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">turns</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">{peakThreshold}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">highest climb</div>
          </div>
          {bestRound && (
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">+{bestRound.finalPoints}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">best</div>
            </div>
          )}
        </motion.div>

        {/* Turn history — goals prominent, turn number greyed */}
        {turnResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-4 mb-8"
          >
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Climb History
            </h3>
            <div className="space-y-1.5 max-w-md mx-auto max-h-[500px] overflow-y-auto">
              {turnResults.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.04 }}
                  className={`px-3 py-1.5 rounded-md text-xs ${
                    r.wasPass
                      ? "bg-card/30 border border-border/20"
                      : r.finalPoints > 0
                        ? "bg-card border border-border/30"
                        : "bg-card/50 border border-border/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground/30 font-mono w-4 text-right tabular-nums text-[10px]">
                      {r.turnNum}
                    </span>
                    {r.player ? (
                      <>
                        <span className="text-base font-black text-purple-400 tabular-nums w-8 text-right leading-none">
                          {r.clubGoals}
                        </span>
                        <span className="text-muted-foreground/30 text-[10px]">g</span>
                        <span className="font-semibold text-foreground/80 flex-1 text-left truncate text-[11px]">
                          {r.player.displayName}
                        </span>
                        <span className="text-muted-foreground/40 text-[10px] truncate" style={{ maxWidth: "4.5rem" }}>
                          {r.club}
                        </span>
                        <span
                          className={`font-bold tabular-nums w-10 text-right text-emerald-400`}
                        >
                          +{r.finalPoints}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/40 flex-1 text-left">
                        {r.wasPass ? "pass" : "—"}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
