import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { tournaments, type Tournament, type SlamPlayer } from "@/data/slams";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Trophy, ChevronRight, RotateCcw, Star, Flame, Home, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

const QUESTION_TIME = 30;
const MAX_SKIPS = 3;

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['\-\s]/g, "");
}

function getStreakLevel(count: number): { label: string; color: string; emoji: string } {
  if (count >= 15) return { label: "LEGENDARY", color: "text-amber-400", emoji: "🔥" };
  if (count >= 10) return { label: "ON FIRE", color: "text-orange-400", emoji: "🔥" };
  if (count >= 5) return { label: "HOT STREAK", color: "text-emerald-400", emoji: "⚡" };
  return { label: "", color: "", emoji: "" };
}

interface AnsweredTournament {
  tournament: Tournament;
  player: SlamPlayer;
  id: number;
}

type GameState = "idle" | "playing" | "finished";

interface SurfaceTheme {
  bg: string;
  glow1: string;
  glow2: string;
  accent: string;
  accentText: string;
  name: string;
}

function getSurfaceTheme(tournament: Tournament): SurfaceTheme {
  if (tournament.tournament === "Wimbledon") {
    return {
      bg: "bg-green-500/5",
      glow1: "bg-green-500/10",
      glow2: "bg-emerald-500/8",
      accent: "from-green-500 to-emerald-400",
      accentText: "text-green-400",
      name: "Grass",
    };
  }
  if (tournament.tournament === "Roland Garros") {
    return {
      bg: "bg-orange-500/5",
      glow1: "bg-orange-500/10",
      glow2: "bg-red-500/8",
      accent: "from-orange-500 to-red-400",
      accentText: "text-orange-400",
      name: "Clay",
    };
  }
  if (tournament.tournament === "Australian Open") {
    return {
      bg: "bg-blue-500/5",
      glow1: "bg-blue-500/10",
      glow2: "bg-cyan-500/8",
      accent: "from-blue-500 to-cyan-400",
      accentText: "text-blue-400",
      name: "Hard",
    };
  }
  return {
    bg: "bg-indigo-500/5",
    glow1: "bg-indigo-500/10",
    glow2: "bg-blue-500/8",
    accent: "from-indigo-500 to-blue-400",
    accentText: "text-indigo-400",
    name: "Hard",
  };
}

function buildPlayerLookup(tournament: Tournament): Map<string, SlamPlayer> {
  const lookup = new Map<string, SlamPlayer>();
  for (const player of tournament.players) {
    const fullKey = normalizeName(player.name);
    if (!lookup.has(fullKey)) lookup.set(fullKey, player);

    const parts = player.name.trim().split(/\s+/);
    if (parts.length > 1) {
      const lastName = parts[parts.length - 1];
      const lastKey = normalizeName(lastName);
      if (!lookup.has(lastKey)) lookup.set(lastKey, player);
    }

    for (const part of parts) {
      const partKey = normalizeName(part);
      if (partKey.length > 2 && !lookup.has(partKey)) {
        lookup.set(partKey, player);
      }
    }
  }
  return lookup;
}

function buildGlobalNameLookup(): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const t of tournaments) {
    for (const p of t.players) {
      const fullKey = normalizeName(p.name);
      if (!lookup.has(fullKey)) lookup.set(fullKey, p.name);
      const parts = p.name.trim().split(/\s+/);
      if (parts.length > 1) {
        const lastKey = normalizeName(parts[parts.length - 1]);
        if (!lookup.has(lastKey)) lookup.set(lastKey, p.name);
      }
      for (const part of parts) {
        const partKey = normalizeName(part);
        if (partKey.length > 2 && !lookup.has(partKey)) lookup.set(partKey, p.name);
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

const validTournaments = tournaments.filter((t) => t.players.length > 0);

export default function SlamChain() {
  const [, setLocation] = useLocation();

  const [shuffledTournaments, setShuffledTournaments] = useState(() => shuffleArray(validTournaments));
  const globalNames = useMemo(() => buildGlobalNameLookup(), []);

  const [gameState, setGameState] = useState<GameState>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [inputValue, setInputValue] = useState("");
  const [usedPlayers, setUsedPlayers] = useState<Set<string>>(new Set());
  const [answeredTournaments, setAnsweredTournaments] = useState<AnsweredTournament[]>([]);
  const [score, setScore] = useState(0);
  const [skipsLeft, setSkipsLeft] = useState(MAX_SKIPS);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(sessionStorage.getItem("slamchain-highscore") || "0");
    } catch {
      return 0;
    }
  });
  const [showCorrect, setShowCorrect] = useState(false);
  const [showWrong, setShowWrong] = useState(false);
  const [failReason, setFailReason] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentTournament = shuffledTournaments[currentIndex] || null;
  const theme = currentTournament ? getSurfaceTheme(currentTournament) : getSurfaceTheme(tournaments[0]);
  const streak = getStreakLevel(score);
  const currentLookup = useMemo(
    () => (currentTournament ? buildPlayerLookup(currentTournament) : new Map<string, string>()),
    [currentTournament]
  );
  const streakTier = score >= 15 ? 3 : score >= 10 ? 2 : score >= 5 ? 1 : 0;

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
            sessionStorage.setItem("slamchain-highscore", prev.toString());
          } catch {}
        }
        return prev;
      });
    },
    [highScore]
  );

  const startGame = useCallback(() => {
    setShuffledTournaments(shuffleArray(validTournaments));
    setGameState("playing");
    setCurrentIndex(0);
    setTimeLeft(QUESTION_TIME);
    setInputValue("");
    setUsedPlayers(new Set());
    setAnsweredTournaments([]);
    setScore(0);
    setSkipsLeft(MAX_SKIPS);
    setShowCorrect(false);
    setShowWrong(false);
    setFailReason("");
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100);
  }, []);

  const moveToNext = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= shuffledTournaments.length) {
      endGame("You've answered every tournament!");
      return;
    }
    setCurrentIndex(nextIndex);
    setTimeLeft(QUESTION_TIME);
    setInputValue("");
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100);
  }, [currentIndex, shuffledTournaments.length, endGame]);

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
      if (gameState !== "playing" || !currentTournament) return;

      const trimmed = inputValue.trim();
      if (!trimmed) return;

      const normalizedInput = normalizeName(trimmed);
      const matchedPlayer = currentLookup.get(normalizedInput);

      if (!matchedPlayer) {
        setShowWrong(true);
        setTimeout(() => setShowWrong(false), 500);
        const knownName = globalNames.get(normalizedInput);
        const displayGuess = knownName || toSentenceCase(trimmed);
        endGame(`${displayGuess} didn't play in the R16+ of ${currentTournament.tournament} ${currentTournament.year}`);
        return;
      }

      const playerKey = normalizeName(matchedPlayer.name);
      if (usedPlayers.has(playerKey)) {
        setShowWrong(true);
        setTimeout(() => setShowWrong(false), 500);
        endGame(`You already used ${matchedPlayer.name}!`);
        return;
      }

      setShowCorrect(true);
      setTimeout(() => setShowCorrect(false), 400);

      setUsedPlayers((prev) => new Set(prev).add(playerKey));
      setAnsweredTournaments((prev) => [
        ...prev,
        { tournament: currentTournament, player: matchedPlayer, id: Date.now() },
      ]);
      setScore((prev) => prev + 1);

      moveToNext();
    },
    [gameState, inputValue, currentTournament, currentLookup, usedPlayers, endGame, moveToNext]
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
      <SlamStartScreen highScore={highScore} onStart={startGame} onHome={goHome} />
    );
  }

  if (gameState === "finished") {
    return (
      <SlamEndScreen
        answeredTournaments={answeredTournaments}
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
        <motion.div
          key={currentTournament?.tournament}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7 }}
          className={`absolute inset-0 ${theme.bg}`}
        />
        <motion.div
          key={`g1-${currentTournament?.tournament}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7 }}
          className={`absolute top-0 left-1/4 w-96 h-96 ${theme.glow1} rounded-full blur-3xl`}
        />
        <motion.div
          key={`g2-${currentTournament?.tournament}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7 }}
          className={`absolute bottom-0 right-1/4 w-80 h-80 ${theme.glow2} rounded-full blur-3xl`}
        />
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
              <Trophy className={`w-3.5 h-3.5 ${theme.accentText}`} />
              <span className={`text-sm font-bold ${theme.accentText}`} data-testid="text-score">
                {score}
              </span>
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
            className={`h-full rounded-full ${isUrgent ? "bg-red-500" : isWarning ? "bg-amber-500" : `bg-gradient-to-r ${theme.accent}`}`}
            animate={{ width: `${timerPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="sm:flex-1 flex flex-col items-center min-h-0">
          <motion.div
            key={scoreKey(score)}
            className="text-center mb-1 sm:mb-2"
            animate={score > 0 ? { scale: [1, 1.08, 1] } : {}}
            transition={{ duration: 0.2 }}
          >
            <div className={`text-4xl sm:text-6xl font-bold tabular-nums bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent`} data-testid="text-main-score">
              {score}
            </div>
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-medium">
              correct
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

          {answeredTournaments.length > 0 && (
            <div className="w-full mb-2 sm:mb-3 max-h-[80px] sm:max-h-[140px] overflow-y-auto rounded-md scrollbar-thin">
              <div className="flex flex-wrap gap-1.5 justify-center px-2 py-2">
                {answeredTournaments.map((a) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.7, scale: 1 }}
                    className="px-2 py-0.5 rounded-md bg-card border border-border/50 text-xs"
                  >
                    <span className="font-semibold text-foreground/80">{a.player.name}</span>
                    <span className={`ml-1 text-[9px] font-bold ${a.player.tour === "WTA" ? "text-pink-400/60" : "text-blue-400/60"}`}>{a.player.tour}</span>
                    <span className="text-muted-foreground ml-1 text-[10px]">
                      {a.tournament.tournament.replace("Australian Open", "AO").replace("Roland Garros", "RG").replace("Wimbledon", "W").replace("US Open", "USO")} '{String(a.tournament.year).slice(2)}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {currentTournament && (
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="mb-3 sm:mb-6 text-center"
              >
                <div className={`text-[10px] sm:text-sm font-bold uppercase tracking-widest mb-1 sm:mb-2 ${theme.accentText}`}>
                  {theme.name} Court
                </div>
                <div className="text-2xl sm:text-5xl font-black text-foreground tracking-tight mb-0.5 sm:mb-1">
                  {currentTournament.tournament}
                </div>
                <div className={`text-3xl sm:text-6xl font-black bg-gradient-to-r ${theme.accent} bg-clip-text text-transparent`}>
                  {currentTournament.year}
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
                placeholder="Name a player..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-testid="input-player"
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

function scoreKey(s: number) {
  return `score-${s}`;
}

function SlamStartScreen({
  highScore,
  onStart,
  onHome,
}: {
  highScore: number;
  onStart: () => void;
  onHome: () => void;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-emerald-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-blue-500/6 rounded-full blur-3xl" />
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
          className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/5 border border-emerald-500/20 flex items-center justify-center shadow-xl shadow-emerald-500/10"
        >
          <Trophy className="w-12 h-12 text-emerald-400" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-5xl font-black text-foreground mb-8 tracking-tight"
        >
          Slam
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Chain
          </span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-3 mb-10 inline-flex flex-col items-start"
        >
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-emerald-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              You'll be shown a <span className="text-foreground font-semibold">Grand Slam tournament</span>
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-blue-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <ChevronRight className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              Name any player who reached the <span className="text-foreground font-semibold">Round of 16 or later</span>
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="w-6 h-6 rounded-md bg-purple-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <X className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-semibold">No player</span> can be named twice across the whole game
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
            className="mb-6"
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
            className="text-lg px-12 py-6 font-bold shadow-xl shadow-emerald-500/20 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
            data-testid="button-start"
          >
            Start Game
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}

function SlamEndScreen({
  answeredTournaments,
  score,
  highScore,
  failReason,
  onRestart,
  onHome,
}: {
  answeredTournaments: AnsweredTournament[];
  score: number;
  highScore: number;
  failReason: string;
  onRestart: () => void;
  onHome: () => void;
}) {
  const isNewHighScore = score >= highScore && score > 0;
  const tournamentOrder = ["Australian Open", "Roland Garros", "Wimbledon", "US Open"];
  const chronologicalAnswers = [...answeredTournaments].sort((a, b) => {
    if (a.tournament.year !== b.tournament.year) return a.tournament.year - b.tournament.year;
    return tournamentOrder.indexOf(a.tournament.tournament) - tournamentOrder.indexOf(b.tournament.tournament);
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 py-12 relative overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none">
        {isNewHighScore && (
          <>
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/8 rounded-full blur-3xl animate-pulse-glow" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-500/8 rounded-full blur-3xl animate-pulse-glow" />
          </>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-lg w-full relative z-10"
      >
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
            tournaments answered correctly
          </div>
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

        {answeredTournaments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-6 mb-8"
          >
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
              Your Answers
            </h3>
            <div className="flex justify-between max-w-md mx-auto px-1 mb-3">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">ATP</span>
              <span className="text-[10px] font-bold text-pink-400 uppercase tracking-widest">WTA</span>
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              {chronologicalAnswers.map((a, i) => {
                const t = getSurfaceTheme(a.tournament);
                const label = `${a.tournament.tournament.replace("Australian Open", "AO").replace("Roland Garros", "RG").replace("Wimbledon", "W").replace("US Open", "USO")} ${a.tournament.year}`;
                const isWTA = a.player.tour === "WTA";
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: isWTA ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.04 }}
                    className={`flex items-center gap-2 ${isWTA ? "flex-row-reverse" : ""}`}
                  >
                    <div className={`w-20 flex-shrink-0 ${isWTA ? "text-left" : "text-right"}`}>
                      <span className={`font-bold text-xs ${t.accentText}`}>
                        {label}
                      </span>
                    </div>
                    <div className={`flex-1 h-7 rounded-sm flex items-center px-2.5 ${isWTA ? "bg-gradient-to-l justify-end" : "bg-gradient-to-r"} ${t.accent}`}>
                      <span className="text-xs font-bold text-white truncate">
                        {a.player.name}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex items-center justify-center gap-3"
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
            className="text-lg px-10 font-bold shadow-xl shadow-emerald-500/20 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
            data-testid="button-restart"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Play Again
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
