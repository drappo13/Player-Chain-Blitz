import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, ChevronRight, Home, Share2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "intro" | "playing" | "between" | "results";

interface RoundDef {
  number: number;
  name: string;
  description: string;
}

// ─── Round definitions ─────────────────────────────────────────────────────────

const ROUNDS: RoundDef[] = [
  {
    number: 1,
    name: "Trust the Process",
    description: "Guess the scores from Arsenal's 2020/21 horror run — the season that made the rebuild necessary.",
  },
  {
    number: 2,
    name: "Who Doubted Us?",
    description: "Quotes round: famous pundits, rivals and journalists who wrote Arsenal off. Can you name who said it?",
  },
  {
    number: 3,
    name: "Arteta Speaks",
    description: "Mikel Arteta spoke glowingly about his players. Guess who he was talking about from his words.",
  },
  {
    number: 4,
    name: "The Season That Won It",
    description: "Stats and facts from Arsenal's title-winning 2025/26 campaign. How closely were you watching?",
  },
  {
    number: 5,
    name: "Corner Kings",
    description: "Arsenal's famous corner-routine goals. Guess the scorer from the description of each goal.",
  },
  {
    number: 6,
    name: "Top Scorers",
    description: "Select Arsenal's top 10 Premier League scorers under Arteta. Order doesn't matter — just get them right.",
  },
  {
    number: 7,
    name: "The Assist Masters",
    description: "Select Arsenal's top 10 Premier League assisters under Arteta. Who created the most?",
  },
  {
    number: 8,
    name: "Memory Lane",
    description: "Date the moments. We show you a famous Arsenal milestone — you tell us which season it happened.",
  },
  {
    number: 9,
    name: "Build the XI",
    description: "Construct Arteta's preferred title-winning starting XI. Can you name all eleven?",
  },
  {
    number: 10,
    name: "The Transfer Window",
    description: "Match each Arsenal player to their transfer fee. Bargains and big spends — who cost what?",
  },
];

// ─── Placeholder round component ──────────────────────────────────────────────

function PlaceholderRound({
  round,
  onComplete,
}: {
  round: RoundDef;
  onComplete: (score: number) => void;
}) {
  function handleComplete() {
    const score = Math.floor(Math.random() * 5) + 6; // 6–10 out of 10
    onComplete(score);
  }

  return (
    <motion.div
      key={round.number}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center"
    >
      <div className="mb-4 w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(219,0,7,0.15)", border: "1px solid rgba(219,0,7,0.4)" }}>
        <span className="text-2xl font-black" style={{ color: "#DB0007" }}>{round.number}</span>
      </div>
      <h2 className="text-2xl sm:text-3xl font-black text-white mb-3 tracking-tight">
        {round.name}
      </h2>
      <p className="text-sm text-gray-400 max-w-sm leading-relaxed mb-8">
        {round.description}
      </p>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-8" style={{ background: "rgba(200,150,12,0.1)", border: "1px solid rgba(200,150,12,0.3)", color: "#C8960C" }}>
        Round content coming soon
      </div>
      <Button
        onClick={handleComplete}
        className="font-bold px-8 py-3 text-base rounded-lg text-[#1a0000]"
        style={{ background: "linear-gradient(135deg, #F5D078, #C8960C)" }}
      >
        Complete Round (placeholder)
        <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </motion.div>
  );
}

// ─── Progress bar ──────────────────────────────────────────────────────────────

function RoundProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: "linear-gradient(90deg, #DB0007, #C8960C)" }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}

// ─── Score stars (confetti-ish result display) ────────────────────────────────

function ScoreRings({ total }: { total: number }) {
  const pct = total / 100;
  const color =
    pct >= 0.85
      ? "from-amber-400 to-yellow-300"
      : pct >= 0.6
      ? "from-red-500 to-red-400"
      : "from-gray-500 to-gray-400";

  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.2 }}
      className="relative flex items-center justify-center w-36 h-36 sm:w-44 sm:h-44"
    >
      <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${color} opacity-20 blur-xl`} />
      <div className={`w-full h-full rounded-full bg-gradient-to-br ${color} p-1`}>
        <div className="w-full h-full rounded-full bg-[#0a0a0f] flex flex-col items-center justify-center">
          <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400 mb-1" />
          <span className="text-3xl sm:text-4xl font-black text-white leading-none">{total}</span>
          <span className="text-xs text-gray-400 mt-0.5">/ 100</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ArsenalChampions() {
  const [, setLocation] = useLocation();

  const [phase, setPhase] = useState<Phase>("intro");
  const [currentRound, setCurrentRound] = useState(0); // 0-indexed
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);

  const totalScore = roundScores.reduce((a, b) => a + b, 0);
  const activeRound = ROUNDS[currentRound];

  // ── handlers ──

  function startQuiz() {
    setCurrentRound(0);
    setRoundScores([]);
    setPhase("between");
  }

  function startRound() {
    setPhase("playing");
  }

  function handleRoundComplete(score: number) {
    // score is 0–10 (1 point per question, 10 questions per round)
    const newScores = [...roundScores, score];
    setRoundScores(newScores);
    const nextIndex = currentRound + 1;
    if (nextIndex >= ROUNDS.length) {
      setPhase("results");
    } else {
      setCurrentRound(nextIndex);
      setPhase("between");
    }
  }

  function handlePlayAgain() {
    setCurrentRound(0);
    setRoundScores([]);
    setPhase("intro");
  }

  function handleShare() {
    const text = `I scored ${totalScore}/100 on the Arsenal PL Champions 2026 quiz! 🏆⚽ drapk.in/arsenal-pl-champions-2026`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── render ──

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden"
      style={{ background: phase === "intro" ? "#DB0007" : "#0f0205" }}
    >
      {/* Ambient overlays */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {phase === "intro" ? (
          <>
            {/* Red intro: dark vignette at bottom, gold glow centre */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#C8960C]/20 rounded-full blur-3xl" />
          </>
        ) : (
          <>
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-red-900/30 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#C8960C]/8 rounded-full blur-3xl" />
          </>
        )}
      </div>

      {/* Persistent top bar (not shown on intro) */}
      {phase !== "intro" && (
        <div className="sticky top-0 z-20 bg-[#0f0205]/90 backdrop-blur border-b border-white/5 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button
              onClick={() => setLocation("/")}
              className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
            >
              <Home className="w-4 h-4" />
            </button>
            <div className="flex-1">
              <RoundProgressBar current={roundScores.length} total={ROUNDS.length} />
            </div>
            <span className="text-xs font-bold text-[#C8960C] flex-shrink-0">
              {totalScore}/100
            </span>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-8 relative z-10">
        <AnimatePresence mode="wait">
          {/* ── INTRO ── */}
          {phase === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center text-center pt-12 sm:pt-20 pb-16"
            >
              {/* Home link */}
              <button
                onClick={() => setLocation("/")}
                className="absolute top-6 left-4 text-white/50 hover:text-white transition-colors"
              >
                <Home className="w-4 h-4" />
              </button>

              {/* Trophy / badge */}
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 180, damping: 12, delay: 0.2 }}
                className="mb-6"
              >
                <div
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center"
                  style={{
                    background: "radial-gradient(circle at 35% 35%, #F5D078, #C8960C, #8B6508)",
                    boxShadow: "0 0 60px rgba(200,150,12,0.5), 0 0 120px rgba(200,150,12,0.2)",
                  }}
                >
                  <span className="text-5xl sm:text-6xl drop-shadow-lg">🏆</span>
                </div>
              </motion.div>

              {/* Title stack — matching the image */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="mb-2"
              >
                {/* ARSENAL */}
                <div className="text-5xl sm:text-6xl font-black tracking-tight leading-none text-white drop-shadow-lg">
                  ARSENAL
                </div>
                {/* PREMIER LEAGUE */}
                <div className="text-sm sm:text-base font-black tracking-[0.3em] text-white/90 mt-2 uppercase">
                  Premier League
                </div>
                {/* CHAMPIONS — big gold metallic */}
                <div
                  className="text-5xl sm:text-7xl font-black tracking-tight leading-none mt-1"
                  style={{
                    background: "linear-gradient(180deg, #F5D078 0%, #C8960C 45%, #8B6508 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    filter: "drop-shadow(0 2px 8px rgba(200,150,12,0.6))",
                  }}
                >
                  CHAMPIONS
                </div>
                {/* 2025–26 */}
                <div className="text-2xl sm:text-3xl font-black text-white/90 mt-1 tracking-widest">
                  2025–26
                </div>
              </motion.div>

              {/* Divider */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="w-24 h-px my-6"
                style={{ background: "linear-gradient(90deg, transparent, #C8960C, transparent)" }}
              />

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="text-sm text-white/70 max-w-xs leading-relaxed mb-6"
              >
                Test your knowledge of Arteta's title-winning journey
              </motion.p>

              {/* Round count pill */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.65 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full mb-8"
                style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#C8960C" }} />
                <span className="text-xs text-white/80 font-semibold">10 Rounds</span>
                <span className="text-white/30">·</span>
                <span className="text-xs text-white/80 font-semibold">100 Questions</span>
              </motion.div>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75 }}
              >
                <Button
                  onClick={startQuiz}
                  className="font-black px-12 py-4 text-lg rounded-xl transition-all duration-200 text-[#1a0000]"
                  style={{
                    background: "linear-gradient(135deg, #F5D078, #C8960C)",
                    boxShadow: "0 4px 24px rgba(200,150,12,0.5)",
                  }}
                >
                  START QUIZ
                  <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              </motion.div>
            </motion.div>
          )}

          {/* ── BETWEEN ROUNDS ── */}
          {phase === "between" && activeRound && (
            <motion.div
              key={`between-${currentRound}`}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center text-center pt-8 pb-16"
            >
              {/* Round number */}
              <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "#C8960C" }}>
                Round {activeRound.number} of {ROUNDS.length}
              </div>

              {/* Round scores so far */}
              {roundScores.length > 0 && (
                <div className="flex items-center gap-1.5 mb-6">
                  {roundScores.map((s, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center"
                    >
                      <div
                        className={`w-6 h-6 rounded-sm flex items-center justify-center text-[9px] font-bold ${
                          s >= 80
                            ? "bg-amber-400/20 text-amber-400 border border-amber-400/40"
                            : "bg-white/10 text-gray-400 border border-white/10"
                        }`}
                      >
                        {s}
                      </div>
                    </div>
                  ))}
                  {/* Remaining empty slots */}
                  {Array.from({ length: ROUNDS.length - roundScores.length }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className={`w-6 h-6 rounded-sm border ${
                        i === 0
                          ? "border-red-600/60 bg-red-600/10"
                          : "border-white/10 bg-white/5"
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Round title */}
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-3 tracking-tight">
                {activeRound.name}
              </h2>

              <p className="text-sm text-gray-400 max-w-sm leading-relaxed mb-10">
                {activeRound.description}
              </p>

              <Button
                onClick={startRound}
                className="font-bold px-8 py-3 text-base rounded-lg text-[#1a0000]"
                style={{ background: "linear-gradient(135deg, #F5D078, #C8960C)", boxShadow: "0 4px 16px rgba(200,150,12,0.4)" }}
              >
                START ROUND
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}

          {/* ── PLAYING ── */}
          {phase === "playing" && activeRound && (
            <motion.div
              key={`playing-${currentRound}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <PlaceholderRound round={activeRound} onComplete={handleRoundComplete} />
            </motion.div>
          )}

          {/* ── RESULTS ── */}
          {phase === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center text-center pt-12 pb-16"
            >
              {/* Title */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-8"
              >
                <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "#C8960C" }}>
                  Quiz Complete
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  {totalScore >= 80
                    ? "Gunner Through & Through! 🔴"
                    : totalScore >= 60
                    ? "Solid Gooner Knowledge 💪"
                    : "Room to Improve, Goonette"}
                </h2>
              </motion.div>

              {/* Score ring */}
              <div className="mb-8">
                <ScoreRings total={totalScore} />
              </div>

              {/* Round breakdown */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="w-full mb-8 space-y-1.5"
              >
                {roundScores.map((score, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 border border-white/8"
                  >
                    <span className="text-[10px] font-bold text-gray-500 w-5 text-right flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-xs text-gray-300 flex-1 text-left truncate">
                      {ROUNDS[i].name}
                    </span>
                    <span
                      className={`text-xs font-bold flex-shrink-0 ${
                        score >= 8 ? "text-amber-400" : "text-gray-400"
                      }`}
                    >
                      {score}/10
                    </span>
                    <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden flex-shrink-0">
                      <div
                        className={`h-full rounded-full ${
                          score >= 8 ? "bg-amber-400" : "bg-red-600"
                        }`}
                        style={{ width: `${score * 10}%` }}
                      />
                    </div>
                  </div>
                ))}
              </motion.div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex flex-col gap-3 w-full"
              >
                <Button
                  onClick={handleShare}
                  className="bg-amber-400 hover:bg-amber-300 text-black font-bold py-3 rounded-lg w-full flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  {copied ? "Copied to clipboard!" : "Share My Score"}
                </Button>
                <Button
                  onClick={handlePlayAgain}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/5 py-3 rounded-lg w-full flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Play Again
                </Button>
                <button
                  onClick={() => setLocation("/")}
                  className="text-sm text-gray-500 hover:text-gray-300 transition-colors py-2"
                >
                  Back to all games
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
