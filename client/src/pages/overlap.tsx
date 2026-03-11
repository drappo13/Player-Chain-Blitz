import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import plPlayers from "@/data/pl-players.json";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Trophy, ChevronRight, RotateCcw, Star, Home, Flag, Zap, SkipForward, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { playWrong, playNeutral, playTick, playGameEnd, playHighScore, playScoreSound } from "@/lib/sounds";
import { gameThemes } from "@/lib/game-themes";

const theme = gameThemes.overlap;

const GAME_DURATION = 120;
const COMBO_WINDOW = 9;
const MAX_SKIPS = 1;
const WRONG_PENALTY = 3;

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

interface ClubPair {
  clubA: string;
  clubB: string;
  players: PLPlayer[];
  difficulty: "easy" | "medium" | "hard";
  eraWeight: number; // 1-3, higher = more recent players
}

interface RoundResult {
  id: number;
  clubA: string;
  clubB: string;
  player: PLPlayer | null;
  appsA: number;
  appsB: number;
  goalsA: number;
  goalsB: number;
  basePoints: number;
  bonuses: number;
  comboMultiplier: number;
  finalPoints: number;
  wasInvalid: boolean;
  invalidReason: string;
  wasSkip: boolean;
}

type GameState = "idle" | "playing" | "finished";

// --- Name normalization (from TargetMan) ---

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

// --- Build lookup: normalized name -> PLPlayer[] ---

function buildPlayerLookup(): Map<string, PLPlayer[]> {
  const lookup = new Map<string, PLPlayer[]>();

  function addToLookup(key: string, player: PLPlayer) {
    const norm = normalizeName(key);
    if (!norm) return;
    const existing = lookup.get(norm);
    if (existing) {
      // Don't add duplicates (same displayName)
      if (!existing.some((p) => p.displayName === player.displayName)) {
        existing.push(player);
      }
    } else {
      lookup.set(norm, [player]);
    }
  }

  for (const p of plPlayers as PLPlayer[]) {
    // Official last name
    addToLookup(p.lastName, p);

    // Common surname from display name
    const commonSurname = getCommonSurname(p);
    if (commonSurname !== p.lastName) {
      addToLookup(commonSurname, p);
    }

    // Full display name
    addToLookup(p.displayName, p);

    // Parts of multi-word last names
    const lastNameParts = p.lastName.split(/\s+/);
    if (lastNameParts.length > 1) {
      for (const part of lastNameParts) {
        if (part.length > 2) {
          addToLookup(part, p);
        }
      }
    }
  }

  // Alternates
  const alternates: Record<string, string> = {
    vannistelrooij: "vannistelrooy",
    nistelrooij: "nistelrooy",
  };
  for (const [alt, official] of Object.entries(alternates)) {
    const target = lookup.get(official);
    if (target && !lookup.has(alt)) {
      lookup.set(alt, target);
    }
  }

  return lookup;
}

// --- DOB parsing & era weighting ---

const MONTH_MAP: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function parseBirthYear(dob: string): number | null {
  // Format: "29 November 1973"
  const parts = dob.trim().split(/\s+/);
  if (parts.length >= 3) {
    const year = parseInt(parts[2]);
    if (!isNaN(year) && year > 1900 && year < 2010) return year;
  }
  return null;
}

function computeEraWeight(players: PLPlayer[]): number {
  // Average birth year of players in this pair, mapped to 1-3 weight
  // Youngest avg (~2000) = 3x, oldest avg (~1965) = 1x
  const years = players.map((p) => parseBirthYear(p.dob)).filter((y): y is number => y !== null);
  if (years.length === 0) return 2; // neutral default
  const avgYear = years.reduce((a, b) => a + b, 0) / years.length;
  // Linear scale: 1965 -> 1.0, 2000 -> 3.0
  const t = Math.max(0, Math.min(1, (avgYear - 1965) / (2000 - 1965)));
  return 1 + t * 2;
}

// --- Build club pairs ---

function buildClubPairs(): ClubPair[] {
  const pairMap = new Map<string, PLPlayer[]>();

  for (const p of plPlayers as PLPlayer[]) {
    const clubs = Object.keys(p.clubs);
    for (let i = 0; i < clubs.length; i++) {
      for (let j = i + 1; j < clubs.length; j++) {
        const key = [clubs[i], clubs[j]].sort().join("|");
        if (!pairMap.has(key)) pairMap.set(key, []);
        pairMap.get(key)!.push(p);
      }
    }
  }

  const pairs: ClubPair[] = [];
  for (const [key, players] of pairMap) {
    if (players.length < 2) continue;
    const [clubA, clubB] = key.split("|");
    const difficulty =
      players.length >= 8 ? "easy" : players.length >= 4 ? "medium" : "hard";
    pairs.push({ clubA, clubB, players, difficulty, eraWeight: computeEraWeight(players) });
  }

  return pairs;
}

// --- Scoring ---

function calculateBaseScore(minApps: number): number {
  if (minApps >= 100) return 8;
  if (minApps >= 50) return 12;
  if (minApps >= 25) return 18;
  if (minApps >= 10) return 26;
  return 36;
}

function calculateBonuses(
  appsA: number,
  appsB: number,
  goalsA: number,
  goalsB: number,
  minApps: number
): { total: number; labels: string[] } {
  let total = 0;
  const labels: string[] = [];

  // Substantial overlap bonus
  if (appsA >= 25 && appsB >= 25) {
    total += 8;
    labels.push("Overlap +8");
  } else if (appsA >= 10 && appsB >= 10) {
    total += 4;
    labels.push("Overlap +4");
  }

  // Goal bonus
  if (goalsA >= 1 && goalsB >= 1) {
    total += 4;
    labels.push("Goals +4");
  }

  // Micro-cameo bonus
  if (minApps <= 3) {
    total += 4;
    labels.push("Cameo +4");
  }

  return { total, labels };
}

function getComboMultiplier(streak: number): number {
  if (streak <= 1) return 1.0;
  if (streak === 2) return 1.2;
  if (streak === 3) return 1.4;
  if (streak === 4) return 1.7;
  return 2.0;
}

function getComboLevel(streak: number): { label: string; color: string; bgClass: string } {
  if (streak >= 5)
    return { label: "MAX COMBO", color: "text-amber-400", bgClass: "bg-amber-500/10" };
  if (streak >= 4)
    return { label: "MEGA COMBO", color: "text-orange-400", bgClass: "bg-orange-500/8" };
  if (streak >= 3)
    return { label: "COMBO x3", color: "text-yellow-400", bgClass: "bg-yellow-500/6" };
  if (streak >= 2)
    return { label: "COMBO x2", color: "text-emerald-400", bgClass: "bg-emerald-500/5" };
  return { label: "", color: "", bgClass: "" };
}

// --- Big six & pair picking ---

const BIG_SIX = new Set(["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Tottenham"]);

function isBigSixPair(pair: ClubPair): boolean {
  return BIG_SIX.has(pair.clubA) || BIG_SIX.has(pair.clubB);
}

function weightedPickFromBucket(bucket: ClubPair[]): ClubPair {
  // Weight = big six bonus (2x if big six) * era weight (1-3x, recent = higher)
  const weighted: { pair: ClubPair; weight: number }[] = bucket.map((p) => ({
    pair: p,
    weight: (isBigSixPair(p) ? 2 : 1) * p.eraWeight,
  }));
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let r = Math.random() * totalWeight;
  for (const w of weighted) {
    r -= w.weight;
    if (r <= 0) return w.pair;
  }
  return weighted[weighted.length - 1].pair;
}

function pickPair(
  pairs: ClubPair[],
  usedPairKeys: Set<string>
): ClubPair | null {
  // Bucket by difficulty
  const easy = pairs.filter((p) => p.difficulty === "easy" && !usedPairKeys.has(p.clubA + "|" + p.clubB));
  const medium = pairs.filter((p) => p.difficulty === "medium" && !usedPairKeys.has(p.clubA + "|" + p.clubB));
  const hard = pairs.filter((p) => p.difficulty === "hard" && !usedPairKeys.has(p.clubA + "|" + p.clubB));

  // Distribution: 50% easy, 35% medium, 15% hard
  const roll = Math.random();
  let bucket = roll < 0.5 ? easy : roll < 0.85 ? medium : hard;

  // Fallback if bucket empty
  if (bucket.length === 0) bucket = easy.length > 0 ? easy : medium.length > 0 ? medium : hard;
  if (bucket.length === 0) return null;

  return weightedPickFromBucket(bucket);
}

// --- Component ---

export default function Overlap() {
  const [, navigate] = useLocation();

  const playerLookup = useMemo(() => buildPlayerLookup(), []);
  const allPairs = useMemo(() => buildClubPairs(), []);

  const [gameState, setGameState] = useState<GameState>("idle");
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [currentPair, setCurrentPair] = useState<ClubPair | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [usedPlayerKeys, setUsedPlayerKeys] = useState<Set<string>>(new Set());
  const [usedPairKeys, setUsedPairKeys] = useState<Set<string>>(new Set());
  const [totalScore, setTotalScore] = useState(0);
  const [roundCount, setRoundCount] = useState(0);
  const [comboStreak, setComboStreak] = useState(0);
  const [skipsLeft, setSkipsLeft] = useState(MAX_SKIPS);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(sessionStorage.getItem("overlap-highscore") || "0");
    } catch {
      return 0;
    }
  });

  // Round feedback
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [showCorrect, setShowCorrect] = useState(false);
  const [showWrong, setShowWrong] = useState(false);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);

  // Combo timer
  const [comboTimeLeft, setComboTimeLeft] = useState(COMBO_WINDOW);
  const [comboActive, setComboActive] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const comboTimerRef = useRef<NodeJS.Timeout | null>(null);
  const roundStartRef = useRef<number>(Date.now());

  const pickNewPair = useCallback(() => {
    const pair = pickPair(allPairs, usedPairKeys);
    if (pair) {
      setCurrentPair(pair);
      setUsedPairKeys((prev) => new Set(prev).add(pair.clubA + "|" + pair.clubB));
    }
    setComboTimeLeft(COMBO_WINDOW);
    setComboActive(true);
    roundStartRef.current = Date.now();
  }, [allPairs, usedPairKeys]);

  const startGame = useCallback(() => {
    setGameState("playing");
    setTimeLeft(GAME_DURATION);
    setInputValue("");
    setUsedPlayerKeys(new Set());
    setUsedPairKeys(new Set());
    setTotalScore(0);
    setRoundCount(0);
    setComboStreak(0);
    setSkipsLeft(MAX_SKIPS);
    setLastResult(null);
    setShowCorrect(false);
    setShowWrong(false);
    setRoundResults([]);

    // Pick first pair directly
    const pair = pickPair(allPairs, new Set());
    if (pair) {
      setCurrentPair(pair);
      setUsedPairKeys(new Set([pair.clubA + "|" + pair.clubB]));
    }
    setComboTimeLeft(COMBO_WINDOW);
    setComboActive(true);
    roundStartRef.current = Date.now();

    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100);
  }, [allPairs]);

  const goHome = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (comboTimerRef.current) clearInterval(comboTimerRef.current);
    timerRef.current = null;
    comboTimerRef.current = null;
    navigate("/");
  }, [navigate]);

  const endGame = useCallback(() => {
    setGameState("finished");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (comboTimerRef.current) {
      clearInterval(comboTimerRef.current);
      comboTimerRef.current = null;
    }
    setTotalScore((prev) => {
      if (prev > highScore) {
        setHighScore(prev);
        try {
          sessionStorage.setItem("overlap-highscore", prev.toString());
        } catch {}
      }
      return prev;
    });
  }, [highScore]);

  // Main game timer
  useEffect(() => {
    if (gameState === "playing") {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          if (prev <= 11) playTick();
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, endGame]);

  // Combo countdown timer
  useEffect(() => {
    if (gameState === "playing" && comboActive) {
      comboTimerRef.current = setInterval(() => {
        setComboTimeLeft((prev) => {
          if (prev <= 0.1) {
            setComboActive(false);
            return 0;
          }
          return prev - 0.1;
        });
      }, 100);
    }
    return () => {
      if (comboTimerRef.current) clearInterval(comboTimerRef.current);
    };
  }, [gameState, comboActive, currentPair]);

  const handleSkip = useCallback(() => {
    if (gameState !== "playing" || skipsLeft <= 0 || !currentPair) return;
    setSkipsLeft((prev) => prev - 1);
    setComboStreak(0);
    setLastResult({
      id: Date.now(),
      clubA: currentPair.clubA,
      clubB: currentPair.clubB,
      player: null,
      appsA: 0,
      appsB: 0,
      goalsA: 0,
      goalsB: 0,
      basePoints: 0,
      bonuses: 0,
      comboMultiplier: 1,
      finalPoints: 0,
      wasInvalid: false,
      invalidReason: "",
      wasSkip: true,
    });
    setInputValue("");
    pickNewPair();
  }, [gameState, skipsLeft, currentPair, pickNewPair]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (gameState !== "playing" || !currentPair) return;

      const guess = inputValue.trim();
      if (!guess) return;

      const guessNorm = normalizeName(guess);
      const candidates = playerLookup.get(guessNorm);
      const wasWithinComboWindow = comboActive && comboTimeLeft > 0;

      const makeInvalidResult = (
        reason: string,
        player: PLPlayer | null = null
      ): RoundResult => ({
        id: Date.now(),
        clubA: currentPair.clubA,
        clubB: currentPair.clubB,
        player,
        appsA: 0,
        appsB: 0,
        goalsA: 0,
        goalsB: 0,
        basePoints: 0,
        bonuses: 0,
        comboMultiplier: 1,
        finalPoints: 0,
        wasInvalid: true,
        invalidReason: reason,
        wasSkip: false,
      });

      // Not found in dataset at all — wrong, penalty, stay on same pair
      if (!candidates || candidates.length === 0) {
        setShowWrong(true);
        playWrong();
        setTimeout(() => setShowWrong(false), 400);
        setComboStreak(0);
        setTimeLeft((prev) => {
          const next = Math.max(0, prev - WRONG_PENALTY);
          if (next <= 0) setTimeout(() => endGame(), 0);
          return next;
        });
        const result = makeInvalidResult("Not found");
        setLastResult(result);
        setRoundResults((prev) => [...prev, result]);
        setInputValue("");
        return;
      }

      // Find a candidate who played for both clubs and hasn't been used
      let matchedPlayer: PLPlayer | null = null;
      for (const c of candidates) {
        const playerKey = c.displayName.toLowerCase();
        if (usedPlayerKeys.has(playerKey)) continue;
        if (c.clubs[currentPair.clubA] && c.clubs[currentPair.clubB]) {
          matchedPlayer = c;
          break;
        }
      }

      if (!matchedPlayer) {
        // Check specific failure reason
        const anyUsed = candidates.some((c) => usedPlayerKeys.has(c.displayName.toLowerCase()));
        const anyMatch = candidates.some(
          (c) => c.clubs[currentPair.clubA] && c.clubs[currentPair.clubB]
        );

        if (anyUsed && anyMatch) {
          // Already used — wrong, penalty, stay on same pair
          const shownPlayer = candidates.find(
            (c) =>
              usedPlayerKeys.has(c.displayName.toLowerCase()) &&
              c.clubs[currentPair.clubA] &&
              c.clubs[currentPair.clubB]
          ) || candidates[0];
          setShowWrong(true);
          playWrong();
          setTimeout(() => setShowWrong(false), 400);
          setComboStreak(0);
          setTimeLeft((prev) => {
            const next = Math.max(0, prev - WRONG_PENALTY);
            if (next <= 0) setTimeout(() => endGame(), 0);
            return next;
          });
          const result = makeInvalidResult("Already used", shownPlayer);
          setLastResult(result);
          setRoundResults((prev) => [...prev, result]);
          setInputValue("");
          return;
        }

        // Check if player played for at least one of the two clubs
        const oneClubPlayer = candidates.find(
          (c) =>
            !usedPlayerKeys.has(c.displayName.toLowerCase()) &&
            (c.clubs[currentPair.clubA] || c.clubs[currentPair.clubB])
        );

        if (oneClubPlayer) {
          // Played for only one club — 0 points, combo reset, advance to next pair
          const playerKey = oneClubPlayer.displayName.toLowerCase();
          setUsedPlayerKeys((prev) => new Set(prev).add(playerKey));
          setComboStreak(0);
          playNeutral();

          const playedA = oneClubPlayer.clubs[currentPair.clubA];
          const playedB = oneClubPlayer.clubs[currentPair.clubB];
          const result: RoundResult = {
            id: Date.now(),
            clubA: currentPair.clubA,
            clubB: currentPair.clubB,
            player: oneClubPlayer,
            appsA: playedA ? playedA.appearances : 0,
            appsB: playedB ? playedB.appearances : 0,
            goalsA: playedA ? playedA.goals : 0,
            goalsB: playedB ? playedB.goals : 0,
            basePoints: 0,
            bonuses: 0,
            comboMultiplier: 1,
            finalPoints: 0,
            wasInvalid: false,
            invalidReason: "Only one club",
            wasSkip: false,
          };
          setLastResult(result);
          setRoundResults((prev) => [...prev, result]);
          setInputValue("");
          pickNewPair();
          return;
        }

        // Player exists but played for neither club — wrong, penalty, stay on same pair
        setShowWrong(true);
        playWrong();
        setTimeout(() => setShowWrong(false), 400);
        setComboStreak(0);
        setTimeLeft((prev) => {
          const next = Math.max(0, prev - WRONG_PENALTY);
          if (next <= 0) setTimeout(() => endGame(), 0);
          return next;
        });
        const result = makeInvalidResult("Played for neither", candidates[0]);
        setLastResult(result);
        setRoundResults((prev) => [...prev, result]);
        setInputValue("");
        return;
      }

      // Valid answer!
      const playerKey = matchedPlayer.displayName.toLowerCase();
      setUsedPlayerKeys((prev) => new Set(prev).add(playerKey));
      setRoundCount((prev) => prev + 1);

      const clubDataA = matchedPlayer.clubs[currentPair.clubA];
      const clubDataB = matchedPlayer.clubs[currentPair.clubB];
      const appsA = clubDataA.appearances;
      const appsB = clubDataB.appearances;
      const goalsA = clubDataA.goals;
      const goalsB = clubDataB.goals;
      const minApps = Math.min(appsA, appsB);
      const totalApps = appsA + appsB;

      const basePoints = calculateBaseScore(minApps);
      const { total: bonusPoints } = calculateBonuses(appsA, appsB, goalsA, goalsB, minApps);

      let preComboScore = basePoints + bonusPoints;

      // Anti-cheese
      if (totalApps < 15) {
        preComboScore = Math.round(preComboScore * 0.8);
      }

      // Combo
      let newComboStreak = wasWithinComboWindow ? comboStreak + 1 : 1;
      setComboStreak(newComboStreak);

      const comboMult = getComboMultiplier(newComboStreak);
      const finalPoints = Math.round(preComboScore * comboMult);

      // Sound
      playScoreSound({
        finalPoints,
        basePoints: preComboScore,
        isExact: preComboScore >= 40,
        isBoostHit: false,
        comboStreak: newComboStreak,
      });

      setShowCorrect(true);
      setTimeout(() => setShowCorrect(false), 500);

      setTotalScore((prev) => prev + finalPoints);

      const result: RoundResult = {
        id: Date.now(),
        clubA: currentPair.clubA,
        clubB: currentPair.clubB,
        player: matchedPlayer,
        appsA,
        appsB,
        goalsA,
        goalsB,
        basePoints: preComboScore,
        bonuses: bonusPoints,
        comboMultiplier: comboMult,
        finalPoints,
        wasInvalid: false,
        invalidReason: "",
        wasSkip: false,
      };
      setLastResult(result);
      setRoundResults((prev) => [...prev, result]);

      setInputValue("");
      pickNewPair();
    },
    [
      gameState,
      inputValue,
      currentPair,
      usedPlayerKeys,
      playerLookup,
      comboActive,
      comboTimeLeft,
      comboStreak,
      pickNewPair,
      endGame,
    ]
  );

  const timerPercent = (timeLeft / GAME_DURATION) * 100;
  const isUrgent = timeLeft <= 10;
  const isWarning = timeLeft <= 30;
  const comboPercent = (comboTimeLeft / COMBO_WINDOW) * 100;
  const comboMult = getComboMultiplier(comboStreak);
  const comboLevel = getComboLevel(comboStreak);

  const comboTier =
    comboStreak >= 5 ? 3 : comboStreak >= 4 ? 2 : comboStreak >= 3 ? 1 : 0;
  const floatingEmojis = useMemo(() => {
    if (comboStreak < 2) return [];
    const emoji = comboStreak >= 5 ? "🔥" : comboStreak >= 3 ? "⚡" : "🔗";
    const count = comboTier === 3 ? 10 : comboTier === 2 ? 7 : comboTier === 1 ? 4 : 2;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      emoji,
      left: `${5 + Math.random() * 90}%`,
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 4,
      size: 14 + Math.random() * 14,
    }));
  }, [comboStreak >= 5 ? 5 : comboStreak >= 3 ? 3 : comboStreak >= 2 ? 2 : 0]);

  if (gameState === "idle") {
    return <StartScreen highScore={highScore} onStart={startGame} onHome={goHome} />;
  }

  if (gameState === "finished") {
    return (
      <EndScreen
        roundResults={roundResults}
        totalScore={totalScore}
        highScore={highScore}
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
        {comboLevel.bgClass && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`absolute inset-0 ${comboLevel.bgClass} transition-all duration-700`}
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`absolute top-0 left-0 w-full h-1/2 ${comboLevel.bgClass} blur-3xl`}
            />
          </>
        )}
        <AnimatePresence>
          {floatingEmojis.map((e) => (
            <motion.span
              key={`${e.id}-${comboTier}`}
              initial={{ opacity: 0, y: "100vh" }}
              animate={{ opacity: [0, 0.5, 0.5, 0], y: "-20vh" }}
              exit={{ opacity: 0 }}
              transition={{
                duration: e.duration,
                delay: e.delay,
                repeat: Infinity,
                ease: "linear",
              }}
              className="absolute select-none"
              style={{ left: e.left, fontSize: e.size }}
            >
              {e.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
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
            <div
              className={`p-1.5 rounded-md ${isUrgent ? "bg-red-500/20" : isWarning ? "bg-amber-500/15" : theme.timerIcon}`}
            >
              <Timer
                className={`w-4 h-4 ${isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : theme.timerIconColor}`}
              />
            </div>
            <span
              className={`text-2xl font-mono font-bold tabular-nums ${isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : "text-foreground"} ${isUrgent ? "animate-countdown-pulse" : ""}`}
            >
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {comboStreak >= 2 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span className="text-xs font-bold text-amber-400 tabular-nums">{comboMult}x</span>
              </motion.div>
            )}

            {highScore > 0 && (
              <div className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-sm font-medium text-amber-400/80">{highScore}</span>
              </div>
            )}
            <button
              onClick={endGame}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Flag className="w-3.5 h-3.5" />
              End
            </button>
          </div>
        </div>

        {/* Main timer bar */}
        <div className="w-full h-1 rounded-full bg-muted/50 mb-3 sm:mb-4">
          <motion.div
            className={`h-full rounded-full ${isUrgent ? "bg-red-500" : isWarning ? "bg-amber-500" : theme.timerBar}`}
            style={{ width: `${timerPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="sm:flex-1 flex flex-col items-center min-h-0">
          {/* Score display */}
          <div className="flex items-center gap-4 sm:flex-col sm:gap-0 mb-2 sm:mb-2">
            <motion.div
              key={totalScore}
              className="text-center"
              animate={totalScore > 0 ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.2 }}
            >
              <div className="text-4xl sm:text-5xl font-bold tabular-nums bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">
                {totalScore}
              </div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                points
              </span>
            </motion.div>

            {/* Skips remaining */}
            <div className="flex items-center gap-1.5 sm:mt-2">
              <SkipForward className="w-3.5 h-3.5 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground/60 tabular-nums">
                {skipsLeft} skip{skipsLeft !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Combo streak label */}
          <AnimatePresence>
            {comboLevel.label && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full mb-2 text-xs font-bold uppercase tracking-wider ${comboLevel.color} bg-card border border-border`}
              >
                <Zap className="w-3.5 h-3.5" />
                {comboLevel.label} {comboMult}x
              </motion.div>
            )}
          </AnimatePresence>

          {/* Last result feedback */}
          <AnimatePresence mode="wait">
            {lastResult && (
              <motion.div
                key={lastResult.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`mb-3 sm:mb-4 px-4 py-2 rounded-md border w-full max-w-sm ${
                  lastResult.wasSkip
                    ? "bg-muted/30 border-border/40"
                    : lastResult.wasInvalid
                      ? "bg-red-500/5 border-red-500/20"
                      : lastResult.invalidReason === "Only one club"
                        ? "bg-amber-500/5 border-amber-500/20"
                        : lastResult.finalPoints >= 30
                          ? "bg-blue-500/10 border-blue-500/30"
                          : "bg-emerald-500/5 border-emerald-500/20"
                }`}
              >
                {lastResult.wasSkip ? (
                  <div className="text-center text-sm text-muted-foreground font-medium">
                    Skipped
                  </div>
                ) : lastResult.wasInvalid ? (
                  <div className="text-center text-sm text-red-400 font-medium">
                    {lastResult.invalidReason}
                    {lastResult.player && (
                      <span className="text-red-400/60"> &middot; {lastResult.player.displayName}</span>
                    )}
                    <span className="text-red-400/60"> &middot; -{WRONG_PENALTY}s</span>
                  </div>
                ) : lastResult.invalidReason === "Only one club" ? (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-bold text-foreground text-sm">
                          {lastResult.player?.displayName}
                        </span>
                        <span className="text-amber-400/80 text-xs ml-1.5">only one club</span>
                      </div>
                      <span className="font-bold tabular-nums text-sm text-amber-400/60">0</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className={lastResult.appsA > 0 ? "" : "text-muted-foreground/30"}>
                        {lastResult.clubA}: {lastResult.appsA > 0 ? `${lastResult.appsA} apps` : "—"}
                      </span>
                      <span className="text-muted-foreground/30">&middot;</span>
                      <span className={lastResult.appsB > 0 ? "" : "text-muted-foreground/30"}>
                        {lastResult.clubB}: {lastResult.appsB > 0 ? `${lastResult.appsB} apps` : "—"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-bold text-foreground text-sm">
                          {lastResult.player?.displayName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {lastResult.comboMultiplier > 1 && (
                          <span className="text-[10px] text-amber-400 font-bold">
                            {lastResult.comboMultiplier}x
                          </span>
                        )}
                        <span className="font-bold tabular-nums text-sm text-emerald-400">
                          +{lastResult.finalPoints}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>
                        {lastResult.clubA}: {lastResult.appsA} apps
                        {lastResult.goalsA > 0 && `, ${lastResult.goalsA}g`}
                      </span>
                      <span className="text-muted-foreground/30">&middot;</span>
                      <span>
                        {lastResult.clubB}: {lastResult.appsB} apps
                        {lastResult.goalsB > 0 && `, ${lastResult.goalsB}g`}
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Club pair display */}
          {currentPair && (
            <motion.div
              key={currentPair.clubA + currentPair.clubB}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="text-center mb-1"
            >
              <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest">
                Name a player who played for both
              </span>
              <div className="flex items-center justify-center gap-3 sm:gap-4 mt-2 mb-1">
                <div className="text-2xl sm:text-4xl font-black bg-gradient-to-b from-blue-400 to-blue-600 bg-clip-text text-transparent">
                  {currentPair.clubA}
                </div>
                <div className="text-xl sm:text-2xl text-muted-foreground/40 font-bold">&</div>
                <div className="text-2xl sm:text-4xl font-black bg-gradient-to-b from-cyan-400 to-cyan-600 bg-clip-text text-transparent">
                  {currentPair.clubB}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">
                {currentPair.difficulty}
              </span>
            </motion.div>
          )}

          {/* Combo speed ring */}
          <div className="relative w-12 h-12 mb-3 sm:mb-4 mt-2">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-muted/30"
              />
              <motion.circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 20}
                strokeDashoffset={2 * Math.PI * 20 * (1 - comboPercent / 100)}
                className={
                  comboPercent > 50
                    ? "stroke-blue-400"
                    : comboPercent > 25
                      ? "stroke-amber-400"
                      : comboPercent > 0
                        ? "stroke-red-400"
                        : "stroke-muted/10"
                }
                transition={{ duration: 0.1 }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {comboActive && comboTimeLeft > 0 ? (
                <Zap
                  className={`w-4 h-4 ${comboPercent > 50 ? "text-blue-400" : comboPercent > 25 ? "text-amber-400" : "text-red-400"}`}
                />
              ) : (
                <span className="text-muted-foreground/30 text-[10px] font-bold">--</span>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="w-full max-w-md mx-auto mb-2 sm:mb-4 sm:mt-auto">
            <form onSubmit={handleSubmit} className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Name a player..."
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
                {skipsLeft > 0 && (
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="p-2 rounded-md text-muted-foreground/40 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                    title="Skip"
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
            </p>
          </div>
        </div>
      </div>

      {/* Correct flash */}
      <AnimatePresence>
        {showCorrect && lastResult && !lastResult.wasInvalid && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 pointer-events-none z-50"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: lastResult.basePoints >= 30 ? 0.1 : 0.04 }}
              exit={{ opacity: 0 }}
              className={`absolute inset-0 ${lastResult.basePoints >= 30 ? "bg-blue-500" : "bg-emerald-500"}`}
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
          className="w-16 h-16 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-8 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/5 border border-blue-500/20 flex items-center justify-center shadow-xl shadow-blue-500/10"
        >
          <GitMerge className="w-8 h-8 sm:w-12 sm:h-12 text-blue-400" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl sm:text-5xl font-black text-foreground mb-4 sm:mb-8 tracking-tight"
        >
          Over
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            lap
          </span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-2 sm:space-y-3 mb-6 sm:mb-10 inline-flex flex-col items-start"
        >
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-blue-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <GitMerge className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              Name a player who made <span className="font-semibold text-foreground">PL appearances for both clubs</span>
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-cyan-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Star className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              Obscure overlaps score <span className="font-semibold text-foreground">more points</span> than obvious ones
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-yellow-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              Answer within <span className="font-semibold text-foreground">9 seconds</span> for combo multipliers
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <SkipForward className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              <span className="font-semibold text-foreground">1 skip</span> per run &middot; wrong answers cost <span className="font-semibold text-foreground">3 seconds</span>
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-red-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Timer className="w-3.5 h-3.5 text-red-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              You have <span className="font-semibold text-foreground">2 minutes</span>
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
  roundResults,
  totalScore,
  highScore,
  onRestart,
  onHome,
}: {
  roundResults: RoundResult[];
  totalScore: number;
  highScore: number;
  onRestart: () => void;
  onHome: () => void;
}) {
  const isNewHighScore = totalScore >= highScore && totalScore > 0;
  const scoringRounds = roundResults.filter((r) => r.finalPoints > 0);
  const bestRound = scoringRounds.length > 0
    ? scoringRounds.reduce((best, r) => (r.finalPoints > best.finalPoints ? r : best))
    : null;

  useEffect(() => {
    if (isNewHighScore) {
      playHighScore();
    } else {
      playGameEnd();
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 py-12 relative overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none">
        {isNewHighScore && (
          <>
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/8 rounded-full blur-3xl animate-pulse-glow" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl animate-pulse-glow" />
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
          className="flex items-center justify-center gap-3 mb-6 flex-wrap"
        >
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
        </motion.div>

        {isNewHighScore && (
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            className="mb-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/15 to-cyan-600/10 border border-blue-500/20 text-blue-400 font-bold text-sm shadow-lg shadow-blue-500/10"
          >
            <Star className="w-4 h-4 fill-current" />
            New High Score!
          </motion.div>
        )}

        <motion.div
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
          className="mb-3"
        >
          <div className="text-8xl font-black tabular-nums bg-gradient-to-b from-foreground via-foreground to-foreground/40 bg-clip-text text-transparent">
            {totalScore}
          </div>
          <div className="text-muted-foreground text-xs uppercase tracking-widest mt-2">
            points from {roundResults.filter((r) => !r.wasSkip).length} answers
          </div>
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
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">correct</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">
              {roundResults.filter((r) => r.wasInvalid).length}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">wrong</div>
          </div>
          {bestRound && (
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">+{bestRound.finalPoints}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">best</div>
            </div>
          )}
        </motion.div>

        {/* Round history */}
        {roundResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-4 mb-8"
          >
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Round History
            </h3>
            <div className="space-y-1.5 max-w-sm mx-auto max-h-[300px] overflow-y-auto">
              {roundResults.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.04 }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs ${
                    r.wasSkip
                      ? "bg-card/30 border border-border/20 opacity-40"
                      : r.finalPoints > 0
                        ? "bg-card border border-border/30"
                        : "bg-card/50 border border-border/20 opacity-60"
                  }`}
                >
                  <span className="font-semibold text-blue-400 w-20 text-left truncate text-[11px]">
                    {r.clubA}
                  </span>
                  <span className="text-muted-foreground/30">&amp;</span>
                  <span className="font-semibold text-cyan-400 w-20 text-left truncate text-[11px]">
                    {r.clubB}
                  </span>
                  <span className="text-muted-foreground/40 mx-0.5">&rarr;</span>
                  <span className="font-semibold text-foreground/80 flex-1 text-left truncate">
                    {r.wasSkip ? "skip" : r.player ? r.player.displayName : "???"}
                  </span>
                  <span
                    className={`font-bold tabular-nums w-10 text-right ${
                      r.finalPoints > 0 ? "text-emerald-400" : "text-red-400/60"
                    }`}
                  >
                    {r.finalPoints > 0 ? `+${r.finalPoints}` : r.wasSkip ? "-" : "0"}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
