import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { players, type Player } from "@/data/players";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Trophy, Target, ChevronRight, Home, Flag, Crosshair, Zap, Ticket, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { playWrong, playTick, playScoreSound } from "@/lib/sounds";
import { gameThemes } from "@/lib/game-themes";
import { useUser } from "@/lib/user-context";
import { normalizeName, getCommonSurname, PL_MONONYMS, PL_ALTERNATES } from "@/lib/normalize";
import type { GameState } from "@/lib/game-types";
import { useHighScore } from "@/hooks/use-high-score";
import { useShare } from "@/hooks/use-share";
import { useEndScreenEffects } from "@/hooks/use-end-screen-effects";
import { useLockScroll } from "@/hooks/use-lock-scroll";
import { ScreenFlash } from "@/components/screen-flash";
import { EndScreenActions } from "@/components/end-screen-actions";
import { NewHighScoreBadge } from "@/components/new-high-score-badge";

const theme = gameThemes.warm;

const GAME_DURATION = 90;
const COMBO_WINDOW = 8;


function buildPlayerLookup() {
  const lookup = new Map<string, Player>();
  for (const p of players) {
    const officialKey = normalizeName(p.lastName);
    if (!lookup.has(officialKey)) {
      lookup.set(officialKey, p);
    }

    const commonSurname = getCommonSurname(p);
    const commonKey = normalizeName(commonSurname);
    if (commonKey !== officialKey && !lookup.has(commonKey)) {
      lookup.set(commonKey, { ...p, lastName: commonSurname });
    }

    const displayParts = p.displayName.trim().split(/\s+/);
    const fullDisplayKey = normalizeName(p.displayName);
    if (!lookup.has(fullDisplayKey)) {
      const lastWord = displayParts[displayParts.length - 1] || p.lastName;
      lookup.set(fullDisplayKey, { ...p, lastName: lastWord });
    }

    const lastNameParts = p.lastName.split(/\s+/);
    if (lastNameParts.length > 1) {
      for (const part of lastNameParts) {
        const partKey = normalizeName(part);
        if (partKey.length > 2 && !lookup.has(partKey)) {
          lookup.set(partKey, { ...p, lastName: part });
        }
      }
    }
  }

  // Mononym / nickname lookups — override existing entry with the more notable player
  for (const [mono, targetKey] of Object.entries(PL_MONONYMS)) {
    const target = lookup.get(targetKey);
    if (target) lookup.set(mono, target);
  }

  // Alternate spellings
  for (const [alt, official] of Object.entries(PL_ALTERNATES)) {
    const target = lookup.get(official);
    if (target && !lookup.has(alt)) {
      lookup.set(alt, target);
    }
  }

  return lookup;
}

// --- Target Man specific ---

interface RoundResult {
  id: number;
  targetGoals: number;
  player: Player | null;
  playerGoals: number;
  diff: number;
  basePoints: number;
  comboMultiplier: number;
  boostHit: boolean;
  boostMultiplier: number;
  finalPoints: number;
  wasInvalid: boolean;
}

function getUniqueGoalTotals(): number[] {
  const totals = new Set<number>();
  for (const p of players) {
    if (p.goals >= 1) totals.add(p.goals);
  }
  return Array.from(totals);
}

function getWeightedTarget(totals: number[]): number {
  // Gentle bump for higher numbers to offset clustering at low totals.
  // 1-30: weight 1, 31-100: weight 1.5, 101+: weight 2
  const weighted: { total: number; weight: number }[] = totals.map((t) => ({
    total: t,
    weight: t <= 30 ? 1 : t <= 100 ? 1.5 : 2,
  }));
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let r = Math.random() * totalWeight;
  for (const w of weighted) {
    r -= w.weight;
    if (r <= 0) return w.total;
  }
  return weighted[weighted.length - 1].total;
}

function calculateBaseScore(targetGoals: number, playerGoals: number): number {
  const diff = Math.abs(targetGoals - playerGoals);

  if (targetGoals < 10) {
    if (diff === 0) return 50;
    if (diff <= 1) return 20;
    if (diff <= 2) return 16;
    if (diff <= 3) return 12;
    if (diff <= 5) return 8;
    return 0;
  }

  const percentDiff = diff / targetGoals;
  if (diff === 0) return 50;
  if (percentDiff <= 0.1) return 20;
  if (percentDiff <= 0.2) return 16;
  if (percentDiff <= 0.35) return 12;
  if (percentDiff <= 0.5) return 8;
  return 0;
}

function getComboMultiplier(streak: number): number {
  // streak 0-1 = 1x, 2 = 2x, 3 = 3x, 4 = 4x, 5+ = 5x cap
  if (streak <= 1) return 1;
  return Math.min(streak, 5);
}


function getComboLevel(streak: number): { label: string; color: string; bgClass: string; glowColor: string } {
  if (streak >= 5) return { label: "MAX COMBO", color: "text-amber-400", bgClass: "bg-amber-500/10", glowColor: "shadow-amber-500/30" };
  if (streak >= 4) return { label: "MEGA COMBO", color: "text-orange-400", bgClass: "bg-orange-500/8", glowColor: "shadow-orange-500/20" };
  if (streak >= 3) return { label: "COMBO x3", color: "text-yellow-400", bgClass: "bg-yellow-500/6", glowColor: "shadow-yellow-500/15" };
  if (streak >= 2) return { label: "COMBO x2", color: "text-emerald-400", bgClass: "bg-emerald-500/5", glowColor: "shadow-emerald-500/10" };
  return { label: "", color: "", bgClass: "", glowColor: "" };
}

function getScoreBandLabel(basePoints: number): { label: string; color: string } {
  if (basePoints === 50) return { label: "EXACT", color: "text-amber-400" };
  if (basePoints >= 20) return { label: "CLOSE", color: "text-emerald-400" };
  if (basePoints >= 16) return { label: "GOOD", color: "text-green-400" };
  if (basePoints >= 12) return { label: "OK", color: "text-blue-400" };
  if (basePoints >= 8) return { label: "FAR", color: "text-orange-400" };
  return { label: "MISS", color: "text-red-400" };
}

export default function TargetMan() {
  const playerLookup = useMemo(() => buildPlayerLookup(), []);
  const uniqueGoalTotals = useMemo(() => getUniqueGoalTotals(), []);
  const [, navigate] = useLocation();

  const [gameState, setGameState] = useState<GameState>("idle");
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [targetGoals, setTargetGoals] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [usedNames, setUsedNames] = useState<Set<string>>(new Set());
  const [totalScore, setTotalScore] = useState(0);
  const [roundCount, setRoundCount] = useState(0);
  const [comboStreak, setComboStreak] = useState(0);
  const [scoringCount, setScoringCount] = useState(0);
  const [boostLetter, setBoostLetter] = useState("");
  const [boostMultiplier, setBoostMultiplier] = useState(1);
  const { user } = useUser();
  const { effectiveHighScore, totalPlays, checkAndUpdate, refreshStats } = useHighScore("targetman-highscore", "targetman", user?.username);

  // Round feedback
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [showCorrect, setShowCorrect] = useState(false);
  const [showWrong, setShowWrong] = useState(false);
  const [showExactMatch, setShowExactMatch] = useState(false);
  const [showBoostFlash, setShowBoostFlash] = useState(false);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);

  // Combo timer
  const [comboTimeLeft, setComboTimeLeft] = useState(COMBO_WINDOW);
  const [comboActive, setComboActive] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  useLockScroll(inputRef);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const comboTimerRef = useRef<NodeJS.Timeout | null>(null);
  const roundStartRef = useRef<number>(Date.now());

  const pickNewTarget = useCallback(() => {
    const t = getWeightedTarget(uniqueGoalTotals);
    setTargetGoals(t);
    setComboTimeLeft(COMBO_WINDOW);
    setComboActive(true);
    roundStartRef.current = Date.now();
  }, [uniqueGoalTotals]);

  const startGame = useCallback(() => {
    setGameState("playing");
    setTimeLeft(GAME_DURATION);
    setInputValue("");
    setUsedNames(new Set());
    setTotalScore(0);
    setRoundCount(0);
    setComboStreak(0);
    setScoringCount(0);
    setLastResult(null);
    setShowCorrect(false);
    setShowWrong(false);
    setShowExactMatch(false);
    setRoundResults([]);
    setBoostLetter("");
    setBoostMultiplier(1);
    pickNewTarget();
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100);
  }, [pickNewTarget]);

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
      checkAndUpdate(prev);
      return prev;
    });
  }, [checkAndUpdate]);

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
  }, [gameState, comboActive, targetGoals]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (gameState !== "playing") return;

      const guess = inputValue.trim();
      if (!guess) return;

      const guessNorm = normalizeName(guess);
      const player = playerLookup.get(guessNorm);
      const wasWithinComboWindow = comboActive && comboTimeLeft > 0;

      // Helper: set boost letter from a guess
      const setBoostFromGuess = (name: string) => {
        const letter = normalizeName(name)[0] || "";
        if (letter && letter === boostLetter) {
          setBoostMultiplier((prev) => Math.min(prev + 1, 5));
        } else {
          setBoostLetter(letter);
          setBoostMultiplier(2);
        }
      };

      // Invalid player (not in dataset)
      if (!player) {
        setShowWrong(true);
        playWrong();
        setTimeout(() => setShowWrong(false), 400);
        setComboStreak(0);
        setBoostLetter("");
        setBoostMultiplier(1);
        setTimeLeft((prev) => Math.max(0, prev - 5));
        setLastResult({
          id: Date.now(),
          targetGoals,
          player: null,
          playerGoals: 0,
          diff: 0,
          basePoints: 0,
          comboMultiplier: 1,
          boostHit: false,
          boostMultiplier: 1,
          finalPoints: 0,
          wasInvalid: true,
        });
        setInputValue("");
        setTimeLeft((prev) => {
          if (prev <= 0) {
            setTimeout(() => endGame(), 0);
          }
          return prev;
        });
        return;
      }

      // Already used
      const playerKey = player.displayName.toLowerCase();
      if (usedNames.has(playerKey)) {
        setShowWrong(true);
        playWrong();
        setTimeout(() => setShowWrong(false), 400);
        setComboStreak(0);
        setBoostLetter("");
        setBoostMultiplier(1);
        setTimeLeft((prev) => Math.max(0, prev - 5));
        setLastResult({
          id: Date.now(),
          targetGoals,
          player,
          playerGoals: player.goals,
          diff: 0,
          basePoints: 0,
          comboMultiplier: 1,
          boostHit: false,
          boostMultiplier: 1,
          finalPoints: 0,
          wasInvalid: true,
        });
        setInputValue("");
        return;
      }

      // Valid player - mark as used
      setUsedNames((prev) => new Set(prev).add(playerKey));
      setRoundCount((prev) => prev + 1);

      const basePoints = calculateBaseScore(targetGoals, player.goals);
      const diff = Math.abs(targetGoals - player.goals);

      // Set boost letter from this player's surname
      const surname = getCommonSurname(player);
      const surnameFirst = normalizeName(surname)[0];

      if (basePoints === 0) {
        // 0 points — combo reset, time penalty
        setShowWrong(true);
        playWrong();
        setTimeout(() => setShowWrong(false), 400);
        setComboStreak(0);
        setBoostLetter("");
        setBoostMultiplier(1);
        setTimeLeft((prev) => Math.max(0, prev - 2));

        const result: RoundResult = {
          id: Date.now(),
          targetGoals,
          player,
          playerGoals: player.goals,
          diff,
          basePoints: 0,
          comboMultiplier: 1,
          boostHit: false,
          boostMultiplier: 1,
          finalPoints: 0,
          wasInvalid: false,
        };
        setLastResult(result);
        setRoundResults((prev) => [...prev, result]);
        setInputValue("");
        pickNewTarget();
        return;
      }

      // Scoring answer
      const newScoringCount = scoringCount + 1;
      setScoringCount(newScoringCount);

      // Combo logic
      let newComboStreak = comboStreak;
      if (wasWithinComboWindow) {
        newComboStreak = comboStreak + 1;
      } else {
        newComboStreak = 1;
      }
      setComboStreak(newComboStreak);

      const comboMult = getComboMultiplier(newComboStreak);

      // Boost letter check — did this player's surname match the active boost?
      const boostHit = boostLetter !== "" && surnameFirst === boostLetter;
      const currentBoostMult = boostHit ? boostMultiplier : 1;

      let finalPoints = Math.round(basePoints * comboMult * currentBoostMult);

      // Update boost letter for next round
      setBoostFromGuess(surname);

      // Sound — unified, scales with result quality
      playScoreSound({
        finalPoints,
        basePoints,
        isExact: basePoints === 50,
        isBoostHit: boostHit,
        comboStreak: newComboStreak,
      });

      // Visual celebrations
      if (basePoints === 50) {
        setShowExactMatch(true);
        setTimeout(() => setShowExactMatch(false), 1500);
      }
      if (boostHit) {
        setShowBoostFlash(true);
        setTimeout(() => setShowBoostFlash(false), 600);
      }

      setShowCorrect(true);
      setTimeout(() => setShowCorrect(false), 500);

      setTotalScore((prev) => prev + finalPoints);

      const result: RoundResult = {
        id: Date.now(),
        targetGoals,
        player,
        playerGoals: player.goals,
        diff,
        basePoints,
        comboMultiplier: comboMult,
        boostHit,
        boostMultiplier: currentBoostMult,
        finalPoints,
        wasInvalid: false,
      };
      setLastResult(result);
      setRoundResults((prev) => [...prev, result]);

      setInputValue("");
      pickNewTarget();
    },
    [gameState, inputValue, targetGoals, usedNames, playerLookup, comboActive, comboTimeLeft, comboStreak, scoringCount, boostLetter, boostMultiplier, pickNewTarget, endGame]
  );

  const timerPercent = (timeLeft / GAME_DURATION) * 100;
  const isUrgent = timeLeft <= 10;
  const isWarning = timeLeft <= 30;
  const comboPercent = (comboTimeLeft / COMBO_WINDOW) * 100;
  const comboMult = getComboMultiplier(comboStreak);
  const comboLevel = getComboLevel(comboStreak);

  const comboTier = comboStreak >= 5 ? 3 : comboStreak >= 4 ? 2 : comboStreak >= 3 ? 1 : 0;
  const floatingEmojis = useMemo(() => {
    if (comboStreak < 2) return [];
    const emoji = comboStreak >= 5 ? "🔥" : comboStreak >= 3 ? "⚡" : "🎯";
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
    return <StartScreen highScore={effectiveHighScore} onStart={startGame} onHome={goHome} />;
  }

  if (gameState === "finished") {
    return (
      <EndScreen
        roundResults={roundResults}
        totalScore={totalScore}
        highScore={effectiveHighScore}
        totalPlays={totalPlays}
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
            <div className={`p-1.5 rounded-md ${isUrgent ? "bg-red-500/20" : isWarning ? "bg-amber-500/15" : theme.timerIcon}`}>
              <Timer className={`w-4 h-4 ${isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : theme.timerIconColor}`} />
            </div>
            <span
              className={`text-2xl font-mono font-bold tabular-nums ${isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : "text-foreground"} ${isUrgent ? "animate-countdown-pulse" : ""}`}
            >
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Combo indicator */}
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

            {effectiveHighScore > 0 && (
              <div className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-sm font-medium text-amber-400/80">{effectiveHighScore}</span>
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
          {/* Score + Boost — side by side on mobile, stacked on desktop */}
          <div className="flex items-center gap-4 sm:flex-col sm:gap-0 mb-2 sm:mb-2">
            {/* Score display */}
            <motion.div
              key={totalScore}
              className="text-center"
              animate={totalScore > 0 ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.2 }}
            >
              <div className="text-4xl sm:text-5xl font-bold tabular-nums bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">
                {totalScore}
              </div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">points</span>
            </motion.div>

            {/* Boost letter badge */}
            {boostLetter ? (
              <motion.div
                key={boostLetter + boostMultiplier}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={boostMultiplier >= 3
                  ? { scale: [1, 1.05, 1], opacity: 1 }
                  : { scale: 1, opacity: 1 }
                }
                transition={boostMultiplier >= 3
                  ? { scale: { repeat: Infinity, duration: 1.2, ease: "easeInOut" } }
                  : {}
                }
                className="flex items-center gap-2 sm:mt-2"
              >
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${
                  boostMultiplier >= 4 ? "text-amber-400 bg-amber-500/15 border-amber-500/30" :
                  boostMultiplier >= 3 ? "text-violet-400 bg-violet-500/15 border-violet-500/30" :
                  "text-violet-400/70 bg-violet-500/10 border-violet-500/20"
                }`}>{boostMultiplier}x</span>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-md ${
                  boostMultiplier >= 4 ? "bg-amber-500/20 border-2 border-amber-500/50 shadow-amber-500/15" :
                  boostMultiplier >= 3 ? "bg-violet-500/20 border-2 border-violet-500/50 shadow-violet-500/15" :
                  "bg-violet-500/15 border-2 border-violet-500/40 shadow-violet-500/10"
                }`}>
                  <span className={`text-xl font-black uppercase leading-none ${
                    boostMultiplier >= 4 ? "text-amber-400" : "text-violet-400"
                  }`}>{boostLetter}</span>
                </div>
              </motion.div>
            ) : (
              <div className="flex items-center gap-2 sm:mt-2 opacity-40">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium px-2 py-0.5 rounded bg-muted/30 border border-border/30">boost</span>
                <div className="w-9 h-9 rounded-lg bg-muted/20 border-2 border-border/30 flex items-center justify-center">
                  <span className="text-lg text-muted-foreground/30 font-bold">—</span>
                </div>
              </div>
            )}
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
                  lastResult.wasInvalid
                    ? "bg-red-500/5 border-red-500/20"
                    : lastResult.basePoints === 0
                      ? "bg-red-500/5 border-red-500/20"
                      : lastResult.basePoints === 50
                        ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-emerald-500/5 border-emerald-500/20"
                }`}
              >
                {lastResult.wasInvalid && !lastResult.player ? (
                  <div className="text-center text-sm text-red-400 font-medium">
                    Not found &middot; -5s
                  </div>
                ) : lastResult.wasInvalid && lastResult.player ? (
                  <div className="text-center text-sm text-red-400 font-medium">
                    Already used &middot; -5s
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-bold text-foreground text-sm">{lastResult.player?.displayName}</span>
                      <span className="text-muted-foreground text-xs ml-1.5">
                        {lastResult.playerGoals} goals
                      </span>
                      {lastResult.diff > 0 && (
                        <span className="text-muted-foreground/60 text-xs ml-1">
                          ({lastResult.diff > 0 ? "+" : ""}{lastResult.playerGoals - lastResult.targetGoals})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {lastResult.basePoints > 0 && (
                        <>
                          <span className={`text-xs font-bold ${getScoreBandLabel(lastResult.basePoints).color}`}>
                            {getScoreBandLabel(lastResult.basePoints).label}
                          </span>
                          {lastResult.comboMultiplier > 1 && (
                            <span className="text-[10px] text-amber-400 font-bold">{lastResult.comboMultiplier}x</span>
                          )}
                          {lastResult.boostHit && (
                            <span className="text-[10px] text-violet-400 font-bold">{lastResult.boostMultiplier}x</span>
                          )}
                        </>
                      )}
                      <span className={`font-bold tabular-nums text-sm ${
                        lastResult.finalPoints > 0 ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {lastResult.finalPoints > 0 ? `+${lastResult.finalPoints}` : lastResult.basePoints === 0 && !lastResult.wasInvalid ? "-2s" : "0"}
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Target number */}
          <motion.div
            key={targetGoals}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="text-center mb-1"
          >
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest">
              Target Goals
            </span>
            <div className="text-6xl sm:text-8xl font-black tabular-nums bg-gradient-to-b from-orange-400 to-orange-600 bg-clip-text text-transparent">
              {targetGoals}
            </div>
          </motion.div>

          {/* Combo speed ring */}
          <div className="relative w-12 h-12 mb-3 sm:mb-4">
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
                    ? "stroke-emerald-400"
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
                <Zap className={`w-4 h-4 ${comboPercent > 50 ? "text-emerald-400" : comboPercent > 25 ? "text-amber-400" : "text-red-400"}`} />
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
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md text-muted-foreground/50 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </form>
            <p className="text-center text-[11px] text-muted-foreground/60 uppercase tracking-wider mt-2">
              Enter to submit
            </p>
          </div>
        </div>
      </div>

      {/* Exact match celebration overlay */}
      <AnimatePresence>
        {showExactMatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.12 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-amber-500"
            />
            <motion.div
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className="text-7xl sm:text-9xl font-black text-amber-400 drop-shadow-2xl"
            >
              +50
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Correct flash — intensity varies by score band */}
      <ScreenFlash
        show={showCorrect && !showExactMatch && !!lastResult && lastResult.basePoints > 0}
        color={lastResult && lastResult.basePoints >= 16 ? "bg-emerald-500" : "bg-blue-500"}
        opacity={lastResult && lastResult.basePoints >= 16 ? 0.1 : 0.04}
      />

      {/* Wrong flash */}
      <ScreenFlash show={showWrong} color="bg-red-500" opacity={0.06} />

      {/* Boost letter hit flash — violet/amber pulse */}
      <AnimatePresence>
        {showBoostFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 pointer-events-none z-50"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.12, 0.06, 0] }}
              transition={{ duration: 0.6 }}
              className={`absolute inset-0 ${boostMultiplier >= 4 ? "bg-amber-500" : "bg-violet-500"}`}
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
          className="w-16 h-16 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-8 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-500/5 border border-orange-500/20 flex items-center justify-center shadow-xl shadow-orange-500/10"
        >
          <Crosshair className="w-8 h-8 sm:w-12 sm:h-12 text-orange-400" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl sm:text-5xl font-black text-foreground mb-4 sm:mb-8 tracking-tight"
        >
          Target
          <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
            Man
          </span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-2 sm:space-y-3 mb-6 sm:mb-10 inline-flex flex-col items-start"
        >
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-orange-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Crosshair className="w-3.5 h-3.5 text-orange-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              Match the <span className="font-semibold text-foreground">target goal number</span> as closely as possible
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Target className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              Name a PL scorer whose <span className="font-semibold text-foreground">career goals</span> are closest to the target
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-yellow-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              Answer fast for <span className="font-semibold text-foreground">combo multipliers</span>
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Star className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              Keep using same <span className="font-semibold text-foreground">starting letter</span> for <span className="font-semibold text-foreground">escalating boosts</span>
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-red-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Timer className="w-3.5 h-3.5 text-red-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              You have <span className="font-semibold text-foreground">90 seconds</span> &middot; wrong answers cost time
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
  totalPlays,
  onRestart,
  onHome,
}: {
  roundResults: RoundResult[];
  totalScore: number;
  highScore: number;
  totalPlays: number;
  onRestart: () => void;
  onHome: () => void;
}) {
  const { share, copied } = useShare();
  const { user } = useUser();
  const isNewHighScore = totalScore >= highScore && totalScore > 0;
  const scoringRounds = roundResults.filter((r) => r.finalPoints > 0);
  const exactMatches = roundResults.filter((r) => r.basePoints === 50).length;
  const bestRound = scoringRounds.length > 0
    ? scoringRounds.reduce((best, r) => (r.finalPoints > best.finalPoints ? r : best))
    : null;

  const handleShare = () => share(`I scored ${totalScore.toLocaleString()} on TargetMan \u26bd Can you beat me?\nhttps://drapk.in/targetman`);

  useEndScreenEffects({
    isNewHighScore,
    gameSlug: "targetman",
    score: totalScore,
    username: user?.username,
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 py-12 relative overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none">
        {isNewHighScore && (
          <>
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/8 rounded-full blur-3xl animate-pulse-glow" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-500/8 rounded-full blur-3xl animate-pulse-glow" />
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
          <EndScreenActions
            onHome={onHome}
            onRestart={onRestart}
            onShare={handleShare}
            copied={copied}
            primaryBtnClass={theme.primaryBtn}
            outlineBtnClass={theme.outlineBtn}
            shareBtnClass="border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
          />
        </motion.div>

        <NewHighScoreBadge show={isNewHighScore} />

        <motion.div
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
          className="mb-3"
        >
          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-2">
            <Ticket className="w-3.5 h-3.5" />
            <span className="text-xs">Play #{totalPlays + 1}</span>
          </div>
          <div className="text-8xl font-black tabular-nums bg-gradient-to-b from-foreground via-foreground to-foreground/40 bg-clip-text text-transparent">
            {totalScore}
          </div>
          <div className="text-muted-foreground text-xs uppercase tracking-widest mt-2">
            points from {roundResults.length} rounds
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
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">scoring</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-400">{exactMatches}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">exact</div>
          </div>
          {bestRound && (
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">+{bestRound.finalPoints}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">best round</div>
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
                    r.finalPoints > 0 ? "bg-card border border-border/30" : "bg-card/50 border border-border/20 opacity-60"
                  }`}
                >
                  <span className="font-mono text-orange-400 font-bold w-8 text-right tabular-nums">{r.targetGoals}</span>
                  <span className="text-muted-foreground/40 mx-0.5">&rarr;</span>
                  <span className="font-semibold text-foreground/80 flex-1 text-left truncate">
                    {r.player ? r.player.displayName : "???"}
                  </span>
                  <span className="font-mono text-muted-foreground tabular-nums w-8 text-right">
                    {r.player ? r.playerGoals : "-"}
                  </span>
                  <span className={`font-bold tabular-nums w-10 text-right ${
                    r.finalPoints > 0 ? "text-emerald-400" : "text-red-400/60"
                  }`}>
                    {r.finalPoints > 0 ? `+${r.finalPoints}` : "0"}
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
