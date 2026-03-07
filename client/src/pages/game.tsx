import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { players, type Player } from "@/data/players";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Trophy, Zap, Target, ChevronRight, RotateCcw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    .replace(/ß/g, "ss");
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

export default function Game() {
  const playerLookup = useMemo(() => buildPlayerLookup(), []);

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
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [getRandomLetter]);

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
      answersEndRef.current.scrollIntoView({ behavior: "smooth" });
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

  const timerPercent = (timeLeft / GAME_DURATION) * 100;
  const timerColor =
    timeLeft <= 10
      ? "text-red-500"
      : timeLeft <= 30
        ? "text-amber-500"
        : "text-primary";
  const timerBarColor =
    timeLeft <= 10
      ? "bg-red-500"
      : timeLeft <= 30
        ? "bg-amber-500"
        : "bg-primary";

  if (gameState === "idle") {
    return <StartScreen highScore={highScore} onStart={startGame} />;
  }

  if (gameState === "finished") {
    return (
      <EndScreen
        guessedPlayers={guessedPlayers}
        totalGoals={totalGoals}
        highScore={highScore}
        onRestart={startGame}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="w-full max-w-2xl mx-auto px-4 py-4 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-2">
            <Timer className={`w-5 h-5 ${timerColor}`} />
            <span
              className={`text-2xl font-mono font-bold tabular-nums ${timerColor} ${timeLeft <= 10 ? "animate-countdown-pulse" : ""}`}
              data-testid="text-timer"
            >
              {Math.floor(timeLeft / 60)}:
              {(timeLeft % 60).toString().padStart(2, "0")}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Target className="w-4 h-4" />
              <span className="text-sm font-medium" data-testid="text-guess-count">
                {guessCount} guesses
              </span>
            </div>
            {highScore > 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Trophy className="w-4 h-4" />
                <span className="text-sm font-medium" data-testid="text-high-score">
                  Best: {highScore}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="w-full h-1.5 rounded-full bg-muted mb-6">
          <motion.div
            className={`h-full rounded-full ${timerBarColor}`}
            initial={{ width: "100%" }}
            animate={{ width: `${timerPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="flex-1 flex flex-col items-center">
          <motion.div
            key={scoreKey}
            className="text-center mb-6"
            animate={scoreKey > 0 ? { scale: [1, 1.12, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            <div className="text-6xl font-bold text-foreground tabular-nums" data-testid="text-score">
              {totalGoals}
            </div>
            <div className="text-sm text-muted-foreground font-medium mt-1">
              total goals
              {lastAddedGoals > 0 && guessCount > 0 && (
                <motion.span
                  key={scoreKey}
                  className="ml-2 text-primary font-bold"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  data-testid="text-last-added"
                >
                  +{lastAddedGoals}
                </motion.span>
              )}
            </div>
          </motion.div>

          {guessedPlayers.length > 0 && (
            <div className="w-full mb-4 max-h-[200px] overflow-y-auto rounded-md">
              <div className="flex flex-wrap gap-1.5 justify-center px-2 py-2">
                {guessedPlayers.slice(0, -1).map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="px-2.5 py-1 rounded-md bg-muted text-sm"
                  >
                    <span className="font-semibold">{p.lastName}</span>
                    <span className="text-muted-foreground ml-1 text-xs">
                      {p.firstName}
                    </span>
                    <span className="ml-1.5 text-xs font-mono text-primary font-bold">
                      {p.goals}
                    </span>
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
                initial={{ opacity: 0, y: 15, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                className="mb-5 px-4 py-2.5 rounded-md bg-primary/10 border border-primary/20"
              >
                <span className="text-lg font-bold text-foreground">
                  {guessedPlayers[guessedPlayers.length - 1].lastName}
                </span>
                <span className="text-sm text-muted-foreground ml-2">
                  {guessedPlayers[guessedPlayers.length - 1].firstName}
                </span>
                <span className="ml-2 text-sm font-mono text-primary font-bold">
                  +{guessedPlayers[guessedPlayers.length - 1].goals} goals
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-full max-w-md mx-auto mb-4">
            {currentLetter && (
              <motion.div
                key={currentLetter}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center mb-3"
              >
                <span className="text-sm text-muted-foreground">
                  Next surname starts with
                </span>
                <div
                  className="text-5xl font-bold text-primary uppercase tracking-wider"
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
                data-testid="input-surname"
                className={`w-full text-center text-xl font-semibold px-6 py-4 rounded-md border-2 bg-card text-foreground placeholder:text-muted-foreground outline-none transition-all duration-150 ${
                  showCorrect
                    ? "border-green-500 bg-green-500/5"
                    : showWrong
                      ? "border-red-500 bg-red-500/5 animate-shake"
                      : "border-border focus:border-primary"
                }`}
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md text-muted-foreground transition-colors"
                data-testid="button-submit"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </form>

            <p className="text-center text-xs text-muted-foreground mt-2">
              Press Enter to submit
            </p>
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
            className="fixed inset-0 pointer-events-none flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 0.15 }}
              exit={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="w-40 h-40 rounded-full bg-green-500"
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
}: {
  highScore: number;
  onStart: () => void;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md w-full"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.1, stiffness: 200 }}
          className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center"
        >
          <Zap className="w-10 h-10 text-primary" />
        </motion.div>

        <h1 className="text-4xl font-bold text-foreground mb-2">Chain Goal</h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Name Premier League goalscorers. Each surname must start with the
          <span className="font-semibold text-foreground"> last letter </span>
          of the previous one. Your score is the
          <span className="font-semibold text-foreground"> total goals </span>
          scored by every player you name.
        </p>

        <div className="flex flex-col gap-3 items-center mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Timer className="w-4 h-4" />
            <span>90 seconds on the clock</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="w-4 h-4" />
            <span>2,800+ players to choose from</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="w-4 h-4" />
            <span>Surnames only - chain the last letter</span>
          </div>
        </div>

        {highScore > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-6 flex items-center justify-center gap-2 text-primary"
          >
            <Trophy className="w-5 h-5" />
            <span className="font-bold text-lg" data-testid="text-high-score-start">
              Best: {highScore} goals
            </span>
          </motion.div>
        )}

        <Button
          onClick={onStart}
          size="lg"
          className="text-lg px-10"
          data-testid="button-start"
        >
          Start Game
        </Button>
      </motion.div>
    </div>
  );
}

function EndScreen({
  guessedPlayers,
  totalGoals,
  highScore,
  onRestart,
}: {
  guessedPlayers: GuessedPlayer[];
  totalGoals: number;
  highScore: number;
  onRestart: () => void;
}) {
  const isNewHighScore = totalGoals >= highScore && totalGoals > 0;

  const sortedByGoals = [...guessedPlayers].sort((a, b) => b.goals - a.goals);
  const topContributors = sortedByGoals.slice(0, 10);
  const maxGoals = topContributors.length > 0 ? topContributors[0].goals : 1;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-lg w-full"
      >
        {isNewHighScore && (
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            className="mb-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-sm"
          >
            <Star className="w-4 h-4 fill-current" />
            New High Score!
          </motion.div>
        )}

        <motion.div
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
          className="mb-2"
        >
          <div
            className="text-7xl font-bold text-foreground tabular-nums"
            data-testid="text-final-score"
          >
            {totalGoals}
          </div>
          <div className="text-muted-foreground text-sm mt-1">
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
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Goal Contributions
            </h3>
            <div className="space-y-2 max-w-sm mx-auto">
              {topContributors.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.06 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-24 text-right flex-shrink-0">
                    <span className="font-semibold text-sm text-foreground">
                      {p.lastName}
                    </span>
                  </div>
                  <div className="flex-1 h-7 bg-muted rounded-sm relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(p.goals / maxGoals) * 100}%`,
                      }}
                      transition={{ delay: 0.6 + i * 0.06, duration: 0.5 }}
                      className="h-full bg-primary/80 rounded-sm"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-foreground">
                      {p.goals}
                    </span>
                  </div>
                </motion.div>
              ))}
              {guessedPlayers.length > 10 && (
                <div className="text-xs text-muted-foreground mt-2">
                  +{guessedPlayers.length - 10} more players
                </div>
              )}
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
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Your Chain
            </h3>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {guessedPlayers.map((p, i) => (
                <span key={p.id} className="flex items-center gap-0.5">
                  <span className="px-2 py-0.5 rounded-sm bg-muted text-sm font-medium">
                    {p.lastName}
                    <span className="ml-1 text-xs font-mono text-primary">
                      {p.goals}
                    </span>
                  </span>
                  {i < guessedPlayers.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  )}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <Button
            onClick={onRestart}
            size="lg"
            className="text-lg px-10"
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
