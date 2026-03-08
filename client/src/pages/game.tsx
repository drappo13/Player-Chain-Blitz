import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { players, type Player } from "@/data/players";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Trophy, Zap, Target, ChevronRight, RotateCcw, Star, Flame, Flag, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

const GAME_DURATION = 90;

function normalizeChar(c: string): string {
  return c
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ß/g, "s");
}

interface GuessedPlayer extends Player {
  id: number;
}

type GameState = "idle" | "playing" | "finished";

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/['\-\s]/g, "");
}

function getCommonSurname(p: Player): string {
  const displayParts = p.displayName.trim().split(/\s+/);
  if (displayParts.length > 1) {
    return displayParts[displayParts.length - 1];
  }
  return p.lastName;
}

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
    for (const part of displayParts) {
      const partKey = normalizeName(part);
      if (partKey.length > 2 && !lookup.has(partKey)) {
        lookup.set(partKey, { ...p, lastName: part });
      }
    }
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
  return lookup;
}

function getStreakLevel(count: number): { label: string; color: string; glowColor: string; bgClass: string; emoji: string } {
  if (count >= 15) return { label: "LEGENDARY", color: "text-amber-400", glowColor: "shadow-amber-500/30", bgClass: "bg-amber-500/8", emoji: "🔥" };
  if (count >= 10) return { label: "ON FIRE", color: "text-orange-400", glowColor: "shadow-orange-500/20", bgClass: "bg-orange-500/6", emoji: "🔥" };
  if (count >= 5) return { label: "HOT STREAK", color: "text-emerald-400", glowColor: "shadow-emerald-500/20", bgClass: "bg-emerald-500/5", emoji: "⚡" };
  return { label: "", color: "", glowColor: "", bgClass: "", emoji: "" };
}

function getBarColor(goals: number): string {
  if (goals >= 150) return "from-red-500 to-red-400";
  if (goals >= 100) return "from-orange-500 to-orange-400";
  if (goals >= 80) return "from-amber-500 to-yellow-400";
  if (goals >= 50) return "from-yellow-500 to-lime-400";
  if (goals >= 20) return "from-emerald-500 to-green-400";
  if (goals >= 10) return "from-teal-500 to-cyan-400";
  return "from-sky-500 to-blue-400";
}

export default function Game() {
  const playerLookup = useMemo(() => buildPlayerLookup(), []);
  const [, navigate] = useLocation();

  const [gameState, setGameState] = useState<GameState>("idle");
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [currentLetter, setCurrentLetter] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [guessedPlayers, setGuessedPlayers] = useState<GuessedPlayer[]>([]);
  const [usedNames, setUsedNames] = useState<Set<string>>(new Set());
  const [totalGoals, setTotalGoals] = useState(0);
  const [guessCount, setGuessCount] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(sessionStorage.getItem("chaingoal-highscore") || "0");
    } catch {
      return 0;
    }
  });
  const [showCorrect, setShowCorrect] = useState(false);
  const [showWrong, setShowWrong] = useState(false);
  const [lastAddedGoals, setLastAddedGoals] = useState(0);
  const [scoreKey, setScoreKey] = useState(0);
  const [passUsed, setPassUsed] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const answersEndRef = useRef<HTMLDivElement>(null);

  const getRandomLetter = useCallback(() => {
    const letters = "abcdefghijklmnoprstuvwyz";
    return letters[Math.floor(Math.random() * letters.length)];
  }, []);

  const startGame = useCallback(() => {
    setGameState("playing");
    setTimeLeft(GAME_DURATION);
    const letter = getRandomLetter();
    setCurrentLetter(letter);
    setInputValue("");
    setGuessedPlayers([]);
    setUsedNames(new Set());
    setTotalGoals(0);
    setGuessCount(0);
    setShowCorrect(false);
    setShowWrong(false);
    setLastAddedGoals(0);
    setPassUsed(false);
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100);
  }, [getRandomLetter]);

  const goHome = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    navigate("/");
  }, [navigate]);

  const endGame = useCallback(() => {
    setGameState("finished");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTotalGoals((prev) => {
      if (prev > highScore) {
        setHighScore(prev);
        try {
          sessionStorage.setItem("chaingoal-highscore", prev.toString());
        } catch {}
      }
      return prev;
    });
  }, [highScore]);

  useEffect(() => {
    if (gameState === "playing") {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameState, endGame]);

  useEffect(() => {
    if (answersEndRef.current) {
      const container = answersEndRef.current.closest('.overflow-y-auto');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [guessedPlayers.length]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (gameState !== "playing") return;

      const guess = inputValue.trim();
      if (!guess) return;

      const guessNorm = normalizeName(guess);

      if (currentLetter && !guessNorm.startsWith(currentLetter)) {
        setShowWrong(true);
        setTimeout(() => setShowWrong(false), 400);
        return;
      }

      const player = playerLookup.get(guessNorm);
      if (!player) {
        setShowWrong(true);
        setTimeout(() => setShowWrong(false), 400);
        return;
      }

      const playerKey = player.displayName.toLowerCase();
      if (usedNames.has(playerKey)) {
        setShowWrong(true);
        setTimeout(() => setShowWrong(false), 400);
        return;
      }

      setShowCorrect(true);
      setTimeout(() => setShowCorrect(false), 500);

      const newGuessed: GuessedPlayer = { ...player, id: Date.now() };
      setGuessedPlayers((prev) => [...prev, newGuessed]);
      setUsedNames((prev) => new Set(prev).add(playerKey));
      setTotalGoals((prev) => prev + player.goals);
      setLastAddedGoals(player.goals);
      setGuessCount((prev) => prev + 1);
      setScoreKey((prev) => prev + 1);

      const lastName = player.lastName;
      const lastChar = normalizeChar(lastName[lastName.length - 1]);
      setCurrentLetter(lastChar);
      setInputValue("");
    },
    [gameState, inputValue, currentLetter, usedNames, playerLookup]
  );

  const handlePass = useCallback(() => {
    if (gameState !== "playing" || passUsed) return;
    setPassUsed(true);
    setCurrentLetter(getRandomLetter());
    setInputValue("");
    inputRef.current?.focus({ preventScroll: true });
  }, [gameState, passUsed, getRandomLetter]);

  const timerPercent = (timeLeft / GAME_DURATION) * 100;
  const isUrgent = timeLeft <= 10;
  const isWarning = timeLeft <= 30;
  const streak = getStreakLevel(guessCount);

  const streakTier = guessCount >= 15 ? 3 : guessCount >= 10 ? 2 : guessCount >= 5 ? 1 : 0;
  const floatingEmojis = useMemo(() => {
    if (!streak.emoji) return [];
    const count = streakTier === 3 ? 12 : streakTier === 2 ? 8 : 4;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      emoji: streak.emoji,
      left: `${5 + Math.random() * 90}%`,
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 4,
      size: 16 + Math.random() * 16,
    }));
  }, [streak.emoji, streakTier]);

  if (gameState === "idle") {
    return <StartScreen highScore={highScore} onStart={startGame} onHome={goHome} />;
  }

  if (gameState === "finished") {
    return (
      <EndScreen
        guessedPlayers={guessedPlayers}
        totalGoals={totalGoals}
        highScore={highScore}
        onRestart={startGame}
        onHome={goHome}
      />
    );
  }

  return (
    <div className="bg-background relative transition-colors duration-1000 overflow-x-hidden sm:min-h-screen">
      <div className="fixed inset-0 pointer-events-none transition-opacity duration-1000">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-chart-2/5 rounded-full blur-3xl" />
        {streak.bgClass && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`absolute inset-0 ${streak.bgClass} transition-all duration-1000`}
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`absolute top-0 left-0 w-full h-1/2 ${streak.bgClass} blur-3xl`}
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`absolute bottom-0 right-0 w-full h-1/2 ${streak.bgClass} blur-3xl`}
            />
          </>
        )}
        <AnimatePresence>
          {floatingEmojis.map((e) => (
            <motion.span
              key={`${e.id}-${streak.emoji}`}
              initial={{ opacity: 0, y: "100vh" }}
              animate={{ opacity: [0, 0.6, 0.6, 0], y: "-20vh" }}
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
        <div className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-2.5">
            <button
              onClick={goHome}
              className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors"
              data-testid="button-home"
            >
              <Home className="w-4 h-4" />
            </button>
            <div className={`p-1.5 rounded-md ${isUrgent ? "bg-red-500/20" : isWarning ? "bg-amber-500/15" : "bg-primary/15"}`}>
              <Timer className={`w-4 h-4 ${isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : "text-primary"}`} />
            </div>
            <span
              className={`text-2xl font-mono font-bold tabular-nums ${isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : "text-foreground"} ${isUrgent ? "animate-countdown-pulse" : ""}`}
              data-testid="text-timer"
            >
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground" data-testid="text-guess-count">
                {guessCount}
              </span>
            </div>
            {highScore > 0 && (
              <div className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-sm font-medium text-amber-400/80" data-testid="text-high-score">
                  {highScore}
                </span>
              </div>
            )}
            <button
              onClick={endGame}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              data-testid="button-give-up"
            >
              <Flag className="w-3.5 h-3.5" />
              End
            </button>
          </div>
        </div>

        <div className="w-full h-1 rounded-full bg-muted/50 mb-3 sm:mb-6">
          <motion.div
            className={`h-full rounded-full ${isUrgent ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-primary"}`}
            style={{ width: `${timerPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="sm:flex-1 flex flex-col items-center min-h-0">
          <motion.div
            key={scoreKey}
            className="text-center mb-2 sm:mb-4"
            animate={scoreKey > 0 ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.25 }}
          >
            <div
              className="text-5xl sm:text-7xl font-bold tabular-nums bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent"
              data-testid="text-score"
            >
              {totalGoals}
            </div>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
                goals
              </span>
              <AnimatePresence mode="wait">
                {lastAddedGoals > 0 && guessCount > 0 && (
                  <motion.span
                    key={scoreKey}
                    className="text-sm font-bold text-primary"
                    initial={{ opacity: 0, y: -8, scale: 1.3 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.2 }}
                    data-testid="text-last-added"
                  >
                    +{lastAddedGoals}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
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

          {guessedPlayers.length > 0 && (
            <div className="hidden sm:block w-full mb-2 sm:mb-3 max-h-[80px] sm:max-h-[160px] overflow-y-auto rounded-md scrollbar-thin">
              <div className="flex flex-wrap gap-1.5 justify-center px-2 py-2">
                {guessedPlayers.slice(0, -1).map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.7, scale: 1 }}
                    className="px-2 py-0.5 rounded-md bg-card border border-border/50 text-xs"
                  >
                    <span className="font-semibold text-foreground/80">{p.lastName}</span>
                    <span className="text-muted-foreground ml-1 text-[10px]">{p.firstName}</span>
                    <span className="ml-1 text-[10px] font-mono text-primary/70 font-bold">{p.goals}</span>
                  </motion.div>
                ))}
                <div ref={answersEndRef} />
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {guessedPlayers.length > 0 && (
              <motion.div
                key={guessedPlayers[guessedPlayers.length - 1].id}
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="mb-2 sm:mb-4 px-4 sm:px-5 py-1.5 sm:py-2.5 rounded-md bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/25"
              >
                <span className="text-lg font-bold text-foreground">
                  {guessedPlayers[guessedPlayers.length - 1].lastName}
                </span>
                <span className="text-sm text-muted-foreground ml-2">
                  {guessedPlayers[guessedPlayers.length - 1].firstName}
                </span>
                <span className="ml-2.5 text-sm font-mono text-primary font-bold">
                  +{guessedPlayers[guessedPlayers.length - 1].goals}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-full max-w-md mx-auto mb-2 sm:mb-4 sm:mt-auto">
            {currentLetter && (
              <motion.div
                key={currentLetter}
                initial={{ opacity: 0, scale: 0.5, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="text-center mb-2 sm:mb-3"
              >
                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest">
                  Starts with
                </span>
                <div
                  className="text-4xl sm:text-6xl font-black uppercase tracking-wider bg-gradient-to-b from-primary to-primary/60 bg-clip-text text-transparent"
                  data-testid="text-current-letter"
                >
                  {currentLetter}
                </div>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type a surname..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                onFocus={() => setTimeout(() => window.scrollTo({ top: 0 }), 300)}
                data-testid="input-surname"
                className={`w-full text-center text-lg sm:text-xl font-semibold px-4 sm:px-6 py-3 sm:py-4 rounded-md border-2 bg-card text-foreground placeholder:text-muted-foreground/50 outline-none transition-all duration-150 ${
                  showCorrect
                    ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/20"
                    : showWrong
                      ? "border-red-500 bg-red-500/10 shadow-lg shadow-red-500/20 animate-shake"
                      : "border-border/60 focus:border-primary/60 focus:shadow-lg focus:shadow-primary/10"
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
              {!passUsed ? (
                <button
                  onClick={handlePass}
                  className="text-sm uppercase tracking-wider font-bold text-amber-400 px-4 py-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 transition-all duration-150 shadow-sm shadow-amber-500/10"
                  data-testid="button-pass"
                >
                  🔀 Pass
                </button>
              ) : (
                <span className="text-xs uppercase tracking-wider text-muted-foreground/40 px-4 py-1.5">
                  Pass used
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
              className="absolute inset-0 bg-emerald-500"
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
        data-testid="button-home-start"
      >
        <Home className="w-5 h-5" />
      </button>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-chart-2/6 rounded-full blur-3xl" />
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
          className="w-16 h-16 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-8 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-xl shadow-primary/10"
        >
          <Zap className="w-8 h-8 sm:w-12 sm:h-12 text-primary" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl sm:text-5xl font-black text-foreground mb-4 sm:mb-8 tracking-tight"
        >
          Goal
          <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
            Chain
          </span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-2 sm:space-y-3 mb-6 sm:mb-10 inline-flex flex-col items-start"
        >
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Target className="w-3.5 h-3.5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              Name any player with a
              <span className="font-semibold text-foreground"> Premier League goal</span>
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-chart-2/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <ChevronRight className="w-3.5 h-3.5 text-chart-2" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              Each surname must start with the
              <span className="font-semibold text-foreground"> last letter </span>
              of the previous one
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-chart-4/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Flame className="w-3.5 h-3.5 text-chart-4" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              Your score is the
              <span className="font-semibold text-primary"> total goals </span>
              of every player you name
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Timer className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              You have
              <span className="font-semibold text-foreground"> 90 seconds</span>
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
            <span className="font-bold text-lg text-amber-400" data-testid="text-high-score-start">
              {highScore} goals
            </span>
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
            className="text-lg px-12 py-6 font-bold shadow-xl shadow-primary/20"
            data-testid="button-start"
          >
            Start Game
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}

function EndScreen({
  guessedPlayers,
  totalGoals,
  highScore,
  onRestart,
  onHome,
}: {
  guessedPlayers: GuessedPlayer[];
  totalGoals: number;
  highScore: number;
  onRestart: () => void;
  onHome: () => void;
}) {
  const isNewHighScore = totalGoals >= highScore && totalGoals > 0;

  const sortedByGoals = [...guessedPlayers].sort((a, b) => b.goals - a.goals);
  const maxGoals = sortedByGoals.length > 0 ? sortedByGoals[0].goals : 1;


  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 py-12 relative overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none">
        {isNewHighScore && (
          <>
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/8 rounded-full blur-3xl animate-pulse-glow" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary/8 rounded-full blur-3xl animate-pulse-glow" />
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
          <Button
            onClick={onHome}
            variant="outline"
            size="lg"
            className="font-bold"
            data-testid="button-home-end"
          >
            <Home className="w-5 h-5 mr-2" />
            Home
          </Button>
          <Button
            onClick={onRestart}
            size="lg"
            className="text-lg px-10 font-bold shadow-xl shadow-primary/20"
            data-testid="button-restart"
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
            {totalGoals}
          </div>
          <div className="text-muted-foreground text-xs uppercase tracking-widest mt-2">
            total goals from {guessedPlayers.length} players
          </div>
        </motion.div>

        {guessedPlayers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 mb-8"
          >
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Goal Contributions
            </h3>
            <div className="space-y-1.5 max-w-sm mx-auto">
              {sortedByGoals.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.06 }}
                  className="flex items-center gap-2.5"
                >
                  <div className="w-20 text-right flex-shrink-0">
                    <span className="font-semibold text-xs text-foreground/80">
                      {p.lastName}
                    </span>
                  </div>
                  <div className="flex-1 h-6 bg-card rounded-sm relative border border-border/30">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(p.goals / maxGoals) * 100}%`,
                      }}
                      transition={{ delay: 0.6 + i * 0.06, duration: 0.6, ease: "easeOut" }}
                      className={`h-full bg-gradient-to-r ${getBarColor(p.goals)} rounded-sm`}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-foreground/80">
                      {p.goals}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {guessedPlayers.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mb-8"
          >
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
              Your Chain
            </h3>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {guessedPlayers.map((p, i) => (
                <span key={p.id} className="flex items-center gap-0.5">
                  <span className="px-2 py-0.5 rounded-sm bg-card border border-border/30 text-xs font-medium">
                    {p.lastName}
                    <span className="ml-1 text-[10px] font-mono text-primary/70">
                      {p.goals}
                    </span>
                  </span>
                  {i < guessedPlayers.length - 1 && (
                    <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/40 flex-shrink-0" />
                  )}
                </span>
              ))}
            </div>
          </motion.div>
        )}

      </motion.div>
    </div>
  );
}
