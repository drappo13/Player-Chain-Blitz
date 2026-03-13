import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import plPlayers from "@/data/pl-players.json";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Trophy, ChevronRight, RotateCcw, Star, Home, Zap, SkipForward, GitMerge, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { playWrong, playNeutral, playTick, playGameEnd, playHighScore, playScoreSound } from "@/lib/sounds";
import { gameThemes } from "@/lib/game-themes";

const theme = gameThemes.overlap;

const TOTAL_QUESTIONS = 10;
const QUESTION_TIME = 30;

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
  eraWeight: number;
}

interface RoundResult {
  id: number;
  questionNum: number;
  clubA: string;
  clubB: string;
  player: PLPlayer | null;
  appsA: number;
  appsB: number;
  goalsA: number;
  goalsB: number;
  timeScore: number;
  appBonus: number;
  goalBonus: number;
  comboMultiplier: number;
  finalPoints: number;
  elapsed: number;
  wasPass: boolean;
  wasTimeout: boolean;
  topPlayers: { displayName: string; combinedApps: number }[];
  totalAvailable: number;
}

type GameState = "idle" | "playing" | "finished";

// --- Name normalization ---

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

  // Mononym / nickname lookups — players commonly known by first name or single name
  // Maps normalized alias → normalized displayName key
  const mononyms: Record<string, string> = {
    gabriel: "gabrielmagalhaes",
    gilberto: "gilbertosilva",
  };
  for (const [mono, targetKey] of Object.entries(mononyms)) {
    const players = lookup.get(targetKey);
    if (players && !lookup.has(mono)) lookup.set(mono, players);
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

// --- DOB parsing & era weighting ---

function parseBirthYear(dob: string): number | null {
  const parts = dob.trim().split(/\s+/);
  if (parts.length >= 3) {
    const year = parseInt(parts[2]);
    if (!isNaN(year) && year > 1900 && year < 2010) return year;
  }
  return null;
}

function playerAge(p: PLPlayer): number | null {
  const year = parseBirthYear(p.dob);
  if (!year) return null;
  return 2026 - year; // approximate
}

function computeEraWeight(players: PLPlayer[]): number {
  // Weight by player ages: <29 = 5x, 29-33 = 2x, 33-40 = 1x, 40+ = 0.5x
  // Use the best (youngest) weight among players in the pair
  let bestWeight = 0.5;
  for (const p of players) {
    const age = playerAge(p);
    if (age === null) continue;
    let w: number;
    if (age < 29) w = 5;
    else if (age < 33) w = 2;
    else if (age <= 40) w = 1;
    else w = 0.5;
    if (w > bestWeight) bestWeight = w;
  }
  return bestWeight;
}

// --- Build club pairs ---

const BIG_SIX = new Set(["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Tottenham"]);

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
    if (players.length < 4) continue;
    const [clubA, clubB] = key.split("|");
    const difficulty =
      players.length >= 8 ? "easy" : players.length >= 4 ? "medium" : "hard";
    pairs.push({ clubA, clubB, players, difficulty, eraWeight: computeEraWeight(players) });
  }

  return pairs;
}

// --- Scoring ---

function getTimeScore(elapsed: number): number {
  // 50 at 0s, linearly down to 25 at 30s
  const t = Math.min(elapsed, QUESTION_TIME) / QUESTION_TIME;
  return Math.round(50 - t * 25);
}

function getAppBonus(minApps: number): { points: number; label: string } {
  if (minApps <= 3) return { points: 10, label: "Low apps +10" };
  if (minApps <= 9) return { points: 7, label: "Low apps +7" };
  if (minApps <= 24) return { points: 4, label: "Low apps +4" };
  if (minApps <= 49) return { points: 2, label: "Low apps +2" };
  return { points: 0, label: "" };
}

function getGoalBonus(minGoals: number): { points: number; label: string } {
  if (minGoals === 0) return { points: 10, label: "Low goals +10" };
  if (minGoals <= 3) return { points: 7, label: "Low goals +7" };
  if (minGoals <= 9) return { points: 4, label: "Low goals +4" };
  if (minGoals <= 19) return { points: 2, label: "Low goals +2" };
  return { points: 0, label: "" };
}

function getComboMultiplier(streak: number): number {
  if (streak <= 1) return 1.0;
  return 1.0 + (streak - 1) * 0.2; // 1.2, 1.4, 1.6, 1.8, 2.0, 2.2...
}

function getComboLevel(streak: number): { label: string; color: string; bgClass: string } {
  if (streak >= 6)
    return { label: "MEGA COMBO", color: "text-amber-400", bgClass: "bg-amber-500/10" };
  if (streak >= 4)
    return { label: "COMBO", color: "text-orange-400", bgClass: "bg-orange-500/8" };
  if (streak >= 2)
    return { label: "COMBO", color: "text-emerald-400", bgClass: "bg-emerald-500/5" };
  return { label: "", color: "", bgClass: "" };
}

const WRONG_GUESS_PENALTY = 7;

function getTopPlayersForPair(pair: ClubPair, limit = 3): { displayName: string; combinedApps: number }[] {
  return pair.players
    .map((p) => ({
      displayName: p.displayName,
      combinedApps: (p.clubs[pair.clubA]?.appearances || 0) + (p.clubs[pair.clubB]?.appearances || 0),
    }))
    .sort((a, b) => b.combinedApps - a.combinedApps)
    .slice(0, limit);
}

// --- Pair picking ---

function getAnswerCountWeight(count: number): number {
  // Heavily favor pairs with more answers: 20+ = 5x, 12+ = 3x, 8+ = 2x, 6+ = 1.5x, else 1x
  if (count >= 20) return 5;
  if (count >= 12) return 3;
  if (count >= 8) return 2;
  if (count >= 6) return 1.5;
  return 1;
}

function weightedPickFromBucket(bucket: ClubPair[]): ClubPair {
  const weighted = bucket.map((p) => ({
    pair: p,
    weight: (BIG_SIX.has(p.clubA) || BIG_SIX.has(p.clubB) ? 2 : 1) * p.eraWeight * getAnswerCountWeight(p.players.length),
  }));
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let r = Math.random() * totalWeight;
  for (const w of weighted) {
    r -= w.weight;
    if (r <= 0) return w.pair;
  }
  return weighted[weighted.length - 1].pair;
}

function pickPair(pairs: ClubPair[], usedPairKeys: Set<string>): ClubPair | null {
  const easy = pairs.filter((p) => p.difficulty === "easy" && !usedPairKeys.has(p.clubA + "|" + p.clubB));
  const medium = pairs.filter((p) => p.difficulty === "medium" && !usedPairKeys.has(p.clubA + "|" + p.clubB));
  const hard = pairs.filter((p) => p.difficulty === "hard" && !usedPairKeys.has(p.clubA + "|" + p.clubB));

  const roll = Math.random();
  let bucket = roll < 0.5 ? easy : roll < 0.85 ? medium : hard;
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
  const [questionNum, setQuestionNum] = useState(1);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(QUESTION_TIME);
  const [currentPair, setCurrentPair] = useState<ClubPair | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [usedPlayerKeys, setUsedPlayerKeys] = useState<Set<string>>(new Set());
  const [usedPairKeys, setUsedPairKeys] = useState<Set<string>>(new Set());
  const [totalScore, setTotalScore] = useState(0);
  const [comboStreak, setComboStreak] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(sessionStorage.getItem("overlap-highscore") || "0");
    } catch {
      return 0;
    }
  });

  // Feedback state
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [showCorrect, setShowCorrect] = useState(false);
  const [showWrong, setShowWrong] = useState(false);
  const [showOneClub, setShowOneClub] = useState<{ player: PLPlayer; clubA: string; clubB: string; appsA: number; appsB: number } | null>(null);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [showTimeoutReveal, setShowTimeoutReveal] = useState<{ displayName: string; combinedApps: number }[] | null>(null);
  const [showPenalty, setShowPenalty] = useState(false);
  const timeoutAdvanceRef = useRef<NodeJS.Timeout | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const questionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartRef = useRef<number>(Date.now());
  const questionResolvedRef = useRef(false);

  const clearQuestionTimer = useCallback(() => {
    if (questionTimerRef.current) {
      clearInterval(questionTimerRef.current);
      questionTimerRef.current = null;
    }
  }, []);

  const endGame = useCallback(() => {
    setGameState("finished");
    clearQuestionTimer();
    setTotalScore((prev) => {
      if (prev > highScore) {
        setHighScore(prev);
        try {
          sessionStorage.setItem("overlap-highscore", prev.toString());
        } catch {}
      }
      return prev;
    });
  }, [highScore, clearQuestionTimer]);

  const advanceQuestion = useCallback(() => {
    if (timeoutAdvanceRef.current) {
      clearTimeout(timeoutAdvanceRef.current);
      timeoutAdvanceRef.current = null;
    }
    if (questionNum >= TOTAL_QUESTIONS) {
      endGame();
      return;
    }

    const nextNum = questionNum + 1;
    setQuestionNum(nextNum);
    setQuestionTimeLeft(QUESTION_TIME);
    setShowOneClub(null);
    setLastResult(null);
    setShowTimeoutReveal(null);
    questionResolvedRef.current = false;

    const pair = pickPair(allPairs, usedPairKeys);
    if (pair) {
      setCurrentPair(pair);
      setUsedPairKeys((prev) => new Set(prev).add(pair.clubA + "|" + pair.clubB));
    }
    questionStartRef.current = Date.now();
    setInputValue("");
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50);
  }, [questionNum, allPairs, usedPairKeys, endGame]);

  const startGame = useCallback(() => {
    setGameState("playing");
    setQuestionNum(1);
    setQuestionTimeLeft(QUESTION_TIME);
    setInputValue("");
    setUsedPlayerKeys(new Set());
    setUsedPairKeys(new Set());
    setTotalScore(0);
    setComboStreak(0);
    setLastResult(null);
    setShowCorrect(false);
    setShowWrong(false);
    setShowOneClub(null);
    setRoundResults([]);
    setShowTimeoutReveal(null);

    const pair = pickPair(allPairs, new Set());
    if (pair) {
      setCurrentPair(pair);
      setUsedPairKeys(new Set([pair.clubA + "|" + pair.clubB]));
    }
    questionStartRef.current = Date.now();

    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100);
  }, [allPairs]);

  const goHome = useCallback(() => {
    clearQuestionTimer();
    navigate("/");
  }, [navigate, clearQuestionTimer]);

  // Per-question timer — uses ref to track time, avoids side effects in state updaters
  const questionTimeRef = useRef(QUESTION_TIME);

  useEffect(() => {
    if (gameState === "playing") {
      questionTimeRef.current = questionTimeLeft;
      questionResolvedRef.current = false;

      questionTimerRef.current = setInterval(() => {
        if (questionResolvedRef.current) return;

        questionTimeRef.current -= 0.1;
        const t = questionTimeRef.current;

        if (t <= 0) {
          // Timeout — clear timer first to prevent re-firing
          clearQuestionTimer();
          questionResolvedRef.current = true;
          setQuestionTimeLeft(0);

          playWrong();
          setComboStreak(0);
          const topPlayers = currentPair ? getTopPlayersForPair(currentPair, 5) : [];
          const result: RoundResult = {
            id: Date.now(),
            questionNum,
            clubA: currentPair?.clubA || "",
            clubB: currentPair?.clubB || "",
            player: null,
            appsA: 0, appsB: 0, goalsA: 0, goalsB: 0,
            timeScore: 0, appBonus: 0, goalBonus: 0,
            comboMultiplier: 1, finalPoints: 0, elapsed: QUESTION_TIME,
            wasPass: false, wasTimeout: true,
            topPlayers,
            totalAvailable: currentPair?.players.length || 0,
          };
          setLastResult(result);
          setRoundResults((prev) => [...prev, result]);
          setShowTimeoutReveal(topPlayers);
          timeoutAdvanceRef.current = setTimeout(() => advanceQuestion(), 10000);
          return;
        }

        setQuestionTimeLeft(t);
        // Tick on each whole second in the last 5 seconds
        const rounded = Math.round(t * 10) / 10;
        if (rounded <= 5 && Math.abs(rounded - Math.round(rounded)) < 0.05) playTick();
      }, 100);
    }
    return () => clearQuestionTimer();
  }, [gameState, questionNum, currentPair, advanceQuestion, clearQuestionTimer]);

  const handlePass = useCallback(() => {
    if (gameState !== "playing" || !currentPair || questionResolvedRef.current) return;
    questionResolvedRef.current = true;
    clearQuestionTimer();
    setComboStreak(0);
    playNeutral();
    setShowOneClub(null);

    const topPlayers = getTopPlayersForPair(currentPair, 5);
    const result: RoundResult = {
      id: Date.now(),
      questionNum,
      clubA: currentPair.clubA,
      clubB: currentPair.clubB,
      player: null,
      appsA: 0, appsB: 0, goalsA: 0, goalsB: 0,
      timeScore: 0, appBonus: 0, goalBonus: 0,
      comboMultiplier: 1, finalPoints: 0,
      elapsed: (Date.now() - questionStartRef.current) / 1000,
      wasPass: true, wasTimeout: false,
      topPlayers,
      totalAvailable: currentPair.players.length,
    };
    setLastResult(result);
    setRoundResults((prev) => [...prev, result]);
    setInputValue("");
    advanceQuestion();
  }, [gameState, currentPair, questionNum, advanceQuestion, clearQuestionTimer]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (gameState !== "playing" || !currentPair || questionResolvedRef.current) return;

      const guess = inputValue.trim();
      if (!guess) return;

      const guessNorm = normalizeName(guess);
      const candidates = playerLookup.get(guessNorm);

      // Not found in dataset
      if (!candidates || candidates.length === 0) {
        setShowWrong(true);
        playWrong();
        setComboStreak(0);
        questionTimeRef.current = Math.max(0.1, questionTimeRef.current - WRONG_GUESS_PENALTY);
        setShowPenalty(true);
        setTimeout(() => setShowPenalty(false), 800);
        setTimeout(() => setShowWrong(false), 400);
        setInputValue("");
        return;
      }

      // Find candidate who played for both clubs and not used
      let matchedPlayer: PLPlayer | null = null;
      for (const c of candidates) {
        if (usedPlayerKeys.has(c.displayName.toLowerCase())) continue;
        if (c.clubs[currentPair.clubA] && c.clubs[currentPair.clubB]) {
          matchedPlayer = c;
          break;
        }
      }

      if (!matchedPlayer) {
        // Already used?
        const anyUsed = candidates.some((c) => usedPlayerKeys.has(c.displayName.toLowerCase()));
        const anyMatch = candidates.some(
          (c) => c.clubs[currentPair.clubA] && c.clubs[currentPair.clubB]
        );

        if (anyUsed && anyMatch) {
          setShowWrong(true);
          playWrong();
          setComboStreak(0);
          questionTimeRef.current = Math.max(0.1, questionTimeRef.current - WRONG_GUESS_PENALTY);
          setShowPenalty(true);
          setTimeout(() => setShowPenalty(false), 800);
          setTimeout(() => setShowWrong(false), 400);
          setInputValue("");
          return;
        }

        // One club only?
        const oneClubPlayer = candidates.find(
          (c) =>
            !usedPlayerKeys.has(c.displayName.toLowerCase()) &&
            (c.clubs[currentPair.clubA] || c.clubs[currentPair.clubB])
        );

        if (oneClubPlayer) {
          playWrong();
          setComboStreak(0);
          questionTimeRef.current = Math.max(0.1, questionTimeRef.current - WRONG_GUESS_PENALTY);
          setShowPenalty(true);
          setTimeout(() => setShowPenalty(false), 800);
          setShowWrong(true);
          setTimeout(() => setShowWrong(false), 400);
          const playedA = oneClubPlayer.clubs[currentPair.clubA];
          const playedB = oneClubPlayer.clubs[currentPair.clubB];
          setShowOneClub({
            player: oneClubPlayer,
            clubA: currentPair.clubA,
            clubB: currentPair.clubB,
            appsA: playedA ? playedA.appearances : 0,
            appsB: playedB ? playedB.appearances : 0,
          });
          setInputValue("");
          return;
        }

        // Neither club
        setShowWrong(true);
        playWrong();
        setComboStreak(0);
        questionTimeRef.current = Math.max(0.1, questionTimeRef.current - WRONG_GUESS_PENALTY);
        setShowPenalty(true);
        setTimeout(() => setShowPenalty(false), 800);
        setTimeout(() => setShowWrong(false), 400);
        setInputValue("");
        return;
      }

      // Correct answer!
      questionResolvedRef.current = true;
      clearQuestionTimer();
      setShowOneClub(null);
      const playerKey = matchedPlayer.displayName.toLowerCase();
      setUsedPlayerKeys((prev) => new Set(prev).add(playerKey));

      const elapsed = (Date.now() - questionStartRef.current) / 1000;
      const clubDataA = matchedPlayer.clubs[currentPair.clubA];
      const clubDataB = matchedPlayer.clubs[currentPair.clubB];
      const appsA = clubDataA.appearances;
      const appsB = clubDataB.appearances;
      const goalsA = clubDataA.goals;
      const goalsB = clubDataB.goals;
      const minApps = Math.min(appsA, appsB);
      const minGoals = Math.min(goalsA, goalsB);

      const timeScore = getTimeScore(elapsed);
      const appBonusData = getAppBonus(minApps);
      const goalBonusData = getGoalBonus(minGoals);

      const newComboStreak = comboStreak + 1;
      setComboStreak(newComboStreak);
      const comboMult = getComboMultiplier(newComboStreak);

      const preCombo = timeScore + appBonusData.points + goalBonusData.points;
      const finalPoints = Math.round(preCombo * comboMult);

      playScoreSound({
        finalPoints,
        basePoints: preCombo,
        isExact: preCombo >= 60,
        isBoostHit: false,
        comboStreak: newComboStreak,
      });

      setShowCorrect(true);
      setTimeout(() => setShowCorrect(false), 500);
      setTotalScore((prev) => prev + finalPoints);

      const result: RoundResult = {
        id: Date.now(),
        questionNum,
        clubA: currentPair.clubA,
        clubB: currentPair.clubB,
        player: matchedPlayer,
        appsA, appsB, goalsA, goalsB,
        timeScore,
        appBonus: appBonusData.points,
        goalBonus: goalBonusData.points,
        comboMultiplier: comboMult,
        finalPoints,
        elapsed,
        wasPass: false, wasTimeout: false,
        topPlayers: getTopPlayersForPair(currentPair, 5),
        totalAvailable: currentPair.players.length,
      };
      setLastResult(result);
      setRoundResults((prev) => [...prev, result]);

      setInputValue("");
      setTimeout(() => advanceQuestion(), 300);
    },
    [gameState, inputValue, currentPair, usedPlayerKeys, playerLookup, comboStreak, questionNum, advanceQuestion, clearQuestionTimer]
  );

  const timePercent = (questionTimeLeft / QUESTION_TIME) * 100;
  const isUrgent = questionTimeLeft <= 5;
  const isWarning = questionTimeLeft <= 10;
  const comboMult = getComboMultiplier(comboStreak);
  const comboLevel = getComboLevel(comboStreak);
  const liveElapsed = (QUESTION_TIME - questionTimeLeft);
  const liveTimeScore = getTimeScore(liveElapsed);

  const comboTier =
    comboStreak >= 6 ? 3 : comboStreak >= 4 ? 2 : comboStreak >= 2 ? 1 : 0;
  const floatingEmojis = useMemo(() => {
    if (comboStreak < 2) return [];
    const emoji = comboStreak >= 6 ? "🔥" : comboStreak >= 4 ? "⚡" : "🔗";
    const count = comboTier === 3 ? 10 : comboTier === 2 ? 7 : comboTier === 1 ? 4 : 2;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      emoji,
      left: `${5 + Math.random() * 90}%`,
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 4,
      size: 14 + Math.random() * 14,
    }));
  }, [comboTier]);

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
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
              <span className="text-sm font-bold text-blue-400 tabular-nums">Q{questionNum}</span>
              <span className="text-xs text-muted-foreground/50">/</span>
              <span className="text-xs text-muted-foreground/50">{TOTAL_QUESTIONS}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Timer */}
            <div className="flex items-center gap-1.5">
              <Timer className={`w-3.5 h-3.5 ${isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : theme.timerIconColor}`} />
              <span
                className={`text-lg font-mono font-bold tabular-nums ${isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : "text-foreground"} ${isUrgent ? "animate-countdown-pulse" : ""}`}
              >
                {Math.ceil(questionTimeLeft)}s
              </span>
              <AnimatePresence>
                {showPenalty && (
                  <motion.span
                    initial={{ opacity: 0, x: -5, scale: 0.8 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="text-xs font-bold text-red-400"
                  >
                    -{WRONG_GUESS_PENALTY}s
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {comboStreak >= 2 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span className="text-xs font-bold text-amber-400 tabular-nums">{comboMult.toFixed(1)}x</span>
              </motion.div>
            )}

            {highScore > 0 && (
              <div className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-sm font-medium text-amber-400/80">{highScore}</span>
              </div>
            )}
          </div>
        </div>

        {/* Question timer bar with live points */}
        <div className="relative w-full mb-3 sm:mb-4">
          <div className="w-full h-2.5 rounded-full bg-muted/50">
            <motion.div
              className={`h-full rounded-full transition-colors duration-300 ${isUrgent ? "bg-red-500" : isWarning ? "bg-amber-500" : theme.timerBar}`}
              style={{ width: `${timePercent}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
          {!questionResolvedRef.current && questionTimeLeft > 0 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none flex items-center"
              style={{ left: `${timePercent}%` }}
            >
              <span className={`text-[10px] font-bold tabular-nums ml-2 leading-none ${isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : "text-blue-400"}`}>
                {liveTimeScore}pts
              </span>
            </div>
          )}
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
                {comboLevel.label} {comboMult.toFixed(1)}x
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
                  lastResult.wasPass
                    ? "bg-muted/30 border-border/40"
                    : lastResult.wasTimeout
                      ? "bg-muted/30 border-border/40"
                      : lastResult.finalPoints >= 40
                        ? "bg-blue-500/10 border-blue-500/30"
                        : "bg-emerald-500/5 border-emerald-500/20"
                }`}
              >
                {lastResult.wasPass ? (
                  <div className="text-center text-sm text-muted-foreground font-medium">
                    Passed
                  </div>
                ) : lastResult.wasTimeout ? (
                  <div className="text-center text-sm text-muted-foreground font-medium">
                    Time's up
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
                            {lastResult.comboMultiplier.toFixed(1)}x
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
                    {/* Bonus badges */}
                    {(lastResult.appBonus > 0 || lastResult.goalBonus > 0) && (
                      <div className="flex items-center gap-2 mt-1.5">
                        {lastResult.appBonus > 0 && (
                          <span className="text-[10px] font-bold text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                            Low apps +{lastResult.appBonus}
                          </span>
                        )}
                        {lastResult.goalBonus > 0 && (
                          <span className="text-[10px] font-bold text-violet-400 px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20">
                            Low goals +{lastResult.goalBonus}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* One-club feedback (persists until dismissed by new input) */}
          <AnimatePresence>
            {showOneClub && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-3 px-4 py-2 rounded-md border border-red-500/20 bg-red-500/5 w-full max-w-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-foreground text-sm">{showOneClub.player.displayName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-amber-400">Only one club</span>
                    <span className="text-[10px] font-bold text-red-400">-{WRONG_GUESS_PENALTY}s</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className={showOneClub.appsA > 0 ? "" : "text-muted-foreground/30"}>
                    {showOneClub.clubA}: {showOneClub.appsA > 0 ? `${showOneClub.appsA} apps` : "—"}
                  </span>
                  <span className="text-muted-foreground/30">&middot;</span>
                  <span className={showOneClub.appsB > 0 ? "" : "text-muted-foreground/30"}>
                    {showOneClub.clubB}: {showOneClub.appsB > 0 ? `${showOneClub.appsB} apps` : "—"}
                  </span>
                </div>
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
              <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/15">
                <span className="text-xs font-bold text-blue-400 tabular-nums">{currentPair.players.length}</span>
                <span className="text-[10px] text-blue-400/60 uppercase tracking-wider">possible answers</span>
              </div>
            </motion.div>
          )}

          {/* Timeout reveal — top players */}
          <AnimatePresence>
            {showTimeoutReveal && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-3 px-4 py-2.5 rounded-md border border-red-500/20 bg-red-500/5 w-full max-w-sm"
              >
                <div className="text-[10px] text-red-400/80 font-bold uppercase tracking-wider mb-1.5">
                  Top answers
                </div>
                <div className="space-y-0.5">
                  {showTimeoutReveal.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-foreground/80 font-medium">{p.displayName}</span>
                      <span className="text-muted-foreground tabular-nums">{p.combinedApps} apps</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => advanceQuestion()}
                  className="mt-2 w-full text-xs font-semibold text-blue-400 hover:text-blue-300 py-1.5 rounded-md border border-blue-500/20 hover:bg-blue-500/10 transition-colors"
                >
                  Next Question <ChevronRight className="w-3 h-3 inline" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <div className="w-full max-w-md mx-auto mb-2 sm:mb-4 sm:mt-auto mt-4">
            <form onSubmit={handleSubmit} className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => { setInputValue(e.target.value); setShowOneClub(null); }}
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
                <button
                  type="button"
                  onClick={handlePass}
                  className="p-2 rounded-md text-muted-foreground/40 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                  title="Pass"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  className="p-2 rounded-md text-muted-foreground/50 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </form>
            <p className="text-center text-[11px] text-muted-foreground/60 uppercase tracking-wider mt-2">
              Enter to submit &middot; pass to skip
            </p>
          </div>
        </div>
      </div>

      {/* Correct flash */}
      <AnimatePresence>
        {showCorrect && lastResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 pointer-events-none z-50"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: (lastResult.appBonus + lastResult.goalBonus) > 10 ? 0.12 : 0.04 }}
              exit={{ opacity: 0 }}
              className={`absolute inset-0 ${(lastResult.appBonus + lastResult.goalBonus) > 10 ? "bg-blue-500" : "bg-emerald-500"}`}
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
              <span className="font-semibold text-foreground">{TOTAL_QUESTIONS} questions</span> &middot; name a player who appeared for <span className="font-semibold text-foreground">both clubs</span>
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-cyan-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Timer className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              <span className="font-semibold text-foreground">{QUESTION_TIME}s per question</span> &middot; faster = more points &middot; wrong guess = <span className="font-semibold text-foreground">-{WRONG_GUESS_PENALTY}s</span>
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-violet-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Star className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              Bonus points for <span className="font-semibold text-foreground">low appearances</span> and <span className="font-semibold text-foreground">low goals</span>
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-yellow-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              Consecutive correct answers build <span className="font-semibold text-foreground">combo multipliers</span>
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <SkipForward className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              <span className="font-semibold text-foreground">Pass</span> any question (0 points, resets combo)
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
  const [copied, setCopied] = useState(false);
  const isNewHighScore = totalScore >= highScore && totalScore > 0;
  const scoringRounds = roundResults.filter((r) => r.finalPoints > 0);
  const bestRound = scoringRounds.length > 0
    ? scoringRounds.reduce((best, r) => (r.finalPoints > best.finalPoints ? r : best))
    : null;

  const handleShare = async () => {
    const text = `I scored ${totalScore.toLocaleString()} on Overlap ⚽ Can you beat me?\nhttps://drapk.in/overlap`;
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
          className="mb-6"
        >
          <div className="flex items-center justify-between gap-3 sm:hidden mb-3">
            <Button onClick={onHome} variant="outline" size="lg" className={`${theme.outlineBtn} flex-1`}>
              <Home className="w-5 h-5 mr-2" />
              Home
            </Button>
            <Button onClick={handleShare} variant="outline" size="lg" className="font-bold flex-1 border-blue-500/40 text-blue-400 hover:bg-blue-500/10">
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
            <Button onClick={handleShare} variant="outline" size="lg" className="font-bold border-blue-500/40 text-blue-400 hover:bg-blue-500/10">
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
            points from {TOTAL_QUESTIONS} questions
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
            <div className="text-2xl font-bold text-muted-foreground">
              {roundResults.filter((r) => r.wasPass).length}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">passed</div>
          </div>
          {bestRound && (
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">+{bestRound.finalPoints}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">best</div>
            </div>
          )}
        </motion.div>

        {/* Round history with top answers */}
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
            <div className="space-y-2 max-w-md mx-auto max-h-[500px] overflow-y-auto">
              {roundResults.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.04 }}
                  className={`px-3 py-2 rounded-md text-xs ${
                    r.wasPass || r.wasTimeout
                      ? "bg-card/30 border border-border/20"
                      : r.finalPoints > 0
                        ? "bg-card border border-border/30"
                        : "bg-card/50 border border-border/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-blue-400 font-bold w-5 text-right tabular-nums text-[11px]">
                      {r.questionNum}
                    </span>
                    <span className="text-muted-foreground/40 mx-0.5">.</span>
                    <span className="font-semibold text-blue-400/80 truncate text-[11px]" style={{ maxWidth: "5rem" }}>
                      {r.clubA}
                    </span>
                    <span className="text-muted-foreground/30 text-[10px]">&</span>
                    <span className="font-semibold text-cyan-400/80 truncate text-[11px]" style={{ maxWidth: "5rem" }}>
                      {r.clubB}
                    </span>
                    <span className="text-muted-foreground/40 mx-0.5">&rarr;</span>
                    <span className="font-semibold text-foreground/80 flex-1 text-left truncate">
                      {r.wasPass ? "pass" : r.wasTimeout ? "timeout" : r.player ? r.player.displayName : "???"}
                    </span>
                    <span className="text-muted-foreground/40 tabular-nums text-[10px]">
                      {r.totalAvailable}
                    </span>
                    <span
                      className={`font-bold tabular-nums w-10 text-right ${
                        r.finalPoints > 0 ? "text-emerald-400" : "text-muted-foreground/40"
                      }`}
                    >
                      {r.finalPoints > 0 ? `+${r.finalPoints}` : "—"}
                    </span>
                  </div>
                  {/* Top players for this round */}
                  {r.topPlayers.length > 0 && (
                    <div className="mt-1.5 pl-8 flex flex-wrap gap-x-3 gap-y-0.5">
                      {r.topPlayers.map((tp, j) => (
                        <span
                          key={j}
                          className={`text-[10px] ${
                            r.player && tp.displayName === r.player.displayName
                              ? "text-emerald-400 font-semibold"
                              : "text-muted-foreground/50"
                          }`}
                        >
                          {tp.displayName} <span className="tabular-nums">({tp.combinedApps})</span>
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
