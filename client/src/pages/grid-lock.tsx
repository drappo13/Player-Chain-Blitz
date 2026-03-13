import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { seasons, getTeamColor, type F1Driver, type F1Season } from "@/data/f1seasons";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Trophy, ChevronRight, RotateCcw, Star, Flame, Home, SkipForward, X, Flag, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { playCorrect, playWrong, playTick, playGameEnd, playHighScore } from "@/lib/sounds";

const QUESTION_TIME = 30;
const MAX_SKIPS = 3;

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

function buildDriverLookup(season: F1Season): Map<string, F1Driver> {
  const lookup = new Map<string, F1Driver>();
  for (const driver of season.drivers) {
    if (driver.points <= 0) continue;
    const fullKey = normalizeName(driver.name);
    if (!lookup.has(fullKey)) lookup.set(fullKey, driver);

    const parts = driver.name.trim().split(/\s+/);
    if (parts.length > 1) {
      const lastName = parts[parts.length - 1];
      const lastKey = normalizeName(lastName);
      if (!lookup.has(lastKey)) lookup.set(lastKey, driver);
    }
  }
  return lookup;
}

function buildGlobalDriverLookup(): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const s of seasons) {
    for (const d of s.drivers) {
      const fullKey = normalizeName(d.name);
      if (!lookup.has(fullKey)) lookup.set(fullKey, d.name);
      const parts = d.name.trim().split(/\s+/);
      if (parts.length > 1) {
        const lastKey = normalizeName(parts[parts.length - 1]);
        if (!lookup.has(lastKey)) lookup.set(lastKey, d.name);
      }
    }
  }
  return lookup;
}

function toSentenceCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getStreakLevel(score: number) {
  if (score >= 15) return { label: "LEGENDARY", emoji: "🏎️", color: "text-red-400" };
  if (score >= 10) return { label: "ON FIRE", emoji: "🔥", color: "text-orange-400" };
  if (score >= 5) return { label: "HOT STREAK", emoji: "🏁", color: "text-amber-400" };
  return { label: "", emoji: "", color: "" };
}

type GameState = "idle" | "playing" | "finished";

interface AnsweredDriver {
  season: F1Season;
  driver: F1Driver;
  id: number;
}

const validSeasons = seasons.filter((s) => s.drivers.some((d) => d.points > 0));

export default function GridLock() {
  const [, setLocation] = useLocation();

  const [shuffledSeasons, setShuffledSeasons] = useState(() => shuffleArray(validSeasons));
  const globalNames = useMemo(() => buildGlobalDriverLookup(), []);

  const [gameState, setGameState] = useState<GameState>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [inputValue, setInputValue] = useState("");
  const [usedDrivers, setUsedDrivers] = useState<Set<string>>(new Set());
  const [answeredDrivers, setAnsweredDrivers] = useState<AnsweredDriver[]>([]);
  const [score, setScore] = useState(0);
  const [lastAddedPoints, setLastAddedPoints] = useState(0);
  const [skipsLeft, setSkipsLeft] = useState(MAX_SKIPS);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(sessionStorage.getItem("gridlock-highscore") || "0");
    } catch {
      return 0;
    }
  });
  const [showCorrect, setShowCorrect] = useState(false);
  const [showWrong, setShowWrong] = useState(false);
  const [failReason, setFailReason] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentSeason = shuffledSeasons[currentIndex] || null;
  const streak = getStreakLevel(answeredDrivers.length);
  const currentLookup = useMemo(
    () => (currentSeason ? buildDriverLookup(currentSeason) : new Map<string, F1Driver>()),
    [currentSeason]
  );
  const streakCount = answeredDrivers.length;
  const streakTier = streakCount >= 15 ? 3 : streakCount >= 10 ? 2 : streakCount >= 5 ? 1 : 0;

  const floatingEmojis = useMemo(() => {
    if (!streak.emoji) return [];
    const count = streakTier === 3 ? 10 : streakTier === 2 ? 6 : 3;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      emoji: streak.emoji,
      left: `${5 + Math.random() * 90}%`,
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 4,
      size: 14 + Math.random() * 14,
    }));
  }, [streak.emoji, streakTier]);

  const goHome = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setLocation("/");
  }, [setLocation]);

  const endGame = useCallback(
    (reason: string) => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setFailReason(reason);
      setGameState("finished");
      setScore((prev) => {
        if (prev > highScore) {
          setHighScore(prev);
          try {
            sessionStorage.setItem("gridlock-highscore", prev.toString());
          } catch {}
        }
        return prev;
      });
    },
    [highScore]
  );

  const startGame = useCallback(() => {
    setShuffledSeasons(shuffleArray(validSeasons));
    setGameState("playing");
    setCurrentIndex(0);
    setTimeLeft(QUESTION_TIME);
    setInputValue("");
    setUsedDrivers(new Set());
    setAnsweredDrivers([]);
    setScore(0);
    setLastAddedPoints(0);
    setSkipsLeft(MAX_SKIPS);
    setShowCorrect(false);
    setShowWrong(false);
    setFailReason("");
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100);
  }, []);

  const moveToNext = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= shuffledSeasons.length) {
      endGame("You've answered every season!");
      return;
    }
    setCurrentIndex(nextIndex);
    setTimeLeft(QUESTION_TIME);
    setInputValue("");
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100);
  }, [currentIndex, shuffledSeasons.length, endGame]);

  useEffect(() => {
    if (gameState !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          endGame("Time's up!");
          return 0;
        }
        if (prev <= 11) playTick();
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState, currentIndex, endGame]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (gameState !== "playing" || !currentSeason) return;

      const trimmed = inputValue.trim();
      if (!trimmed) return;

      const normalizedInput = normalizeName(trimmed);
      const matchedDriver = currentLookup.get(normalizedInput);

      if (!matchedDriver) {
        setShowWrong(true);
        playWrong();
        setTimeout(() => setShowWrong(false), 500);
        const knownName = globalNames.get(normalizedInput);
        const displayGuess = knownName || toSentenceCase(trimmed);
        const racedInSeason = currentSeason.drivers.some(
          (d) => normalizeName(d.name) === normalizeName(knownName || trimmed) ||
            (d.name.trim().split(/\s+/).length > 1 && normalizeName(d.name.trim().split(/\s+/).pop()!) === normalizedInput)
        );
        if (racedInSeason) {
          endGame(`${displayGuess} didn't score points in ${currentSeason.year}`);
        } else {
          endGame(`${displayGuess} did not race in ${currentSeason.year}`);
        }
        return;
      }

      const driverKey = normalizeName(matchedDriver.name);
      if (usedDrivers.has(driverKey)) {
        setShowWrong(true);
        playWrong();
        setTimeout(() => setShowWrong(false), 500);
        endGame(`You already used ${matchedDriver.name}!`);
        return;
      }

      setShowCorrect(true);
      playCorrect();
      setTimeout(() => setShowCorrect(false), 400);

      setUsedDrivers((prev) => new Set(prev).add(driverKey));
      setAnsweredDrivers((prev) => [
        ...prev,
        { season: currentSeason, driver: matchedDriver, id: Date.now() },
      ]);
      setLastAddedPoints(matchedDriver.points);
      setScore((prev) => prev + matchedDriver.points);
      setInputValue("");
      moveToNext();
    },
    [gameState, inputValue, currentSeason, currentLookup, usedDrivers, endGame, moveToNext, globalNames]
  );

  const handleSkip = useCallback(() => {
    if (gameState !== "playing" || skipsLeft <= 0) return;
    setSkipsLeft((prev) => prev - 1);
    moveToNext();
  }, [gameState, skipsLeft, moveToNext]);

  const timerPercent = (timeLeft / QUESTION_TIME) * 100;
  const isUrgent = timeLeft <= 5;
  const isWarning = timeLeft <= 8;

  if (gameState === "idle") {
    return (
      <GridLockStartScreen highScore={highScore} onStart={startGame} onHome={goHome} />
    );
  }

  if (gameState === "finished") {
    return (
      <GridLockEndScreen
        answeredDrivers={answeredDrivers}
        score={score}
        highScore={highScore}
        failReason={failReason}
        onRestart={startGame}
        onHome={goHome}
      />
    );
  }

  return (
    <div className="bg-background relative transition-colors duration-700 overflow-x-hidden sm:min-h-screen">
      <div className="fixed inset-0 pointer-events-none transition-all duration-700">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/20 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-orange-500/6 rounded-full blur-3xl" />
        <AnimatePresence>
          {floatingEmojis.map((em) => (
            <motion.span
              key={`${em.id}-${streak.emoji}`}
              initial={{ opacity: 0, y: "100vh" }}
              animate={{ opacity: [0, 0.5, 0.5, 0], y: "-20vh" }}
              exit={{ opacity: 0 }}
              transition={{ duration: em.duration, delay: em.delay, repeat: Infinity, ease: "linear" }}
              className="absolute select-none"
              style={{ left: em.left, fontSize: em.size }}
            >
              {em.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 py-2 sm:py-4 flex flex-col sm:min-h-screen">
        <div className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-2.5">
            <button
              onClick={goHome}
              className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors"
              data-testid="button-home"
            >
              <Home className="w-4 h-4" />
            </button>
            <div className={`p-1.5 rounded-md ${isUrgent ? "bg-red-500/20" : isWarning ? "bg-amber-500/15" : "bg-muted/30"}`}>
              <Timer className={`w-4 h-4 ${isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : "text-muted-foreground"}`} />
            </div>
            <span
              className={`text-2xl font-mono font-bold tabular-nums ${isUrgent ? "text-red-400 animate-countdown-pulse" : isWarning ? "text-amber-400" : "text-foreground"}`}
              data-testid="text-timer"
            >
              {timeLeft}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5 text-red-400" />
              <span className="text-sm font-bold text-red-400" data-testid="text-score">
                {score}
              </span>
              <AnimatePresence>
                {lastAddedPoints > 0 && showCorrect && (
                  <motion.span
                    initial={{ opacity: 1, y: 0 }}
                    animate={{ opacity: 0, y: -15 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-xs font-bold text-orange-400"
                  >
                    +{lastAddedPoints}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: MAX_SKIPS }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${i < skipsLeft ? "bg-amber-400" : "bg-muted-foreground/20"}`}
                />
              ))}
            </div>
            {highScore > 0 && (
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-sm font-medium text-amber-400/80" data-testid="text-high-score">
                  {highScore}
                </span>
              </div>
            )}
            <button
              onClick={() => endGame("Gave up")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              data-testid="button-give-up"
            >
              <X className="w-3.5 h-3.5" />
              End
            </button>
          </div>
        </div>

        <div className="w-full h-1 rounded-full bg-muted/50 mb-3 sm:mb-6">
          <motion.div
            className={`h-full rounded-full ${isUrgent ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-gradient-to-r from-red-500 to-orange-500"}`}
            animate={{ width: `${timerPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="sm:flex-1 flex flex-col items-center min-h-0">
          <motion.div
            key={`score-${score}`}
            className="text-center mb-1 sm:mb-2"
            animate={score > 0 ? { scale: [1, 1.08, 1] } : {}}
            transition={{ duration: 0.2 }}
          >
            <div className="text-4xl sm:text-6xl font-bold tabular-nums bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent" data-testid="text-main-score">
              {score}
            </div>
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-medium">
              points
            </span>
          </motion.div>

          <AnimatePresence>
            {streak.label && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full mb-3 text-xs font-bold uppercase tracking-wider ${streak.color} bg-card border border-border`}
              >
                <Flame className="w-3.5 h-3.5" />
                {streak.label}
              </motion.div>
            )}
          </AnimatePresence>

          {answeredDrivers.length > 0 && (
            <div className="hidden sm:block w-full mb-2 sm:mb-3 max-h-[80px] sm:max-h-[140px] overflow-y-auto rounded-md scrollbar-thin">
              <div className="flex flex-wrap gap-1.5 justify-center px-2 py-2">
                {answeredDrivers.map((a) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.7, scale: 1 }}
                    className="px-2 py-0.5 rounded-md bg-card border border-border/50 text-xs"
                  >
                    <span className="font-semibold text-foreground/80">{a.driver.name}</span>
                    <span className="ml-1 text-[9px] font-bold" style={{ color: getTeamColor(a.driver.team) }}>{a.driver.team}</span>
                    <span className="text-muted-foreground ml-1 text-[10px]">+{a.driver.points}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {currentSeason && (
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="mb-3 sm:mb-6 text-center"
              >
                <div className="text-[10px] sm:text-sm font-bold uppercase tracking-widest mb-1 sm:mb-2 text-red-400">
                  Season
                </div>
                <div className="text-5xl sm:text-8xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                  {currentSeason.year}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-full max-w-md mx-auto mb-2 sm:mb-4 sm:mt-auto">
            <form onSubmit={handleSubmit} className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Name a driver..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                onFocus={() => setTimeout(() => window.scrollTo({ top: 0 }), 300)}
                data-testid="input-driver"
                className={`w-full text-center text-lg sm:text-xl font-semibold px-4 sm:px-6 py-3 sm:py-4 rounded-md border-2 bg-card text-foreground placeholder:text-muted-foreground/50 outline-none transition-all duration-150 ${
                  showCorrect
                    ? "border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/20"
                    : showWrong
                      ? "border-red-500 bg-red-500/10 shadow-lg shadow-red-500/20 animate-shake"
                      : "border-border/60 focus:border-red-500/60 focus:shadow-lg focus:shadow-red-500/10"
                }`}
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md text-muted-foreground/50 transition-colors"
                data-testid="button-submit"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </form>

            <div className="flex items-center justify-center gap-4 mt-3">
              <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider">
                Enter to submit
              </p>
              {skipsLeft > 0 ? (
                <button
                  onClick={handleSkip}
                  className="text-sm uppercase tracking-wider font-bold text-amber-400 px-4 py-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 transition-all duration-150 shadow-sm shadow-amber-500/10"
                  data-testid="button-skip"
                >
                  🔀 Skip ({skipsLeft})
                </button>
              ) : (
                <span className="text-xs uppercase tracking-wider text-muted-foreground/40 px-4 py-1.5">
                  No skips left
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

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
              animate={{ opacity: 0.08 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 bg-orange-500"
            />
          </motion.div>
        )}
      </AnimatePresence>

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
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-red-500"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GridLockStartScreen({
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
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-red-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-orange-500/6 rounded-full blur-3xl" />
      </div>

      <button
        onClick={onHome}
        className="absolute top-4 left-4 p-2 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors z-20"
        data-testid="button-home-start"
      >
        <Home className="w-5 h-5" />
      </button>

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
          className="w-16 h-16 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-8 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/5 border border-red-500/20 flex items-center justify-center shadow-xl shadow-red-500/10"
        >
          <Flag className="w-8 h-8 sm:w-12 sm:h-12 text-red-400" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl sm:text-5xl font-black text-foreground mb-4 sm:mb-8 tracking-tight"
        >
          Grid
          <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
            Lock
          </span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-2 sm:space-y-3 mb-6 sm:mb-10 inline-flex flex-col items-start"
        >
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-red-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Flag className="w-3.5 h-3.5 text-red-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              You'll be shown an <span className="text-foreground font-semibold">F1 season year</span>
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-blue-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <ChevronRight className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              Name a driver who <span className="text-foreground font-semibold">scored points</span> that year
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-purple-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <X className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              You <span className="text-foreground font-semibold">cannot use the same driver</span> twice
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-orange-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Trophy className="w-3.5 h-3.5 text-orange-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              Score = <span className="text-foreground font-semibold">their championship points</span> that year
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-red-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Flame className="w-3.5 h-3.5 text-red-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-semibold">One wrong answer</span> and the game is over
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Timer className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-semibold">30 seconds</span> per question
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-cyan-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <SkipForward className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              You get <span className="text-foreground font-semibold">three passes</span>
            </p>
          </div>
        </motion.div>

        {highScore > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mb-4 sm:mb-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/15 text-amber-400 font-bold text-sm">
              <Star className="w-4 h-4 fill-current" />
              Best: {highScore}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            onClick={onStart}
            size="lg"
            className="text-lg px-12 py-6 font-bold shadow-xl shadow-red-500/20 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white border-red-600 focus-visible:ring-orange-500"
            data-testid="button-start"
          >
            Start Game
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}

function GridLockEndScreen({
  answeredDrivers,
  score,
  highScore,
  failReason,
  onRestart,
  onHome,
}: {
  answeredDrivers: AnsweredDriver[];
  score: number;
  highScore: number;
  failReason: string;
  onRestart: () => void;
  onHome: () => void;
}) {
  const isNewHighScore = score >= highScore && score > 0;
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const text = `I scored ${score.toLocaleString()} on GridLock 🏎️ Can you beat me?\nhttps://drapk.in/gridlock`;
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
    try { (window as any).goatcounter?.count({ path: `game-played-gridlock?${Date.now()}`, title: `GridLock: ${score}pts`, event: true }); } catch {}
  }, []);

  const sortedByPoints = [...answeredDrivers].sort((a, b) => a.season.year - b.season.year);
  const maxPoints = sortedByPoints.length > 0 ? Math.max(...sortedByPoints.map(a => a.driver.points)) : 1;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 py-12 relative overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none">
        {isNewHighScore && (
          <>
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/8 rounded-full blur-3xl animate-pulse-glow" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-red-500/8 rounded-full blur-3xl animate-pulse-glow" />
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
            <Button
              onClick={onHome}
              variant="outline"
              size="lg"
              className="font-bold border-border focus-visible:ring-orange-500 flex-1"
              data-testid="button-home-end"
            >
              <Home className="w-5 h-5 mr-2" />
              Home
            </Button>
            <Button onClick={handleShare} variant="outline" size="lg" className="font-bold flex-1 border-red-500/40 text-red-400 hover:bg-red-500/10">
              <Share2 className="w-5 h-5 mr-2" />
              {copied ? "Copied!" : "Share"}
            </Button>
          </div>
          <div className="flex justify-center sm:hidden">
            <Button
              onClick={onRestart}
              size="lg"
              className="text-lg px-10 font-bold shadow-xl shadow-red-500/20 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white border-red-600 focus-visible:ring-orange-500 w-full"
              data-testid="button-restart"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Play Again
            </Button>
          </div>
          <div className="hidden sm:flex items-center justify-center gap-3">
            <Button
              onClick={onHome}
              variant="outline"
              size="lg"
              className="font-bold border-border focus-visible:ring-orange-500"
              data-testid="button-home-end"
            >
              <Home className="w-5 h-5 mr-2" />
              Home
            </Button>
            <Button
              onClick={onRestart}
              size="lg"
              className="text-lg px-10 font-bold shadow-xl shadow-red-500/20 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white border-red-600 focus-visible:ring-orange-500"
              data-testid="button-restart"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Play Again
            </Button>
            <Button onClick={handleShare} variant="outline" size="lg" className="font-bold border-red-500/40 text-red-400 hover:bg-red-500/10">
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
            className="mb-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/15 to-amber-600/10 border border-amber-500/20 text-amber-400 font-bold text-sm shadow-lg shadow-amber-500/10"
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
          <div
            className="text-8xl font-black tabular-nums bg-gradient-to-b from-foreground via-foreground to-foreground/40 bg-clip-text text-transparent"
            data-testid="text-final-score"
          >
            {score}
          </div>
          <div className="text-muted-foreground text-xs uppercase tracking-widest mt-2">
            championship points
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="mb-4 text-muted-foreground text-sm"
        >
          {answeredDrivers.length} driver{answeredDrivers.length !== 1 ? "s" : ""} named
        </motion.div>

        {failReason && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            <X className="w-4 h-4" />
            {failReason}
          </motion.div>
        )}

        {answeredDrivers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-6 mb-8"
          >
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Your Drivers
            </h3>
            <div className="space-y-1.5 max-w-md mx-auto">
              {sortedByPoints.map((a, i) => {
                const barWidth = Math.max(15, (a.driver.points / maxPoints) * 100);
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.04 }}
                    className="flex items-center gap-2"
                  >
                    <div className="w-8 flex-shrink-0 text-right">
                      <span className="text-xs font-bold text-muted-foreground">
                        {a.season.year}
                      </span>
                    </div>
                    <div
                      className="h-7 rounded-sm flex items-center px-2.5 bg-gradient-to-r from-red-500 to-orange-500"
                      style={{ width: `${barWidth}%` }}
                    >
                      <span className="text-xs font-bold text-white truncate">
                        {a.driver.name.trim().split(/\s+/).pop()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[9px] font-bold" style={{ color: getTeamColor(a.driver.team) }}>
                        {a.driver.team}
                      </span>
                      <span className="text-xs font-bold text-foreground/80">
                        {a.driver.points}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
