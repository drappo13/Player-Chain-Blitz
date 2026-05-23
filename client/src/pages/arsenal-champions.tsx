import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, ChevronRight, Home, Share2, RotateCcw } from "lucide-react";
import { useLocation } from "wouter";

// ─── Constants ────────────────────────────────────────────────────────────────

const RED = "#DB0007";
const GOLD_LIGHT = "#F5D078";
const GOLD = "#C8960C";
const GOLD_DARK = "#8B6508";
const DARK = "#0f0205";
const BEBAS = "'Bebas Neue', Impact, sans-serif";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "intro" | "playing" | "between" | "results";

interface RoundDef {
  number: number;
  name: string;
  description: string;
  emoji: string;
}

// ─── Round definitions ─────────────────────────────────────────────────────────

const ROUNDS: RoundDef[] = [
  {
    number: 1,
    name: "Trust the Process",
    emoji: "📉",
    description: "Guess the scores from Arsenal's 2020/21 horror run — the season that made the rebuild necessary.",
  },
  {
    number: 2,
    name: "Who Doubted Us?",
    emoji: "🗣️",
    description: "Famous pundits, rivals and journalists who wrote Arsenal off. Can you name who said it?",
  },
  {
    number: 3,
    name: "Arteta Speaks",
    emoji: "🎙️",
    description: "Mikel Arteta spoke glowingly about his players every week. Guess who he was talking about.",
  },
  {
    number: 4,
    name: "The Season That Won It",
    emoji: "📊",
    description: "Stats and facts from Arsenal's title-winning 2025/26 campaign. How closely were you watching?",
  },
  {
    number: 5,
    name: "Corner Kings",
    emoji: "🚩",
    description: "Arsenal broke PL records scoring from corners. Guess the scorer from each famous goal.",
  },
  {
    number: 6,
    name: "Top Scorers",
    emoji: "⚽",
    description: "Select Arsenal's top 10 Premier League scorers under Arteta. Order doesn't matter.",
  },
  {
    number: 7,
    name: "The Assist Masters",
    emoji: "🎯",
    description: "Select Arsenal's top 10 Premier League assisters under Arteta. Who created the most?",
  },
  {
    number: 8,
    name: "Memory Lane",
    emoji: "📸",
    description: "Date the moments. We show you a famous Arsenal milestone — you tell us when it happened.",
  },
  {
    number: 9,
    name: "Build the XI",
    emoji: "🗺️",
    description: "Construct Arteta's preferred title-winning starting XI. Can you name all eleven?",
  },
  {
    number: 10,
    name: "The Transfer Window",
    emoji: "💰",
    description: "Match each Arsenal player to their transfer fee. Bargains and big spends — who cost what?",
  },
];

// ─── Shared button ─────────────────────────────────────────────────────────────

function GoldButton({ onClick, children, className = "" }: { onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`outline-none focus:outline-none font-bold rounded-xl transition-all duration-200 active:scale-95 ${className}`}
      style={{
        background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
        boxShadow: `0 4px 24px rgba(200,150,12,0.45)`,
        color: "#1a0000",
      }}
    >
      {children}
    </button>
  );
}

function RedButton({ onClick, children, className = "" }: { onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`outline-none focus:outline-none font-bold rounded-xl transition-all duration-200 active:scale-95 ${className}`}
      style={{
        background: RED,
        boxShadow: `0 4px 20px rgba(219,0,7,0.4)`,
        color: "white",
      }}
    >
      {children}
    </button>
  );
}

// ─── Progress bar ──────────────────────────────────────────────────────────────

function RoundProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${RED}, ${GOLD})` }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}

// ─── Gold metallic text ────────────────────────────────────────────────────────

function GoldText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={className}
      style={{
        background: `linear-gradient(180deg, ${GOLD_LIGHT} 0%, ${GOLD} 45%, ${GOLD_DARK} 100%)`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        filter: `drop-shadow(0 2px 8px rgba(200,150,12,0.5))`,
      }}
    >
      {children}
    </span>
  );
}

// ─── Floating gold dots (decorative) ──────────────────────────────────────────

function GoldSparkles() {
  const dots = [
    { top: "12%", left: "8%", size: 6, delay: 0 },
    { top: "20%", right: "10%", size: 4, delay: 0.4 },
    { top: "35%", left: "5%", size: 3, delay: 0.8 },
    { top: "55%", right: "6%", size: 5, delay: 0.2 },
    { top: "70%", left: "12%", size: 4, delay: 0.6 },
    { top: "80%", right: "14%", size: 3, delay: 1.0 },
    { top: "90%", left: "20%", size: 5, delay: 0.3 },
    { top: "15%", right: "20%", size: 3, delay: 0.7 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {dots.map((d, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: d.size,
            height: d.size,
            top: d.top,
            left: "left" in d ? d.left : undefined,
            right: "right" in d ? d.right : undefined,
            background: `radial-gradient(circle, ${GOLD_LIGHT}, ${GOLD})`,
          }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.3, 0.8] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: d.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ─── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ total }: { total: number }) {
  const pct = total / 100;
  const isGold = pct >= 0.85;
  const isRed = pct >= 0.6;
  const gradient = isGold
    ? `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`
    : isRed
    ? `linear-gradient(135deg, ${RED}, #ff4040)`
    : "linear-gradient(135deg, #555, #333)";

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.2 }}
      className="relative flex items-center justify-center w-40 h-40 sm:w-48 sm:h-48"
    >
      <div
        className="absolute inset-0 rounded-full opacity-30 blur-2xl"
        style={{ background: gradient }}
      />
      <div className="w-full h-full rounded-full p-1.5" style={{ background: gradient }}>
        <div
          className="w-full h-full rounded-full flex flex-col items-center justify-center"
          style={{ background: DARK }}
        >
          <Trophy className="w-7 h-7 mb-1" style={{ color: GOLD }} />
          <span
            className="text-4xl sm:text-5xl leading-none text-white"
            style={{ fontFamily: BEBAS, letterSpacing: "0.02em" }}
          >
            {total}
          </span>
          <span className="text-xs text-gray-400 mt-0.5">/ 100</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Placeholder round ─────────────────────────────────────────────────────────

function PlaceholderRound({ round, onComplete }: { round: RoundDef; onComplete: (score: number) => void }) {
  function handleComplete() {
    onComplete(Math.floor(Math.random() * 5) + 6); // 6–10 out of 10
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
      <div
        className="mb-5 w-16 h-16 rounded-full flex items-center justify-center text-3xl"
        style={{ background: `${RED}22`, border: `1px solid ${RED}55` }}
      >
        {round.emoji}
      </div>
      <h2
        className="text-3xl sm:text-4xl text-white mb-3"
        style={{ fontFamily: BEBAS, letterSpacing: "0.04em" }}
      >
        {round.name}
      </h2>
      <p className="text-sm text-gray-400 max-w-sm leading-relaxed mb-8">
        {round.description}
      </p>
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-8"
        style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}44`, color: GOLD }}
      >
        Round content coming soon
      </div>
      <GoldButton onClick={handleComplete} className="px-8 py-3 text-base flex items-center gap-2">
        Complete Round (placeholder)
        <ChevronRight className="w-4 h-4" />
      </GoldButton>
    </motion.div>
  );
}

// ─── Round 2 data ─────────────────────────────────────────────────────────────

interface QuoteQuestion {
  quote: string;
  context: string;
  options: string[];
  correct: string;
  reveal: string;
}

const ROUND2_QUOTES: QuoteQuestion[] = [
  {
    quote: `"That's in some ways as good as it gets [for Arsenal under Arteta]"`,
    context: "April 2022 — on Arsenal's title ambitions",
    options: ["Gary Neville", "Jamie Carragher", "Paul Merson", "Alan Shearer"],
    correct: "Gary Neville",
    reveal: "Said on The Overlap, implying Arsenal's ceiling was a top-four finish. Arteta did go on to win the league.",
  },
  {
    quote: `"Arsenal have looked a very nervy bunch — in part that stems from Arteta and his antics on the touchline."`,
    context: "February 2023 — Arsenal's title challenge begins to wobble",
    options: ["Graeme Souness", "Roy Keane", "Harry Redknapp", "Paul Scholes"],
    correct: "Graeme Souness",
    reveal: "Said on Sky Sports as Arsenal surrendered a 7-point lead to Man City.",
  },
  {
    quote: `"When they came here [to the Etihad, title run-in] I thought: these guys do not want to beat us. They just want to draw."`,
    context: "May 2024 — after Man City won their 4th consecutive title",
    options: ["Rodri", "Bernardo Silva", "Kevin De Bruyne", "Erling Haaland"],
    correct: "Rodri",
    reveal: "Arsenal had played for a 0-0 at the Etihad in the run-in. Arteta did go on to win the league.",
  },
  {
    quote: `"They were just booting it, like a small team with a small mentality."`,
    context: "September 2024 — after Arsenal conceded a 98th-minute equaliser having led 2-1 at the Etihad",
    options: ["Roy Keane", "Graeme Souness", "Alan Shearer", "Micah Richards"],
    correct: "Roy Keane",
    reveal: "Said on Sky Sports. Arsenal went on to win the league.",
  },
  {
    quote: `"Watching Arsenal is like watching Netflix. You always have to wait for the next season!"`,
    context: "October 2024 — after Arsenal's third consecutive near-miss",
    options: ["Patrice Evra", "Gary Neville", "Paul Scholes", "Simon Jordan"],
    correct: "Patrice Evra",
    reveal: "The line became one of the most-shared Arsenal memes of the era. Arsenal made it worth the wait.",
  },
  {
    quote: `"Stay humble, eh. Stay humble, eh."`,
    context: "September 2024 — said to Arteta's face on the touchline after a 98th-minute equaliser to make it 2-2",
    options: ["Erling Haaland", "Rodri", "Kevin De Bruyne", "Bernardo Silva"],
    correct: "Erling Haaland",
    reveal: `Arteta said he found it "funny". Arsenal won the league.`,
  },
  {
    quote: `"The day my friend Mikel Arteta wins the title, it will only be because of what he's spent, not because of his work."`,
    context: "September 2025 — said at the start of the season Arsenal won the title",
    options: ["Pep Guardiola", "Jürgen Klopp", "José Mourinho", "Erik ten Hag"],
    correct: "Pep Guardiola",
    reveal: "Arteta was Guardiola's assistant at Man City before taking the Arsenal job. Arsenal won it anyway.",
  },
  {
    quote: `"He's got to be in the top two by Christmas or they'll go for someone else."`,
    context: "May 2025 — calling for Arteta to be replaced",
    options: ["Paul Merson", "Alan Shearer", "Jamie Carragher", "Harry Redknapp"],
    correct: "Paul Merson",
    reveal: "Arteta was still in the dugout when Arsenal lifted the trophy.",
  },
  {
    quote: `"It's going to come on full blast now — the 'bottle jobs' talk. Being bottle jobs, melting."`,
    context: "February 2026 — after Arsenal dropped points at Wolves",
    options: ["Paul Merson", "Roy Keane", "Wayne Rooney", "Paul Scholes"],
    correct: "Paul Merson",
    reveal: "He predicted Arsenal would choke in the run-in as they had twice before. They didn't.",
  },
  {
    quote: `"We can't have all these games and the championship decided on corner kicks. We just can't."`,
    context: "March 2026 — after Arsenal beat Chelsea 2-1 with both goals from corners",
    options: ["Peter Schmeichel", "Rio Ferdinand", "Gary Neville", "Graeme Souness"],
    correct: "Peter Schmeichel",
    reveal: "Schmeichel's own 1999 Champions League final win was decided by two late corner routines.",
  },
];

// ─── Round 2: Who Doubted Us? ──────────────────────────────────────────────────

function QuoteText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("[") && part.endsWith("]") ? (
          <span key={i} className="not-italic text-base" style={{ color: "rgba(255,255,255,0.4)" }}>
            {" "}{part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function Round2WhoDoubtedUs({ onComplete }: { onComplete: (score: number) => void }) {
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);

  const q = ROUND2_QUOTES[qIndex];
  const revealed = selected !== null;
  const isCorrect = selected === q.correct;

  function handleSelect(opt: string) {
    if (revealed) return;
    setSelected(opt);
  }

  function handleNext() {
    const newAnswers = [...answers, selected === q.correct];
    if (qIndex + 1 >= ROUND2_QUOTES.length) {
      onComplete(newAnswers.filter(Boolean).length);
    } else {
      setAnswers(newAnswers);
      setQIndex(i => i + 1);
      setSelected(null);
    }
  }

  return (
    <motion.div
      key={qIndex}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      className="pb-16"
    >
      {/* Round header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs font-bold tracking-widest uppercase" style={{ color: GOLD }}>
            Who Doubted Us?
          </div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            They said it. But who?
          </div>
        </div>
        <div className="text-right">
          <span
            className="text-3xl leading-none"
            style={{ fontFamily: BEBAS, color: "white", letterSpacing: "0.04em" }}
          >
            Q{qIndex + 1}
          </span>
          <span className="text-sm ml-1" style={{ color: "rgba(255,255,255,0.3)" }}>/ 10</span>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1 mb-6">
        {ROUND2_QUOTES.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full transition-all duration-300"
            style={{
              background:
                i < answers.length
                  ? answers[i] ? GOLD : RED
                  : i === qIndex
                  ? "rgba(255,255,255,0.35)"
                  : "rgba(255,255,255,0.08)",
            }}
          />
        ))}
      </div>

      {/* Context chip */}
      <div
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs mb-5"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        🗣️ {q.context}
      </div>

      {/* Quote card */}
      <div
        className="rounded-2xl p-5 mb-6 relative overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.09)",
        }}
      >
        <div
          className="absolute top-3 left-4 text-5xl leading-none select-none pointer-events-none"
          style={{ color: `${RED}30`, fontFamily: "Georgia, serif" }}
        >
          "
        </div>
        <p
          className="text-xl sm:text-2xl text-white leading-snug italic relative z-10 pt-2"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          <QuoteText text={q.quote} />
        </p>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        {q.options.map((opt) => {
          const isSelected = selected === opt;
          const isCorrectOpt = opt === q.correct;
          let btnStyle: React.CSSProperties = {
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "white",
          };
          if (revealed) {
            if (isCorrectOpt) {
              btnStyle = {
                background: `rgba(200,150,12,0.18)`,
                border: `2px solid ${GOLD}`,
                color: GOLD_LIGHT,
              };
            } else if (isSelected) {
              btnStyle = {
                background: "rgba(219,0,7,0.15)",
                border: `2px solid ${RED}`,
                color: "#ff8888",
              };
            } else {
              btnStyle = {
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.25)",
              };
            }
          }
          return (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              disabled={revealed}
              className="outline-none focus:outline-none rounded-xl py-4 px-3 text-sm font-semibold text-center leading-tight transition-all duration-200 active:scale-95 disabled:cursor-default"
              style={btnStyle}
            >
              {opt}
              {revealed && isCorrectOpt && <span className="ml-1 opacity-80">✓</span>}
              {revealed && isSelected && !isCorrectOpt && <span className="ml-1 opacity-80">✗</span>}
            </button>
          );
        })}
      </div>

      {/* Reveal panel */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div
              className="rounded-xl p-4 mb-4"
              style={{
                background: isCorrect ? "rgba(200,150,12,0.08)" : "rgba(255,255,255,0.04)",
                border: isCorrect
                  ? `1px solid rgba(200,150,12,0.35)`
                  : "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{isCorrect ? "✅" : "❌"}</span>
                <span
                  className="font-bold text-sm"
                  style={{ color: isCorrect ? GOLD_LIGHT : "white" }}
                >
                  {isCorrect ? "Correct!" : `It was ${q.correct}`}
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                {q.reveal}
              </p>
            </div>

            <GoldButton
              onClick={handleNext}
              className="w-full py-3.5 flex items-center justify-center gap-2"
            >
              <span style={{ fontFamily: BEBAS, letterSpacing: "0.06em", fontSize: "1.1rem" }}>
                {qIndex + 1 >= ROUND2_QUOTES.length ? "FINISH ROUND" : "NEXT QUESTION"}
              </span>
              <ChevronRight className="w-4 h-4" />
            </GoldButton>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ArsenalChampions() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<Phase>("intro");
  const [currentRound, setCurrentRound] = useState(0);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);

  const totalScore = roundScores.reduce((a, b) => a + b, 0);
  const activeRound = ROUNDS[currentRound];

  function startQuiz() { setCurrentRound(0); setRoundScores([]); setPhase("between"); }
  function startRound() { setPhase("playing"); }
  function handleRoundComplete(score: number) {
    // score is 0–10 per round (1pt per question × 10 questions)
    const next = [...roundScores, score];
    setRoundScores(next);
    const nextIdx = currentRound + 1;
    if (nextIdx >= ROUNDS.length) { setPhase("results"); }
    else { setCurrentRound(nextIdx); setPhase("between"); }
  }
  function handlePlayAgain() { setCurrentRound(0); setRoundScores([]); setPhase("intro"); }
  function handleShare() {
    navigator.clipboard.writeText(
      `I scored ${totalScore}/100 on the Arsenal PL Champions 2026 quiz! 🏆⚽ drapk.in/arsenal-pl-champions-2026`
    ).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden" style={{ background: DARK }}>

      {/* ── INTRO — full-screen vivid red overlay ── */}
      <AnimatePresence>
        {phase === "intro" && (
          <motion.div
            key="intro-overlay"
            className="fixed inset-0 z-50 overflow-y-auto"
            style={{ background: RED }}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
          >
            {/* Gold centre glow */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: "radial-gradient(ellipse 70% 60% at 50% 45%, rgba(200,150,12,0.25) 0%, transparent 70%)",
              }}
            />
            {/* Bottom vignette */}
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 h-48"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.4), transparent)" }}
            />

            <GoldSparkles />

            {/* Home link */}
            <button
              onClick={() => setLocation("/")}
              className="absolute top-5 left-4 z-10 outline-none focus:outline-none text-white/60 hover:text-white transition-colors"
            >
              <Home className="w-4 h-4" />
            </button>

            <div className="relative z-10 flex flex-col items-center text-center px-4 pt-14 pb-16 min-h-screen justify-center">

              {/* Crown + Trophy */}
              <motion.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 160, damping: 11, delay: 0.15 }}
                className="mb-6 flex flex-col items-center"
              >
                <span className="text-4xl leading-none mb-1">👑</span>
                <div
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, ${GOLD_LIGHT}, ${GOLD}, ${GOLD_DARK})`,
                    boxShadow: `0 0 50px rgba(200,150,12,0.6), 0 0 100px rgba(200,150,12,0.25)`,
                  }}
                >
                  <span className="text-5xl sm:text-6xl drop-shadow-lg">🏆</span>
                </div>
              </motion.div>

              {/* Title block */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="mb-2"
              >
                {/* ARSENAL */}
                <div
                  className="text-6xl sm:text-7xl text-white leading-none"
                  style={{ fontFamily: BEBAS, letterSpacing: "0.06em", textShadow: "0 2px 16px rgba(0,0,0,0.3)" }}
                >
                  ARSENAL
                </div>

                {/* PREMIER LEAGUE */}
                <div
                  className="text-sm sm:text-base font-bold tracking-[0.35em] text-white/85 mt-1 uppercase"
                >
                  Premier League
                </div>

                {/* CHAMPIONS — big gold */}
                <GoldText
                  className="block leading-none mt-1"
                  style={{
                    fontFamily: BEBAS,
                    fontSize: "clamp(3.5rem, 14vw, 6rem)",
                    letterSpacing: "0.04em",
                  } as React.CSSProperties}
                >
                  CHAMPIONS
                </GoldText>

                {/* 2025-26 */}
                <div
                  className="text-3xl sm:text-4xl text-white/90 mt-1"
                  style={{ fontFamily: BEBAS, letterSpacing: "0.1em" }}
                >
                  2025–26
                </div>
              </motion.div>

              {/* Gold divider */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="w-28 h-px my-6"
                style={{ background: `linear-gradient(90deg, transparent, ${GOLD_LIGHT}, transparent)` }}
              />

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-sm text-white/75 max-w-xs leading-relaxed mb-5"
              >
                Test your knowledge of Arteta's title-winning journey
              </motion.p>

              {/* Pill */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 }}
                className="flex items-center gap-2 px-5 py-2 rounded-full mb-8"
                style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.25)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: GOLD }} />
                <span className="text-xs text-white/85 font-semibold">10 Rounds</span>
                <span className="text-white/30 text-xs">·</span>
                <span className="text-xs text-white/85 font-semibold">100 Questions</span>
              </motion.div>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <GoldButton onClick={startQuiz} className="px-14 py-4 text-xl flex items-center gap-2">
                  <span style={{ fontFamily: BEBAS, letterSpacing: "0.08em", fontSize: "1.25rem" }}>
                    START QUIZ
                  </span>
                  <ChevronRight className="w-5 h-5" />
                </GoldButton>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── GAME SCREENS (dark background) ── */}
      {phase !== "intro" && (
        <>
          {/* Ambient glows */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[500px] h-80 rounded-full blur-3xl"
              style={{ background: "rgba(219,0,7,0.12)" }} />
            <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full blur-3xl"
              style={{ background: "rgba(200,150,12,0.07)" }} />
          </div>

          {/* Top bar */}
          <div
            className="sticky top-0 z-20 backdrop-blur px-4 py-3"
            style={{ background: `${DARK}e8`, borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="max-w-lg mx-auto flex items-center gap-3">
              <button
                onClick={() => setLocation("/")}
                className="outline-none focus:outline-none text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
              >
                <Home className="w-4 h-4" />
              </button>
              <div className="flex-1">
                <RoundProgressBar current={roundScores.length} total={ROUNDS.length} />
              </div>
              <span className="text-xs font-bold flex-shrink-0" style={{ color: GOLD }}>
                {totalScore}/100
              </span>
            </div>
          </div>

          <div className="max-w-lg mx-auto px-4 py-8 relative z-10">
            <AnimatePresence mode="wait">

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
                  <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: GOLD }}>
                    Round {activeRound.number} of {ROUNDS.length}
                  </div>

                  {/* Score chips */}
                  {roundScores.length > 0 && (
                    <div className="flex items-center gap-1.5 mb-7 flex-wrap justify-center">
                      {roundScores.map((s, i) => (
                        <div
                          key={i}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold"
                          style={s >= 8
                            ? { background: `${GOLD}22`, border: `1px solid ${GOLD}55`, color: GOLD }
                            : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#aaa" }
                          }
                        >
                          {s}
                        </div>
                      ))}
                      {Array.from({ length: ROUNDS.length - roundScores.length }).map((_, i) => (
                        <div
                          key={`e-${i}`}
                          className="w-7 h-7 rounded-md"
                          style={i === 0
                            ? { background: `${RED}18`, border: `1px solid ${RED}55` }
                            : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }
                          }
                        />
                      ))}
                    </div>
                  )}

                  <div className="text-5xl mb-4">{activeRound.emoji}</div>

                  <h2
                    className="text-4xl sm:text-5xl text-white mb-3"
                    style={{ fontFamily: BEBAS, letterSpacing: "0.05em" }}
                  >
                    {activeRound.name}
                  </h2>
                  <p className="text-sm text-gray-400 max-w-sm leading-relaxed mb-10">
                    {activeRound.description}
                  </p>

                  <GoldButton onClick={startRound} className="px-8 py-3 text-base flex items-center gap-2">
                    <span style={{ fontFamily: BEBAS, letterSpacing: "0.06em", fontSize: "1.1rem" }}>
                      START ROUND
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </GoldButton>
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
                  {currentRound === 1 ? (
                    <Round2WhoDoubtedUs onComplete={handleRoundComplete} />
                  ) : (
                    <PlaceholderRound round={activeRound} onComplete={handleRoundComplete} />
                  )}
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
                  className="flex flex-col items-center text-center pt-10 pb-16"
                >
                  <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: GOLD }}>
                    Quiz Complete
                  </div>
                  <h2
                    className="text-3xl sm:text-4xl text-white mb-8"
                    style={{ fontFamily: BEBAS, letterSpacing: "0.04em" }}
                  >
                    {totalScore >= 80
                      ? "Gunner Through & Through 🔴"
                      : totalScore >= 60
                      ? "Solid Gooner Knowledge 💪"
                      : "Room to Improve, Goonette"}
                  </h2>

                  <div className="mb-8">
                    <ScoreRing total={totalScore} />
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
                        className="flex items-center gap-3 px-3 py-2 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                      >
                        <span className="text-[10px] font-bold text-gray-500 w-5 text-right flex-shrink-0">{i + 1}</span>
                        <span className="text-xs text-gray-300 flex-1 text-left truncate">{ROUNDS[i].name}</span>
                        <span className="text-xs font-bold flex-shrink-0" style={{ color: score >= 8 ? GOLD : "#888" }}>
                          {score}/10
                        </span>
                        <div className="w-14 h-1 bg-white/10 rounded-full overflow-hidden flex-shrink-0">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${score * 10}%`,
                              background: score >= 8 ? GOLD : RED,
                            }}
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
                    <GoldButton onClick={handleShare} className="py-3 w-full flex items-center justify-center gap-2 text-base">
                      <Share2 className="w-4 h-4" />
                      {copied ? "Copied!" : "Share My Score"}
                    </GoldButton>
                    <RedButton onClick={handlePlayAgain} className="py-3 w-full flex items-center justify-center gap-2 text-base">
                      <RotateCcw className="w-4 h-4" />
                      Play Again
                    </RedButton>
                    <button
                      onClick={() => setLocation("/")}
                      className="outline-none focus:outline-none text-sm text-gray-500 hover:text-gray-300 transition-colors py-2"
                    >
                      Back to all games
                    </button>
                  </motion.div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}
