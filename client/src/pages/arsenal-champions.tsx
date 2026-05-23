import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import arsenalStats from "../data/arteta-arsenal-stats.json";
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
    description: "Arteta's very first Arsenal starting XI. Boxing Day, Bournemouth, 2019. Name all ten outfield starters.",
  },
  {
    number: 10,
    name: "Guess the Score",
    emoji: "📋",
    description: "Ten landmark Arteta-era results. Enter the exact final score for each match — no multiple choice.",
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
    quote: "That's in some ways as good as it gets",
    context: "April 2022 — implying Arsenal would never win the title, only finish 4th",
    options: ["Gary Neville", "Paul Merson", "Tim Sherwood", "Jamie Carragher"],
    correct: "Gary Neville",
    reveal: "Said on The Overlap, suggesting Arteta's ceiling was a top-four finish. Arteta did go on to win the league.",
  },
  {
    quote: "Arsenal have looked a very nervy bunch — in part that stems from Arteta and his antics on the touchline.",
    context: "February 2023 — Arsenal's title challenge begins to wobble",
    options: ["Graeme Souness", "Roy Keane", "Harry Redknapp", "Jermaine Jenas"],
    correct: "Graeme Souness",
    reveal: "Said on Sky Sports as Arsenal surrendered a 7-point lead to Man City.",
  },
  {
    quote: "When they came here I thought: these guys do not want to beat us. They just want to draw.",
    context: "May 2024 — on Arsenal's visit to the Etihad during the 2023/24 title run-in",
    options: ["Rodri", "Bernardo Silva", "Kevin De Bruyne", "Erling Haaland"],
    correct: "Rodri",
    reveal: "Said after Man City won their 4th consecutive title. Arsenal went unbeaten against Man City for more than 2 years across 6 games after this.",
  },
  {
    quote: "They were just booting it, like a small team with a small mentality.",
    context: "September 2024 — after Arsenal conceded a 98th-minute equaliser having led 2-1 at the Etihad",
    options: ["Roy Keane", "Graeme Souness", "Alan Shearer", "Gabriel Agbonlahor"],
    correct: "Roy Keane",
    reveal: "Said on Sky Sports. Arsenal went on to win the league.",
  },
  {
    quote: "Watching Arsenal is like watching Netflix. You always have to wait for the next season!",
    context: "October 2024 — after another Arsenal near-miss",
    options: ["Patrice Evra", "Gary Neville", "Joe Hart", "Jermaine Jenas"],
    correct: "Patrice Evra",
    reveal: "The line became one of the most-shared Arsenal memes of the era. Arsenal made it worth the wait.",
  },
  {
    quote: "Stay humble, eh. Stay humble, eh.",
    context: "September 2024 — said to Arteta's face on the touchline after scoring a 98th-minute equaliser",
    options: ["Erling Haaland", "Rodri", "Kevin De Bruyne", "Bernardo Silva"],
    correct: "Erling Haaland",
    reveal: 'Arteta said he found it "funny". Who\'s laughing now?',
  },
  {
    quote: "They've cheated their way to winning the Premier League. I wouldn't recognise them as winners — for me, it's illegal the way they win games.",
    context: "March 2026 — said on talkSPORT as Arsenal led the title race on the back of a record corner-kick season",
    options: ["John Obi Mikel", "Wayne Rooney", "Peter Schmeichel", "Tim Sherwood"],
    correct: "John Obi Mikel",
    reveal: "Former Chelsea midfielder, said on talkSPORT, 11 March 2026. Mikel was always known for his explosive attacking style, wasn't he? Arsenal were recognised as champions regardless.",
  },
  {
    quote: "He has to walk! Mikel Arteta should resign if Arsenal fails to win the league. Failing to win a trophy after being in contention necessitates his departure.",
    context: "May 2025 — after Arsenal finished second for the second year running",
    options: ["Gabriel Agbonlahor", "Alan Shearer", "Paul Merson", "Jermaine Jenas"],
    correct: "Gabriel Agbonlahor",
    reveal: "Said on talkSPORT. Agbonlahor spent his entire career at Aston Villa, winning nothing. Arteta stayed, and Arsenal won the league the following season.",
  },
  {
    quote: "It's going to come on full blast now, being bottle jobs, melting.",
    context: "February 2026 — after Arsenal dropped points at Wolves",
    options: ["Paul Merson", "Roy Keane", "Wayne Rooney", "Paul Scholes"],
    correct: "Paul Merson",
    reveal: "He predicted Arsenal would choke in the run-in. They didn't.",
  },
  {
    quote: "We can't have all these games and the championship decided on corner kicks. We just can't.",
    context: "March 2026 — after Arsenal beat Chelsea 2-1 with both goals from corners",
    options: ["Peter Schmeichel", "Wayne Rooney", "Gary Neville", "Graeme Souness"],
    correct: "Peter Schmeichel",
    reveal: "Schmeichel's own 1999 Champions League final win was decided by two late corner routines.",
  },
];

// ─── Round 2: Who Doubted Us? ──────────────────────────────────────────────────


function Round2WhoDoubtedUs({ onComplete }: { onComplete: (score: number) => void }) {
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [shuffledQuotes] = useState(() =>
    ROUND2_QUOTES.map(q => ({ ...q, options: [...q.options].sort(() => Math.random() - 0.5) }))
  );

  const q = shuffledQuotes[qIndex];
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
        className="rounded-2xl p-5 mb-6"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.09)",
        }}
      >
        <p
          className="text-xl sm:text-2xl text-white leading-snug italic"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          &ldquo;{q.quote}&rdquo;
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

// ─── Round 1 data ─────────────────────────────────────────────────────────────

interface HorrorGame {
  homeTeam: string;
  awayTeam: string;
  date: string;
  homeScore: number;
  awayScore: number;
  result: "W" | "D" | "L"; // from Arsenal's perspective
  options: string[]; // "X-Y" in home-away format
  reveal: string;
}

const ROUND1_GAMES: HorrorGame[] = [
  {
    homeTeam: "Manchester City", awayTeam: "Arsenal", date: "17 Oct 2020",
    homeScore: 1, awayScore: 0, result: "L",
    options: ["1-0", "2-0", "1-1", "2-1"],
    reveal: "An early reminder of how far Arsenal had to go. Agüero scored the only goal.",
  },
  {
    homeTeam: "Arsenal", awayTeam: "Leicester City", date: "25 Oct 2020",
    homeScore: 0, awayScore: 1, result: "L",
    options: ["0-1", "1-0", "1-1", "2-1"],
    reveal: "Vardy got the winner. Arsenal had no answer at the Emirates.",
  },
  {
    homeTeam: "Manchester United", awayTeam: "Arsenal", date: "1 Nov 2020",
    homeScore: 0, awayScore: 1, result: "W",
    options: ["0-1", "1-0", "1-1", "0-0"],
    reveal: "Aubameyang converted a penalty — Arsenal's first win at Old Trafford in 14 years. Even at their absolute lowest, Arsenal could still go to Old Trafford and win.",
  },
  {
    homeTeam: "Arsenal", awayTeam: "Aston Villa", date: "8 Nov 2020",
    homeScore: 0, awayScore: 3, result: "L",
    options: ["0-3", "1-2", "0-2", "1-1"],
    reveal: "Emiliano Martínez kept a clean sheet against his former club. Arteta said afterwards: \"It's my fault.\" The low point that sparked the cultural reset.",
  },
  {
    homeTeam: "Leeds United", awayTeam: "Arsenal", date: "22 Nov 2020",
    homeScore: 0, awayScore: 0, result: "D",
    options: ["0-0", "1-0", "0-1", "1-1"],
    reveal: "A point at Elland Road felt about right — Arsenal were deeply uninspiring.",
  },
  {
    homeTeam: "Arsenal", awayTeam: "Wolves", date: "29 Nov 2020",
    homeScore: 1, awayScore: 2, result: "L",
    options: ["1-2", "0-1", "1-1", "2-1"],
    reveal: "Pepe gave Arsenal the lead, Wolves scored twice in the second half. Another home defeat.",
  },
  {
    homeTeam: "Tottenham", awayTeam: "Arsenal", date: "6 Dec 2020",
    homeScore: 2, awayScore: 0, result: "L",
    options: ["2-0", "1-0", "2-1", "1-1"],
    reveal: "Son and Højbjerg scored. Arteta's first NLD in charge ended in defeat.",
  },
  {
    homeTeam: "Arsenal", awayTeam: "Burnley", date: "13 Dec 2020",
    homeScore: 0, awayScore: 1, result: "L",
    options: ["0-1", "1-0", "1-1", "0-2"],
    reveal: "Burnley won at the Emirates. Arsenal were 15th in the table.",
  },
  {
    homeTeam: "Arsenal", awayTeam: "Southampton", date: "16 Dec 2020",
    homeScore: 1, awayScore: 1, result: "D",
    options: ["1-1", "0-1", "1-0", "2-1"],
    reveal: "A draw felt like a relief at this point. Arsenal couldn't win at home.",
  },
  {
    homeTeam: "Everton", awayTeam: "Arsenal", date: "19 Dec 2020",
    homeScore: 2, awayScore: 1, result: "L",
    options: ["2-1", "0-1", "1-1", "2-2"],
    reveal: "Three points above the relegation zone at Christmas. The turnaround started on Boxing Day.",
  },
];

// ─── Round 1: Trust the Process ───────────────────────────────────────────────

function Round1TrustTheProcess({ onComplete }: { onComplete: (score: number) => void }) {
  const [qIndex, setQIndex] = useState(0);
  const [homeInput, setHomeInput] = useState(0);
  const [awayInput, setAwayInput] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<boolean[]>([]);

  const g = ROUND1_GAMES[qIndex];
  const isCorrect = submitted && homeInput === g.homeScore && awayInput === g.awayScore;
  const resultColor = g.result === "W" ? GOLD : g.result === "D" ? "#aaa" : RED;
  const resultLabel = g.result === "W" ? "WIN" : g.result === "D" ? "DRAW" : "LOSS";
  const teamShort = (name: string) => {
    const map: Record<string, string> = {
      "Manchester City": "Man City", "Manchester United": "Man Utd",
      "Leicester City": "Leicester", "Leeds United": "Leeds",
      "Aston Villa": "Villa", "Tottenham": "Spurs",
    };
    return map[name] ?? (name.length > 10 ? name.split(" ")[0] : name);
  };
  const homeLabel = teamShort(g.homeTeam);
  const awayLabel = teamShort(g.awayTeam);

  function handleSubmit() {
    if (submitted) return;
    setSubmitted(true);
  }

  function handleNext() {
    const correct = homeInput === g.homeScore && awayInput === g.awayScore;
    const newAnswers = [...answers, correct];
    if (qIndex + 1 >= ROUND1_GAMES.length) {
      onComplete(newAnswers.filter(Boolean).length);
    } else {
      setAnswers(newAnswers);
      setQIndex(i => i + 1);
      setHomeInput(0);
      setAwayInput(0);
      setSubmitted(false);
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
            Trust the Process
          </div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            How bad did it get?
          </div>
        </div>
        <div className="text-right">
          <span className="text-3xl leading-none" style={{ fontFamily: BEBAS, color: "white", letterSpacing: "0.04em" }}>
            Q{qIndex + 1}
          </span>
          <span className="text-sm ml-1" style={{ color: "rgba(255,255,255,0.3)" }}>/ 10</span>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1 mb-6">
        {ROUND1_GAMES.map((_, i) => (
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
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }}
      >
        📉 Arsenal's 2020/21 horror run
      </div>

      {/* Match card */}
      <div
        className="rounded-2xl p-5 mb-5"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
              {g.date}
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: BEBAS, letterSpacing: "0.04em" }}>
              <span style={{ color: g.homeTeam === "Arsenal" ? RED : "white" }}>{g.homeTeam}</span>
              <span className="mx-2" style={{ color: "rgba(255,255,255,0.25)" }}>vs</span>
              <span style={{ color: g.awayTeam === "Arsenal" ? RED : "white" }}>{g.awayTeam}</span>
            </div>
          </div>
          <div
            className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold"
            style={{ background: `${resultColor}18`, border: `1px solid ${resultColor}44`, color: resultColor }}
          >
            {submitted ? resultLabel : "?"}
          </div>
        </div>
      </div>

      {/* Score pickers */}
      {!submitted && (
        <div
          className="rounded-2xl p-5 mb-5 flex items-center gap-3"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
        >
          <ScorePicker
            value={homeInput}
            onChange={setHomeInput}
            label={homeLabel}
            color={g.homeTeam === "Arsenal" ? RED : "rgba(255,255,255,0.5)"}
          />
          <div className="text-3xl font-bold" style={{ fontFamily: BEBAS, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>—</div>
          <ScorePicker
            value={awayInput}
            onChange={setAwayInput}
            label={awayLabel}
            color={g.awayTeam === "Arsenal" ? RED : "rgba(255,255,255,0.5)"}
          />
        </div>
      )}

      {/* Submitted score display */}
      {submitted && (
        <div
          className="rounded-2xl p-5 mb-5 flex items-center justify-center gap-4"
          style={{
            background: isCorrect ? "rgba(200,150,12,0.08)" : "rgba(255,255,255,0.04)",
            border: isCorrect ? `1px solid rgba(200,150,12,0.35)` : "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div className="text-center">
            <div className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: g.homeTeam === "Arsenal" ? RED : "rgba(255,255,255,0.4)" }}>
              {homeLabel}
            </div>
            <div className="text-5xl font-bold" style={{ fontFamily: BEBAS, color: isCorrect ? GOLD_LIGHT : "white" }}>
              {homeInput}
            </div>
          </div>
          <div className="text-3xl" style={{ fontFamily: BEBAS, color: "rgba(255,255,255,0.2)" }}>—</div>
          <div className="text-center">
            <div className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: g.awayTeam === "Arsenal" ? RED : "rgba(255,255,255,0.4)" }}>
              {awayLabel}
            </div>
            <div className="text-5xl font-bold" style={{ fontFamily: BEBAS, color: isCorrect ? GOLD_LIGHT : "white" }}>
              {awayInput}
            </div>
          </div>
        </div>
      )}

      {/* Submit / reveal / next */}
      <AnimatePresence mode="wait">
        {!submitted ? (
          <motion.div key="submit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GoldButton onClick={handleSubmit} className="w-full py-3.5 flex items-center justify-center gap-2">
              <span style={{ fontFamily: BEBAS, letterSpacing: "0.06em", fontSize: "1.1rem" }}>LOCK IN SCORE</span>
              <ChevronRight className="w-4 h-4" />
            </GoldButton>
          </motion.div>
        ) : (
          <motion.div key="reveal" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div
              className="rounded-xl p-4 mb-4"
              style={{
                background: isCorrect ? "rgba(200,150,12,0.08)" : "rgba(255,255,255,0.04)",
                border: isCorrect ? `1px solid rgba(200,150,12,0.35)` : "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{isCorrect ? "✅" : "❌"}</span>
                <span className="font-bold text-sm" style={{ color: isCorrect ? GOLD_LIGHT : "white" }}>
                  {isCorrect ? "Correct!" : `It was ${g.homeScore}–${g.awayScore}`}
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{g.reveal}</p>
            </div>
            <GoldButton onClick={handleNext} className="w-full py-3.5 flex items-center justify-center gap-2">
              <span style={{ fontFamily: BEBAS, letterSpacing: "0.06em", fontSize: "1.1rem" }}>
                {qIndex + 1 >= ROUND1_GAMES.length ? "FINISH ROUND" : "NEXT QUESTION"}
              </span>
              <ChevronRight className="w-4 h-4" />
            </GoldButton>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Round 10 data ────────────────────────────────────────────────────────────

interface ScoreGame {
  matchTitle: string;
  date: string;
  venue: string;
  context: string;
  isArsenalHome: boolean;
  opponentName: string;
  arsenalGoals: number;
  opponentGoals: number;
  arsenalXI: string;
  opponentXI: string;
  reveal: string;
}

const ROUND10_GAMES: ScoreGame[] = [
  {
    matchTitle: "Arsenal vs Manchester United",
    date: "1 January 2020",
    venue: "Emirates Stadium",
    context: "Arteta's first Premier League win as manager",
    isArsenalHome: true,
    opponentName: "Manchester United",
    arsenalGoals: 2, opponentGoals: 0,
    arsenalXI: "Leno; Maitland-Niles, Sokratis, David Luiz, Kolasinac; Torreira, Xhaka; Pepe, Özil, Aubameyang; Lacazette",
    opponentXI: "De Gea; Wan-Bissaka, Lindelöf, Maguire, Shaw; Fred, Matic; James, Lingard, Rashford; Martial",
    reveal: "New Year's Day. Pepe and Sokratis on target. A clean sheet. The rebuild had begun.",
  },
  {
    matchTitle: "Arsenal vs Liverpool",
    date: "9 October 2022",
    venue: "Emirates Stadium",
    context: "Arsenal top of the league — Martinelli opened after 58 seconds",
    isArsenalHome: true,
    opponentName: "Liverpool",
    arsenalGoals: 3, opponentGoals: 2,
    arsenalXI: "Ramsdale; White, Saliba, Gabriel, Tomiyasu; Partey, Xhaka; Saka, Ødegaard, Martinelli; Jesus",
    opponentXI: "Alisson; Alexander-Arnold, Matip, Van Dijk, Tsimikas; Henderson, Thiago; Salah, Jota, Díaz; Núñez",
    reveal: "Arsenal went 1-0 up, Liverpool levelled, Arsenal made it 2-1, Liverpool equalized again — then Saka won a penalty. A proper title-race statement.",
  },
  {
    matchTitle: "Arsenal vs Manchester City",
    date: "8 October 2023",
    venue: "Emirates Stadium",
    context: "Arsenal had lost 12 consecutive PL games to City",
    isArsenalHome: true,
    opponentName: "Manchester City",
    arsenalGoals: 1, opponentGoals: 0,
    arsenalXI: "Raya; White, Saliba, Gabriel, Zinchenko; Rice, Jorginho, Ødegaard; Jesus, Nketiah, Trossard",
    opponentXI: "Ederson; Walker, Dias, Aké, Gvardiol; Kovačić, Bernardo Silva, Rico Lewis; Álvarez, Haaland, Foden",
    reveal: "Martinelli's deflected 86th-minute shot slipped past Ederson. Saka was absent. The hoodoo was over.",
  },
  {
    matchTitle: "Arsenal vs Liverpool",
    date: "4 February 2024",
    venue: "Emirates Stadium",
    context: "Arsenal sliced the gap to 2 points at the top",
    isArsenalHome: true,
    opponentName: "Liverpool",
    arsenalGoals: 3, opponentGoals: 1,
    arsenalXI: "Raya; White, Saliba, Gabriel, Zinchenko; Ødegaard, Rice, Jorginho; Saka, Havertz, Martinelli",
    opponentXI: "Alisson; Alexander-Arnold, Konaté, Van Dijk, Gomez; Gravenberch, Mac Allister, Curtis Jones; Gakpo, Jota, Díaz",
    reveal: "Konaté was sent off in the 88th minute. Trossard sealed it in the 90+2'. Alisson errors proved costly for Liverpool.",
  },
  {
    matchTitle: "Arsenal vs Chelsea",
    date: "23 April 2024",
    venue: "Emirates Stadium",
    context: "Chelsea's heaviest ever defeat by Arsenal",
    isArsenalHome: true,
    opponentName: "Chelsea",
    arsenalGoals: 5, opponentGoals: 0,
    arsenalXI: "Raya; Tomiyasu, Saliba, Gabriel, White; Partey, Rice, Ødegaard; Trossard, Havertz, Saka",
    opponentXI: "Petrovic; Disasi, Badiashile, Cucurella, Gilchrist; Caicedo, Enzo Fernández; Mudryk, Gallagher, Madueke; Jackson",
    reveal: "Ben White and Havertz each scored twice. Four goals in an 18-minute second-half spell. Jackson missed an open header.",
  },
  {
    matchTitle: "Manchester City vs Arsenal",
    date: "22 September 2024",
    venue: "Etihad Stadium",
    context: "Arsenal played the entire second half with 10 men",
    isArsenalHome: false,
    opponentName: "Manchester City",
    arsenalGoals: 2, opponentGoals: 2,
    arsenalXI: "Raya; Timber, Saliba, Gabriel, Calafiori; Partey, Rice; Saka, Trossard, Martinelli; Havertz",
    opponentXI: "Ederson; Walker, Dias, Akanji, Gvardiol; Rodri, Gündogan; Savinho, Bernardo Silva, Doku; Haaland",
    reveal: "Trossard was shown a second yellow for kicking the ball away. Arsenal still led 2-1 heading into the 98th minute. Stones equalized. Haaland walked over to Arteta: \"Stay humble, eh.\"",
  },
  {
    matchTitle: "Arsenal vs Manchester City",
    date: "2 February 2025",
    venue: "Emirates Stadium",
    context: "Ødegaard scored after 2 minutes, City briefly equalized, then Arsenal scored four more",
    isArsenalHome: true,
    opponentName: "Manchester City",
    arsenalGoals: 5, opponentGoals: 1,
    arsenalXI: "Raya; Timber, Saliba, Gabriel, Lewis-Skelly; Ødegaard, Partey, Rice; Trossard, Havertz, Martinelli",
    opponentXI: "Ortega; Nunes, Akanji, Stones, Gvardiol; Bernardo Silva, Kovačić; Savinho, Foden, Marmoush; Haaland",
    reveal: "Haaland equalized at 1-1, then Partey, Lewis-Skelly, Havertz and Nwaneri (off the bench) made it five. Haaland had scored in a 5-1 loss at the Emirates.",
  },
  {
    matchTitle: "Bournemouth vs Arsenal",
    date: "3 January 2026",
    venue: "Vitality Stadium",
    context: "Arsenal came from behind — Rice scored twice",
    isArsenalHome: false,
    opponentName: "Bournemouth",
    arsenalGoals: 3, opponentGoals: 2,
    arsenalXI: "Raya; Timber, Saliba, Gabriel, Hincapié; Ødegaard, Zubimendi, Rice; Madueke, Gyökeres, Martinelli",
    opponentXI: "Petrovic; Jiménez, Hill, Senesi, Truffert; Scott, Tavernier, Brooks; Semenyo, Evanilson, Kluivert",
    reveal: "Arsenal went behind early, Gabriel levelled, then Rice scored twice to make it 3-1. Bournemouth pulled one back late. Arsenal opened a six-point lead at the top.",
  },
  {
    matchTitle: "Arsenal vs Tottenham",
    date: "23 November 2025",
    venue: "Emirates Stadium",
    context: "Eze started against the club that tried to sign him that summer",
    isArsenalHome: true,
    opponentName: "Tottenham",
    arsenalGoals: 4, opponentGoals: 1,
    arsenalXI: "Raya; Timber, Saliba, Hincapié, Calafiori; Zubimendi, Rice; Saka, Eze, Trossard; Merino",
    opponentXI: "Vicario; Danso, Romero, van de Ven; Udogie, Bentancur, Palhinha, Spence; Simons, Kudus; Richarlison",
    reveal: "Eze scored a hat-trick. Only the fourth player in history to score an NLD hat-trick — and he'd snubbed Spurs to make it happen.",
  },
  {
    matchTitle: "Arsenal vs Burnley",
    date: "18 May 2026",
    venue: "Emirates Stadium",
    context: "Penultimate game of the season — the title was one result away",
    isArsenalHome: true,
    opponentName: "Burnley",
    arsenalGoals: 1, opponentGoals: 0,
    arsenalXI: "Raya; Saliba, Mosquera, Gabriel, Calafiori; Rice, Eze; Ødegaard, Trossard, Saka; Havertz",
    opponentXI: "Weiss; Walker, Estève, Tuanzebe, Pires; Ugochukwu, Florentino; Anthony, Mejbri, Tchaouna; Flemming",
    reveal: "Havertz headed in from a corner — Arsenal's 18th corner goal of the season. Man City drew 1-1 at Bournemouth the next night. Arsenal were champions. Twenty-two years.",
  },
];

// ─── Score picker ──────────────────────────────────────────────────────────────

function ScorePicker({
  value, onChange, label, color,
}: {
  value: number; onChange: (v: number) => void; label: string; color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <div className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color }}>
        {label}
      </div>
      <button
        onClick={() => onChange(Math.min(9, value + 1))}
        className="outline-none focus:outline-none w-10 h-8 flex items-center justify-center rounded-lg transition-colors active:scale-95"
        style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
      >
        ▲
      </button>
      <div
        className="w-16 h-16 flex items-center justify-center rounded-2xl text-4xl font-bold"
        style={{ fontFamily: BEBAS, background: `${color}18`, border: `2px solid ${color}55`, color: "white", letterSpacing: "0.04em" }}
      >
        {value}
      </div>
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="outline-none focus:outline-none w-10 h-8 flex items-center justify-center rounded-lg transition-colors active:scale-95"
        style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
      >
        ▼
      </button>
    </div>
  );
}

// ─── Round 10: Guess the Score ────────────────────────────────────────────────

function Round10GuessTheScore({ onComplete }: { onComplete: (score: number) => void }) {
  const [qIndex, setQIndex] = useState(0);
  const [arsenalInput, setArsenalInput] = useState(0);
  const [opponentInput, setOpponentInput] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [showLineups, setShowLineups] = useState(false);

  const g = ROUND10_GAMES[qIndex];
  const isCorrect = submitted && arsenalInput === g.arsenalGoals && opponentInput === g.opponentGoals;

  function handleSubmit() {
    if (submitted) return;
    setSubmitted(true);
  }

  function handleNext() {
    const newAnswers = [...answers, arsenalInput === g.arsenalGoals && opponentInput === g.opponentGoals];
    if (qIndex + 1 >= ROUND10_GAMES.length) {
      onComplete(newAnswers.filter(Boolean).length);
    } else {
      setAnswers(newAnswers);
      setQIndex(i => i + 1);
      setArsenalInput(0);
      setOpponentInput(0);
      setSubmitted(false);
      setShowLineups(false);
    }
  }

  const arsenalLabel = "Arsenal";
  const opponentLabel = g.opponentName.length > 10 ? g.opponentName.split(" ").pop()! : g.opponentName;

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
            Guess the Score
          </div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            Enter the final scoreline
          </div>
        </div>
        <div className="text-right">
          <span className="text-3xl leading-none" style={{ fontFamily: BEBAS, color: "white", letterSpacing: "0.04em" }}>
            Q{qIndex + 1}
          </span>
          <span className="text-sm ml-1" style={{ color: "rgba(255,255,255,0.3)" }}>/ 10</span>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1 mb-6">
        {ROUND10_GAMES.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full transition-all duration-300"
            style={{
              background:
                i < answers.length
                  ? answers[i] ? GOLD : RED
                  : i === qIndex ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.08)",
            }}
          />
        ))}
      </div>

      {/* Match info */}
      <div
        className="rounded-2xl p-4 mb-5"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
      >
        <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          {g.venue} · {g.date}
        </div>
        <div className="text-xl font-bold text-white mb-2" style={{ fontFamily: BEBAS, letterSpacing: "0.04em" }}>
          {g.matchTitle}
        </div>
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }}
        >
          ⚽ {g.context}
        </div>
      </div>

      {/* Score pickers */}
      {!submitted && (
        <div
          className="rounded-2xl p-5 mb-5 flex items-center gap-3"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
        >
          <ScorePicker value={g.isArsenalHome ? arsenalInput : opponentInput} onChange={g.isArsenalHome ? setArsenalInput : setOpponentInput} label={g.isArsenalHome ? arsenalLabel : opponentLabel} color={g.isArsenalHome ? RED : "rgba(255,255,255,0.5)"} />
          <div className="text-3xl font-bold" style={{ fontFamily: BEBAS, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>—</div>
          <ScorePicker value={g.isArsenalHome ? opponentInput : arsenalInput} onChange={g.isArsenalHome ? setOpponentInput : setArsenalInput} label={g.isArsenalHome ? opponentLabel : arsenalLabel} color={g.isArsenalHome ? "rgba(255,255,255,0.5)" : RED} />
        </div>
      )}

      {/* Submitted score display */}
      {submitted && (
        <div
          className="rounded-2xl p-5 mb-5 flex items-center justify-center gap-4"
          style={{
            background: isCorrect ? "rgba(200,150,12,0.08)" : "rgba(255,255,255,0.04)",
            border: isCorrect ? `1px solid rgba(200,150,12,0.35)` : "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div className="text-center">
            <div className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: g.isArsenalHome ? RED : "rgba(255,255,255,0.4)" }}>
              {g.isArsenalHome ? "Arsenal" : g.opponentName}
            </div>
            <div className="text-5xl font-bold" style={{ fontFamily: BEBAS, color: isCorrect ? GOLD_LIGHT : "white" }}>
              {g.isArsenalHome ? arsenalInput : opponentInput}
            </div>
          </div>
          <div className="text-3xl" style={{ fontFamily: BEBAS, color: "rgba(255,255,255,0.2)" }}>—</div>
          <div className="text-center">
            <div className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: g.isArsenalHome ? "rgba(255,255,255,0.4)" : RED }}>
              {g.isArsenalHome ? g.opponentName : "Arsenal"}
            </div>
            <div className="text-5xl font-bold" style={{ fontFamily: BEBAS, color: isCorrect ? GOLD_LIGHT : "white" }}>
              {g.isArsenalHome ? opponentInput : arsenalInput}
            </div>
          </div>
        </div>
      )}

      {/* Lineups toggle */}
      <button
        onClick={() => setShowLineups(v => !v)}
        className="outline-none focus:outline-none w-full py-2.5 rounded-xl text-xs font-semibold mb-4 transition-colors"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.4)" }}
      >
        {showLineups ? "▲ Hide" : "▼ Show"} Starting XIs
      </button>

      <AnimatePresence>
        {showLineups && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden mb-4"
          >
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: "Arsenal", xi: g.arsenalXI, color: RED },
                { name: g.opponentName, xi: g.opponentXI, color: "rgba(255,255,255,0.3)" },
              ].map(({ name, xi, color }) => (
                <div key={name} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color }}>{name}</div>
                  <div className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {xi.split(";").map((part, i) => (
                      <span key={i}>{i > 0 && <span style={{ color: "rgba(255,255,255,0.2)" }}>; </span>}{part.trim()}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit / reveal / next */}
      <AnimatePresence mode="wait">
        {!submitted ? (
          <motion.div key="submit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GoldButton onClick={handleSubmit} className="w-full py-3.5 flex items-center justify-center gap-2">
              <span style={{ fontFamily: BEBAS, letterSpacing: "0.06em", fontSize: "1.1rem" }}>LOCK IN SCORE</span>
              <ChevronRight className="w-4 h-4" />
            </GoldButton>
          </motion.div>
        ) : (
          <motion.div key="reveal" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div
              className="rounded-xl p-4 mb-4"
              style={{
                background: isCorrect ? "rgba(200,150,12,0.08)" : "rgba(255,255,255,0.04)",
                border: isCorrect ? `1px solid rgba(200,150,12,0.35)` : "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{isCorrect ? "✅" : "❌"}</span>
                <span className="font-bold text-sm" style={{ color: isCorrect ? GOLD_LIGHT : "white" }}>
                  {isCorrect
                    ? "Correct!"
                    : `It was ${g.isArsenalHome ? g.arsenalGoals : g.opponentGoals}–${g.isArsenalHome ? g.opponentGoals : g.arsenalGoals}`}
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{g.reveal}</p>
            </div>
            <GoldButton onClick={handleNext} className="w-full py-3.5 flex items-center justify-center gap-2">
              <span style={{ fontFamily: BEBAS, letterSpacing: "0.06em", fontSize: "1.1rem" }}>
                {qIndex + 1 >= ROUND10_GAMES.length ? "FINISH ROUND" : "NEXT QUESTION"}
              </span>
              <ChevronRight className="w-4 h-4" />
            </GoldButton>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Round 3 data ────────────────────────────────────────────────────────────
// ⚠️ Verify all quotes + sources before going live — see docs/arsenal-champions-quiz.md

interface ArtetaQuote {
  quote: string;
  player: string;
  context: string;
  options: string[];
  reveal: string;
}

const ROUND3_QUOTES: ArtetaQuote[] = [
  {
    quote: "You don't really see that at 21 years old — a debut in the Premier League against this opponent, and resolve the situation with that composure, that calmness and that presence.",
    player: "William Saliba",
    context: "August 2022",
    options: ["William Saliba", "Gabriel Magalhães", "Ben White", "Jurrien Timber"],
    reveal: "Saliba had spent three seasons on loan in France before returning. Arteta was blown away on debut. He went on to become one of the best defenders in the world.",
  },
  {
    quote: "By a mile. By 100 miles. Everybody chose the same person — which is the most clear sign you can have of how they feel about who has to lead them.",
    player: "Martin Ødegaard",
    context: "August 2025 — on one of his players' leadership",
    options: ["Martin Ødegaard", "Declan Rice", "William Saliba", "Bukayo Saka"],
    reveal: "The vote came after pundits questioned the captaincy following difficult results. The squad was unanimous. Ødegaard went on to lift the Premier League trophy.",
  },
  {
    quote: "I loved it. It's about taking initiative, making things happen and believing that you can actually win the game by yourself sometimes. I was really impressed.",
    player: "Declan Rice",
    context: "April 2025 — after a Champions League match",
    options: ["Declan Rice", "Bukayo Saka", "Martin Ødegaard", "Gabriel Martinelli"],
    reveal: "Rice stepped up despite Jover's signals — and scored both. Arsenal won the quarter-final. Arteta was delighted rather than annoyed.",
  },
  {
    quote: "He destroyed all the metrics we had in the gym for the last ten years. Power, acceleration, muscle mass — the transformation has been incredible.",
    player: "Kai Havertz",
    context: "November 2024 — on a player returning from injury",
    options: ["Kai Havertz", "Jurrien Timber", "Viktor Gyökeres", "Declan Rice"],
    reveal: "Havertz arrived with doubts about his physicality. He returned a different player and became Arsenal's title-winning number nine.",
  },
  {
    quote: "He is a leader. He loves to be on show and a big presence in everything we do. He is very vocal and extremely gifted technically.",
    player: "Jurrien Timber",
    context: "July 2024 — pre-season, on a player returning to fitness",
    options: ["Jurrien Timber", "Riccardo Calafiori", "Kai Havertz", "Ben White"],
    reveal: "Timber tore his ACL on the opening day of his debut season. A year of rehab later, he became a cornerstone of Arsenal's title-winning defence.",
  },
  {
    quote: "He really glues the team together and that's a quality that is not easy for a striker. He's got it.",
    player: "Alexandre Lacazette",
    context: "2021 — on a striker's role in the team",
    options: ["Alexandre Lacazette", "Pierre-Emerick Aubameyang", "Gabriel Martinelli", "Martin Ødegaard"],
    reveal: "Lacazette was selfless in a way rare for a striker. He left as a free agent in 2022 but Arteta praised him for making the whole team function.",
  },
  {
    quote: "He's so physical, he opens spaces for everybody. The way he presses the ball, holds the ball — he's just phenomenal.",
    player: "Viktor Gyökeres",
    context: "November 2025 — after a Champions League match",
    options: ["Viktor Gyökeres", "Kai Havertz", "Alexandre Lacazette", "Gabriel Martinelli"],
    reveal: "Gyökeres signed from Sporting in the summer of 2025. He went on to become Arsenal's top PL scorer with 14 goals — the final piece of the puzzle.",
  },
  {
    quote: "What he actually transmits is such security, calmness and composure in every situation on the field. He brings something unique and very powerful for the team.",
    player: "Eberechi Eze",
    context: "May 2026 — on a player's impact during the title-winning season",
    options: ["Eberechi Eze", "Martin Ødegaard", "Kai Havertz", "Gabriel Martinelli"],
    reveal: "Eze chose Arsenal over Spurs in summer 2025. He scored a hat-trick against them in November. Arteta described his on-field calmness as uniquely powerful.",
  },
  {
    quote: "When we have to make that decision, it's because that's the right one to defend the interests of the club. It was really hurting — and it still is. It needs a little bit of time to heal.",
    player: "Pierre-Emerick Aubameyang",
    context: "December 2021 — after a difficult decision involving a senior player",
    options: ["Pierre-Emerick Aubameyang", "Alexandre Lacazette", "Granit Xhaka", "Nicolas Pépé"],
    reveal: "Aubameyang broke a pre-match curfew rule. Arteta dropped him from the squad and stripped the armband publicly. One of the defining cultural moments of the rebuild.",
  },
  {
    quote: "His reaction after scoring was to say thank you to all the sports scientists and physios who participated in his recovery. It tells you who he is as a person. It's impossible not to love him.",
    player: "Bukayo Saka",
    context: "March 2025 — after a player returned from a long injury",
    options: ["Bukayo Saka", "Gabriel Martinelli", "Jurrien Timber", "Kai Havertz"],
    reveal: "Saka missed nearly four months. His first thought on returning was to thank the backroom staff. Arteta consistently praises his character as much as his talent.",
  },
];

// ─── Round 3: Arteta Speaks ───────────────────────────────────────────────────

function Round3ArtetaSpeaks({ onComplete }: { onComplete: (score: number) => void }) {
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [shuffledQuotes] = useState(() =>
    ROUND3_QUOTES.map(q => ({ ...q, options: [...q.options].sort(() => Math.random() - 0.5) }))
  );

  const q = shuffledQuotes[qIndex];
  const revealed = selected !== null;
  const isCorrect = selected === q.player;

  function handleSelect(opt: string) {
    if (revealed) return;
    setSelected(opt);
  }

  function handleNext() {
    const newAnswers = [...answers, selected === q.player];
    if (qIndex + 1 >= ROUND3_QUOTES.length) {
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
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs font-bold tracking-widest uppercase" style={{ color: GOLD }}>Arteta Speaks</div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>He talks about his players every week. But who?</div>
        </div>
        <div className="text-right">
          <span className="text-3xl leading-none" style={{ fontFamily: BEBAS, color: "white", letterSpacing: "0.04em" }}>Q{qIndex + 1}</span>
          <span className="text-sm ml-1" style={{ color: "rgba(255,255,255,0.3)" }}>/ 10</span>
        </div>
      </div>

      <div className="flex gap-1 mb-6">
        {ROUND3_QUOTES.map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300" style={{
            background: i < answers.length ? (answers[i] ? GOLD : RED) : i === qIndex ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.08)",
          }} />
        ))}
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs mb-5" style={{
        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)",
      }}>
        🎙️ {q.context}
      </div>

      <div className="rounded-2xl p-5 mb-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
        <div className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
          Arteta said this about which player?
        </div>
        <p className="text-xl sm:text-2xl text-white leading-snug italic" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
          &ldquo;{q.quote}&rdquo;
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-5">
        {q.options.map(opt => {
          const isSelected = selected === opt;
          const isCorrectOpt = opt === q.player;
          let btnStyle: React.CSSProperties = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" };
          if (revealed) {
            if (isCorrectOpt) btnStyle = { background: "rgba(200,150,12,0.18)", border: `2px solid ${GOLD}`, color: GOLD_LIGHT };
            else if (isSelected) btnStyle = { background: "rgba(219,0,7,0.15)", border: `2px solid ${RED}`, color: "#ff8888" };
            else btnStyle = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.25)" };
          }
          return (
            <button key={opt} onClick={() => handleSelect(opt)} disabled={revealed}
              className="outline-none focus:outline-none rounded-xl py-4 px-3 text-sm font-semibold text-center leading-tight transition-all duration-200 active:scale-95 disabled:cursor-default"
              style={btnStyle}>
              {opt}
              {revealed && isCorrectOpt && <span className="ml-1 opacity-80">✓</span>}
              {revealed && isSelected && !isCorrectOpt && <span className="ml-1 opacity-80">✗</span>}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {revealed && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div className="rounded-xl p-4 mb-4" style={{
              background: isCorrect ? "rgba(200,150,12,0.08)" : "rgba(255,255,255,0.04)",
              border: isCorrect ? `1px solid rgba(200,150,12,0.35)` : "1px solid rgba(255,255,255,0.1)",
            }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{isCorrect ? "✅" : "❌"}</span>
                <span className="font-bold text-sm" style={{ color: isCorrect ? GOLD_LIGHT : "white" }}>
                  {isCorrect ? "Correct!" : `It was ${q.player}`}
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{q.reveal}</p>
            </div>
            <GoldButton onClick={handleNext} className="w-full py-3.5 flex items-center justify-center gap-2">
              <span style={{ fontFamily: BEBAS, letterSpacing: "0.06em", fontSize: "1.1rem" }}>
                {qIndex + 1 >= ROUND3_QUOTES.length ? "FINISH ROUND" : "NEXT QUESTION"}
              </span>
              <ChevronRight className="w-4 h-4" />
            </GoldButton>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Round 4 data ────────────────────────────────────────────────────────────
// ⚠️ Verify all stats before going live — see docs/arsenal-champions-quiz.md

interface SeasonStatQ {
  question: string;
  options: string[];
  correct: string;
  reveal: string;
}

const ROUND4_QUESTIONS: SeasonStatQ[] = [
  {
    question: "How many Premier League clean sheets did Arsenal keep in their title-winning 2025/26 season?",
    options: ["17", "18", "19", "20"],
    correct: "19",
    reveal: "David Raya: 19 clean sheets, 3 Golden Gloves in a row. The wall.",
  },
  {
    question: "How many goals did Spurs score against Man City across both Premier League fixtures in 2025/26?",
    options: ["2", "3", "4", "5"],
    correct: "4",
    reveal: "Four goals against City across the two fixtures. Spurs couldn't win a trophy all season — but they did win us the league.",
  },
  {
    question: "How many Premier League goals did Arsenal's top scorer Viktor Gyökeres score in 2025/26?",
    options: ["12", "13", "14", "15"],
    correct: "14",
    reveal: "14 goals in his debut Arsenal season. Not bad for a flop.",
  },
  {
    question: "Which two Arsenal players shared the most yellow cards in 2025/26 — five each?",
    options: ["Calafiori & Timber", "Zubimendi & Gabriel", "Mosquera & Gabriel", "Rice & Zubimendi"],
    correct: "Calafiori & Timber",
    reveal: "Calafiori and Timber — 5 yellows each. Some things never change.",
  },
  {
    question: "How many Arsenal players made more Premier League assists than Trossard in 2025/26?",
    options: ["0", "1", "2", "3"],
    correct: "0",
    reveal: "Trossard finished joint-top with Ødegaard on 6 assists. Zero players made more. Still underrated.",
  },
  {
    question: "What was Arsenal's longest unbeaten run in the Premier League in 2025/26?",
    options: ["7", "9", "11", "13"],
    correct: "11",
    reveal: "11 games unbeaten — the run that put the title beyond doubt.",
  },
  {
    question: "How many times did Arsenal score 5 or more goals in a Premier League game in 2025/26?",
    options: ["0", "1", "2", "3"],
    correct: "1",
    reveal: "Once — 5-0 vs Leeds at the Emirates, August 2025. Timber scored twice, Gyökeres got his first goals for the club.",
  },
  {
    question: "How many times did Arsenal concede more than 2 goals in a Premier League game in 2025/26?",
    options: ["0", "1", "2", "3"],
    correct: "1",
    reveal: "Just once all season. The defence was almost flawless.",
  },
  {
    question: "Which outfield player logged the most Premier League minutes for Arsenal in 2025/26?",
    options: ["Declan Rice", "Martín Zubimendi", "Gabriel Magalhães", "William Saliba"],
    correct: "Declan Rice",
    reveal: "Declan Rice: 3,094 minutes — 4 goals, 5 assists, and barely off the pitch all season.",
  },
  {
    question: "How many Arsenal players scored a Premier League penalty in 2025/26?",
    options: ["1", "2", "3", "4"],
    correct: "2",
    reveal: "Gyökeres and Saka. Two penalties, both scored, both mattered.",
  },
];

// ─── Round 4: The Season That Won It ─────────────────────────────────────────

function Round4SeasonStats({ onComplete }: { onComplete: (score: number) => void }) {
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);

  const q = ROUND4_QUESTIONS[qIndex];
  const revealed = selected !== null;
  const isCorrect = selected === q.correct;

  function handleSelect(opt: string) {
    if (revealed) return;
    setSelected(opt);
  }

  function handleNext() {
    const newAnswers = [...answers, selected === q.correct];
    if (qIndex + 1 >= ROUND4_QUESTIONS.length) {
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
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs font-bold tracking-widest uppercase" style={{ color: GOLD }}>The Season That Won It</div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>2025/26 — the numbers behind the title</div>
        </div>
        <div className="text-right">
          <span className="text-3xl leading-none" style={{ fontFamily: BEBAS, color: "white", letterSpacing: "0.04em" }}>Q{qIndex + 1}</span>
          <span className="text-sm ml-1" style={{ color: "rgba(255,255,255,0.3)" }}>/ 10</span>
        </div>
      </div>

      <div className="flex gap-1 mb-6">
        {ROUND4_QUESTIONS.map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300" style={{
            background: i < answers.length ? (answers[i] ? GOLD : RED) : i === qIndex ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.08)",
          }} />
        ))}
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs mb-5" style={{
        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)",
      }}>
        📊 2025/26 Premier League season
      </div>

      <div className="rounded-2xl p-5 mb-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
        <p className="text-xl sm:text-2xl font-bold text-white leading-snug" style={{ fontFamily: BEBAS, letterSpacing: "0.03em" }}>
          {q.question}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-5">
        {q.options.map(opt => {
          const isSelected = selected === opt;
          const isCorrectOpt = opt === q.correct;
          let btnStyle: React.CSSProperties = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" };
          if (revealed) {
            if (isCorrectOpt) btnStyle = { background: "rgba(200,150,12,0.18)", border: `2px solid ${GOLD}`, color: GOLD_LIGHT };
            else if (isSelected) btnStyle = { background: "rgba(219,0,7,0.15)", border: `2px solid ${RED}`, color: "#ff8888" };
            else btnStyle = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.25)" };
          }
          return (
            <button key={opt} onClick={() => handleSelect(opt)} disabled={revealed}
              className="outline-none focus:outline-none rounded-xl py-4 px-3 text-sm font-semibold text-center leading-tight transition-all duration-200 active:scale-95 disabled:cursor-default"
              style={btnStyle}>
              {opt}
              {revealed && isCorrectOpt && <span className="ml-1 opacity-80">✓</span>}
              {revealed && isSelected && !isCorrectOpt && <span className="ml-1 opacity-80">✗</span>}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {revealed && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div className="rounded-xl p-4 mb-4" style={{
              background: isCorrect ? "rgba(200,150,12,0.08)" : "rgba(255,255,255,0.04)",
              border: isCorrect ? `1px solid rgba(200,150,12,0.35)` : "1px solid rgba(255,255,255,0.1)",
            }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{isCorrect ? "✅" : "❌"}</span>
                <span className="font-bold text-sm" style={{ color: isCorrect ? GOLD_LIGHT : "white" }}>
                  {isCorrect ? "Correct!" : `It was ${q.correct}`}
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{q.reveal}</p>
            </div>
            <GoldButton onClick={handleNext} className="w-full py-3.5 flex items-center justify-center gap-2">
              <span style={{ fontFamily: BEBAS, letterSpacing: "0.06em", fontSize: "1.1rem" }}>
                {qIndex + 1 >= ROUND4_QUESTIONS.length ? "FINISH ROUND" : "NEXT QUESTION"}
              </span>
              <ChevronRight className="w-4 h-4" />
            </GoldButton>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Round 5 data ────────────────────────────────────────────────────────────
// ⚠️ Photos needed — add to public/arsenal-quiz/corners/ before going live
// ⚠️ See docs/arsenal-champions-quiz.md for photo sourcing guide (Getty/PA Images)

interface CornerGoal {
  scorer: string;
  opponent: string;
  date: string;
  imagePath: string; // relative to /public, e.g. "arsenal-quiz/corners/01-gabriel-chelsea.jpg"
  imageHint: string; // shown as placeholder text while photo is missing
  options: string[];
  reveal: string;
}

const ROUND5_CORNERS: CornerGoal[] = [
  {
    scorer: "Gabriel Magalhães",
    opponent: "Chelsea (away)", date: "6 Nov 2022",
    imagePath: "arsenal-quiz/corners/01-gabriel-chelsea-2022.jpg",
    imageHint: "Gabriel pokes home — Stamford Bridge, Nov 2022",
    options: ["Gabriel Magalhães", "William Saliba", "Ben White", "Granit Xhaka"],
    reveal: "Saka's inswinging corner, Gabriel poked home through a crowd. Arsenal won 1-0 — one of the defining moments of the 2022/23 title race.",
  },
  {
    scorer: "Leandro Trossard",
    opponent: "Everton", date: "17 Sep 2023",
    imagePath: "arsenal-quiz/corners/02-trossard-everton-2023.jpg",
    imageHint: "Short corner switch — Saka to Trossard, Goodison Park, Sep 2023",
    options: ["Leandro Trossard", "Bukayo Saka", "Gabriel Martinelli", "Gabriel Magalhães"],
    reveal: "The most viral Arsenal corner moment — Saka played short, Trossard cut inside and hit the post-net junction first time. A Jover masterclass.",
  },
  {
    scorer: "Oleksandr Zinchenko",
    opponent: "Burnley", date: "11 Nov 2023",
    imagePath: "arsenal-quiz/corners/03-zinchenko-burnley-2023.jpg",
    imageHint: "Zinchenko scissor volley — Emirates, Nov 2023",
    options: ["Oleksandr Zinchenko", "Thomas Partey", "Granit Xhaka", "Declan Rice"],
    reveal: "Zinchenko's acrobatic scissor volley after a corner rebounded off the bar. Won Arsenal Goal of the Month. The left-back scoring like a forward.",
  },
  {
    scorer: "Kai Havertz",
    opponent: "Tottenham", date: "28 Apr 2024",
    imagePath: "arsenal-quiz/corners/04-havertz-tottenham-2024.jpg",
    imageHint: "Havertz heads home from Rice corner — NLD, April 2024",
    options: ["Kai Havertz", "Gabriel Magalhães", "William Saliba", "Declan Rice"],
    reveal: "Rice's delivery, Havertz headed home. Part of Arsenal's 3-2 comeback NLD win — Arteta's 100th Premier League victory as manager.",
  },
  {
    scorer: "Gabriel Magalhães",
    opponent: "Manchester City (away)", date: "22 Sep 2024",
    imagePath: "arsenal-quiz/corners/05-gabriel-city-away-2024.jpg",
    imageHint: "Gabriel header at the Etihad with 10 men — Sep 2024",
    options: ["Gabriel Magalhães", "William Saliba", "Jurrien Timber", "Riccardo Calafiori"],
    reveal: "Arsenal were down to 10 men when Gabriel headed home. Set-piece coach Nicolas Jover's ecstatic celebration on the touchline was widely shared. Arsenal still drew 2-2 after a 98th-minute Stones equaliser.",
  },
  {
    scorer: "Gabriel Magalhães",
    opponent: "Tottenham", date: "15 Sep 2024",
    imagePath: "arsenal-quiz/corners/06-gabriel-tottenham-2024.jpg",
    imageHint: "Gabriel's 64th-minute winner — NLD, September 2024",
    options: ["Gabriel Magalhães", "Kai Havertz", "William Saliba", "Jurrien Timber"],
    reveal: "The only goal of the game. Gabriel's near-post header from a corner — Arsenal won 1-0. Consecutive North London Derby wins.",
  },
  {
    scorer: "Jurrien Timber",
    opponent: "Manchester United", date: "4 Dec 2024",
    imagePath: "arsenal-quiz/corners/07-timber-man-utd-2024.jpg",
    imageHint: "Timber near-post flick from Rice corner — Dec 2024",
    options: ["Jurrien Timber", "Gabriel Magalhães", "William Saliba", "Riccardo Calafiori"],
    reveal: "Rice's corner, Timber flicked home at the near post. Arsenal won 2-0 — one of their most complete performances of the season.",
  },
  {
    scorer: "Gabriel Magalhães",
    opponent: "Newcastle", date: "28 Sep 2025",
    imagePath: "arsenal-quiz/corners/08-gabriel-newcastle-2025.jpg",
    imageHint: "Gabriel 96th-minute winner — Emirates comeback, Sep 2025",
    options: ["Gabriel Magalhães", "William Saliba", "Martin Ødegaard", "Jurrien Timber"],
    reveal: "Arsenal were 1-0 down. Gabriel headed home in the 96th minute to win it 2-1. The Emirates erupted. Three points that proved crucial in the title race.",
  },
  {
    scorer: "William Saliba",
    opponent: "Chelsea", date: "1 Mar 2026",
    imagePath: "arsenal-quiz/corners/09-saliba-chelsea-2026.jpg",
    imageHint: "Saliba corner goal as Arsenal break the PL record — Mar 2026",
    options: ["William Saliba", "Gabriel Magalhães", "Jurrien Timber", "Riccardo Calafiori"],
    reveal: "Saliba scored from a corner as Arsenal equalled the all-time PL record. Peter Schmeichel complained about 'the championship being decided on corner kicks.' His own 1999 UCL win ended with two late corners.",
  },
  {
    scorer: "Eberechi Eze",
    opponent: "Newcastle", date: "Apr 2026",
    imagePath: "arsenal-quiz/corners/10-eze-newcastle-2026.jpg",
    imageHint: "Eze short corner routine — record-breaking 17th corner goal, Apr 2026",
    options: ["Eberechi Eze", "Bukayo Saka", "Kai Havertz", "Gabriel Magalhães"],
    reveal: "Arsenal's 17th corner goal of the season — a new all-time Premier League record. Eze finished from a short corner routine, breaking the record Arteta's side had set two seasons earlier.",
  },
];

// ─── Photo slot (shows placeholder until image is present) ───────────────────

function CornerPhotoSlot({ src, hint }: { src: string; hint: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className="rounded-2xl flex flex-col items-center justify-center mb-5"
        style={{ height: 180, background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.15)" }}
      >
        <div className="text-3xl mb-2">📸</div>
        <div className="text-xs text-center px-6 leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>{hint}</div>
        <div className="text-[10px] mt-2" style={{ color: "rgba(255,255,255,0.15)" }}>public/arsenal-quiz/corners/</div>
      </div>
    );
  }
  return (
    <img
      src={`/${src}`}
      alt={hint}
      onError={() => setFailed(true)}
      className="w-full rounded-2xl object-cover object-top mb-5"
      style={{ height: 220 }}
    />
  );
}

// ─── Round 5: Corner Kings ────────────────────────────────────────────────────

function Round5CornerKings({ onComplete }: { onComplete: (score: number) => void }) {
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);

  const g = ROUND5_CORNERS[qIndex];
  const revealed = selected !== null;
  const isCorrect = selected === g.scorer;

  function handleSelect(opt: string) {
    if (revealed) return;
    setSelected(opt);
  }

  function handleNext() {
    const newAnswers = [...answers, selected === g.scorer];
    if (qIndex + 1 >= ROUND5_CORNERS.length) {
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
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs font-bold tracking-widest uppercase" style={{ color: GOLD }}>Corner Kings</div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Arsenal broke PL records scoring from corners</div>
        </div>
        <div className="text-right">
          <span className="text-3xl leading-none" style={{ fontFamily: BEBAS, color: "white", letterSpacing: "0.04em" }}>Q{qIndex + 1}</span>
          <span className="text-sm ml-1" style={{ color: "rgba(255,255,255,0.3)" }}>/ 10</span>
        </div>
      </div>

      <div className="flex gap-1 mb-6">
        {ROUND5_CORNERS.map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300" style={{
            background: i < answers.length ? (answers[i] ? GOLD : RED) : i === qIndex ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.08)",
          }} />
        ))}
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs mb-4" style={{
        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)",
      }}>
        🚩 {g.opponent} · {g.date}
      </div>

      <CornerPhotoSlot src={g.imagePath} hint={g.imageHint} />

      <div className="text-sm font-semibold text-white mb-4">Who scored from the corner?</div>

      <div className="grid grid-cols-2 gap-2.5 mb-5">
        {g.options.map(opt => {
          const isSelected = selected === opt;
          const isCorrectOpt = opt === g.scorer;
          let btnStyle: React.CSSProperties = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" };
          if (revealed) {
            if (isCorrectOpt) btnStyle = { background: "rgba(200,150,12,0.18)", border: `2px solid ${GOLD}`, color: GOLD_LIGHT };
            else if (isSelected) btnStyle = { background: "rgba(219,0,7,0.15)", border: `2px solid ${RED}`, color: "#ff8888" };
            else btnStyle = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.25)" };
          }
          return (
            <button key={opt} onClick={() => handleSelect(opt)} disabled={revealed}
              className="outline-none focus:outline-none rounded-xl py-4 px-3 text-sm font-semibold text-center leading-tight transition-all duration-200 active:scale-95 disabled:cursor-default"
              style={btnStyle}>
              {opt}
              {revealed && isCorrectOpt && <span className="ml-1 opacity-80">✓</span>}
              {revealed && isSelected && !isCorrectOpt && <span className="ml-1 opacity-80">✗</span>}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {revealed && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div className="rounded-xl p-4 mb-4" style={{
              background: isCorrect ? "rgba(200,150,12,0.08)" : "rgba(255,255,255,0.04)",
              border: isCorrect ? `1px solid rgba(200,150,12,0.35)` : "1px solid rgba(255,255,255,0.1)",
            }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{isCorrect ? "✅" : "❌"}</span>
                <span className="font-bold text-sm" style={{ color: isCorrect ? GOLD_LIGHT : "white" }}>
                  {isCorrect ? "Correct!" : `It was ${g.scorer}`}
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{g.reveal}</p>
            </div>
            <GoldButton onClick={handleNext} className="w-full py-3.5 flex items-center justify-center gap-2">
              <span style={{ fontFamily: BEBAS, letterSpacing: "0.06em", fontSize: "1.1rem" }}>
                {qIndex + 1 >= ROUND5_CORNERS.length ? "FINISH ROUND" : "NEXT QUESTION"}
              </span>
              <ChevronRight className="w-4 h-4" />
            </GoldButton>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Round 9 data ────────────────────────────────────────────────────────────

const ROUND9_CORRECT = {
  defenders: ["Maitland-Niles", "Sokratis", "David Luiz", "Saka"],
  midfield: ["Torreira", "Xhaka", "Özil"],
  attackers: ["Nelson", "Aubameyang", "Lacazette"],
};

const ROUND9_POOL_BASE = [
  // correct 10
  "Maitland-Niles", "Sokratis", "David Luiz", "Saka",
  "Torreira", "Xhaka", "Özil",
  "Nelson", "Aubameyang", "Lacazette",
  // 14 plausible decoys from the 2019/20 squad
  "Kolašinac", "Pépé", "Mustafi", "Bellerín", "Holding",
  "Guendouzi", "Ceballos", "Mkhitaryan",
  "Martinelli", "Nketiah", "Chambers", "Tierney", "Willock", "Elneny",
];

type R9Category = "defenders" | "midfield" | "attackers";
type R9Screen = R9Category | "results";

const R9_SCREENS: R9Category[] = ["defenders", "midfield", "attackers"];
const R9_CONFIG: Record<R9Category, { label: string; subtitle: string; slots: number }> = {
  defenders: { label: "DEFENDERS", subtitle: "Pick 4 defenders", slots: 4 },
  midfield: { label: "MIDFIELD", subtitle: "Pick 3 midfielders", slots: 3 },
  attackers: { label: "ATTACKERS", subtitle: "Pick 3 attackers", slots: 3 },
};

function Round9BuildTheXI({ onComplete }: { onComplete: (score: number) => void }) {
  const [pool] = useState<string[]>(() => [...ROUND9_POOL_BASE].sort(() => Math.random() - 0.5));
  const [screen, setScreen] = useState<R9Screen>("defenders");
  const [picks, setPicks] = useState<Record<R9Category, string[]>>({
    defenders: [], midfield: [], attackers: [],
  });

  const screenIdx = screen === "results" ? 3 : R9_SCREENS.indexOf(screen as R9Category);
  const config = screen !== "results" ? R9_CONFIG[screen as R9Category] : null;
  const currentPicks = screen !== "results" ? picks[screen as R9Category] : [];
  const isFull = config ? currentPicks.length >= config.slots : false;

  const usedInPrior = new Set<string>([
    ...(screenIdx >= 1 ? picks.defenders : []),
    ...(screenIdx >= 2 ? picks.midfield : []),
  ]);

  function togglePlayer(name: string) {
    if (screen === "results") return;
    const cat = screen as R9Category;
    if (usedInPrior.has(name)) return;
    setPicks(prev => {
      const cur = prev[cat];
      if (cur.includes(name)) return { ...prev, [cat]: cur.filter(n => n !== name) };
      if (cur.length >= R9_CONFIG[cat].slots) return prev;
      return { ...prev, [cat]: [...cur, name] };
    });
  }

  function handleNext() {
    if (screen === "defenders") setScreen("midfield");
    else if (screen === "midfield") setScreen("attackers");
    else if (screen === "attackers") setScreen("results");
  }

  function handleFinish() {
    const score =
      picks.defenders.filter(n => ROUND9_CORRECT.defenders.includes(n)).length +
      picks.midfield.filter(n => ROUND9_CORRECT.midfield.includes(n)).length +
      picks.attackers.filter(n => ROUND9_CORRECT.attackers.includes(n)).length;
    onComplete(score);
  }

  if (screen === "results") {
    const total =
      picks.defenders.filter(n => ROUND9_CORRECT.defenders.includes(n)).length +
      picks.midfield.filter(n => ROUND9_CORRECT.midfield.includes(n)).length +
      picks.attackers.filter(n => ROUND9_CORRECT.attackers.includes(n)).length;

    return (
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="pb-16">
        <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: GOLD }}>Build the XI — Results</div>
        <div className="text-xs mb-6" style={{ color: "rgba(255,255,255,0.35)" }}>Arsenal vs Burnley · 18 May 2026</div>

        {(["defenders", "midfield", "attackers"] as R9Category[]).map(cat => {
          const correct = ROUND9_CORRECT[cat];
          const chosen = picks[cat];
          const catScore = chosen.filter(n => correct.includes(n)).length;
          return (
            <div key={cat} className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xs font-bold tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {cat.toUpperCase()}
                </div>
                <div className="text-xs font-bold" style={{ color: catScore === correct.length ? GOLD : "rgba(255,255,255,0.5)" }}>
                  {catScore}/{correct.length}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {chosen.map(name => {
                  const ok = correct.includes(name);
                  return (
                    <div key={name} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{
                      background: ok ? "rgba(200,150,12,0.15)" : "rgba(219,0,7,0.15)",
                      border: `1px solid ${ok ? GOLD + "88" : RED + "88"}`,
                      color: ok ? GOLD_LIGHT : "#ff8888",
                    }}>
                      {name} {ok ? "✓" : "✗"}
                    </div>
                  );
                })}
                {correct.filter(n => !chosen.includes(n)).map(name => (
                  <div key={name} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{
                    background: "rgba(200,150,12,0.05)",
                    border: "1px solid rgba(200,150,12,0.25)",
                    color: "rgba(200,150,12,0.55)",
                  }}>
                    {name}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div
          className="rounded-xl p-4 mb-5 text-center"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
        >
          <div className="text-3xl font-bold mb-0.5" style={{ fontFamily: BEBAS, color: GOLD, letterSpacing: "0.04em" }}>
            {total} / 10
          </div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>players correctly placed</div>
        </div>

        <GoldButton onClick={handleFinish} className="w-full py-3.5 flex items-center justify-center gap-2">
          <span style={{ fontFamily: BEBAS, letterSpacing: "0.06em", fontSize: "1.1rem" }}>FINISH ROUND</span>
          <ChevronRight className="w-4 h-4" />
        </GoldButton>
      </motion.div>
    );
  }

  return (
    <motion.div
      key={screen}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      className="pb-16"
    >
      {/* Round header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs font-bold tracking-widest uppercase" style={{ color: GOLD }}>Build the XI</div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Arteta's debut · Bournemouth · 26 Dec 2019</div>
        </div>
        <div className="text-right">
          <span className="text-3xl leading-none" style={{ fontFamily: BEBAS, color: "white", letterSpacing: "0.04em" }}>
            {screenIdx + 1}
          </span>
          <span className="text-sm ml-1" style={{ color: "rgba(255,255,255,0.3)" }}>/ 3</span>
        </div>
      </div>

      {/* Screen progress */}
      <div className="flex gap-1.5 mb-5">
        {R9_SCREENS.map((s, i) => (
          <div key={s} className="flex-1 h-1 rounded-full transition-all duration-300" style={{
            background: i < screenIdx ? GOLD : i === screenIdx ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.08)",
          }} />
        ))}
      </div>

      {/* Category + slots */}
      <div className="rounded-2xl p-4 mb-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
        <div className="text-xs font-bold tracking-widest uppercase mb-0.5" style={{ color: GOLD }}>{config!.label}</div>
        <div className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.45)" }}>{config!.subtitle}</div>
        <div className="flex gap-2">
          {Array.from({ length: config!.slots }).map((_, i) => (
            <div key={i} className="flex-1 py-2 rounded-lg text-center truncate" style={{
              background: i < currentPicks.length ? "rgba(200,150,12,0.12)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${i < currentPicks.length ? GOLD + "55" : "rgba(255,255,255,0.1)"}`,
              color: i < currentPicks.length ? GOLD_LIGHT : "rgba(255,255,255,0.18)",
              fontSize: "0.65rem",
              fontWeight: 600,
            }}>
              {currentPicks[i] || "—"}
            </div>
          ))}
        </div>
      </div>

      {/* Player pool */}
      <div className="text-xs font-bold tracking-widest uppercase mb-2.5" style={{ color: "rgba(255,255,255,0.3)" }}>
        SELECT {config!.slots} PLAYERS · {currentPicks.length}/{config!.slots} chosen
      </div>
      <div className="grid grid-cols-3 gap-2 mb-5">
        {pool.map(name => {
          const isUsed = usedInPrior.has(name);
          const isSelected = currentPicks.includes(name);
          const isDisabled = isUsed || (!isSelected && isFull);
          return (
            <button
              key={name}
              onClick={() => togglePlayer(name)}
              disabled={isDisabled}
              className="outline-none focus:outline-none rounded-xl py-2.5 px-2 text-xs font-semibold text-center transition-all duration-150 active:scale-95 disabled:cursor-default leading-tight"
              style={
                isUsed
                  ? { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.12)" }
                  : isSelected
                  ? { background: "rgba(200,150,12,0.2)", border: `2px solid ${GOLD}`, color: GOLD_LIGHT }
                  : isDisabled
                  ? { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.18)" }
                  : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }
              }
            >
              {name}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {isFull && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <GoldButton onClick={handleNext} className="w-full py-3.5 flex items-center justify-center gap-2">
              <span style={{ fontFamily: BEBAS, letterSpacing: "0.06em", fontSize: "1.1rem" }}>
                {screen === "attackers" ? "SUBMIT XI" : "NEXT →"}
              </span>
              <ChevronRight className="w-4 h-4" />
            </GoldButton>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Rounds 6 & 7 data ───────────────────────────────────────────────────────

const TOP10_SCORERS_SET = new Set([
  "Bukayo Saka", "Gabriel Martinelli", "Pierre-Emerick Aubameyang",
  "Martin Ødegaard", "Leandro Trossard", "Alexandre Lacazette",
  "Kai Havertz", "Gabriel Jesus", "Gabriel Magalhães", "Eddie Nketiah",
]);

const TOP10_ASSISTERS_SET = new Set([
  "Bukayo Saka", "Martin Ødegaard", "Leandro Trossard",
  "Gabriel Martinelli", "Declan Rice", "Alexandre Lacazette",
  "Granit Xhaka", "Kai Havertz", "Ben White", "Gabriel Jesus",
]);

// ─── Shared Select-Top-10 mechanic ───────────────────────────────────────────

function SelectTopTenRound({
  topSet,
  roundName,
  subtitle,
  onComplete,
}: {
  topSet: Set<string>;
  roundName: string;
  subtitle: string;
  onComplete: (score: number) => void;
}) {
  const [allPlayers] = useState<string[]>(() =>
    arsenalStats.map(p => p.displayName).sort(() => Math.random() - 0.5)
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const isFull = selected.length >= 10;

  function togglePlayer(name: string) {
    if (submitted) return;
    setSelected(prev => {
      if (prev.includes(name)) return prev.filter(n => n !== name);
      if (prev.length >= 10) return prev;
      return [...prev, name];
    });
  }

  function handleSubmit() {
    setSubmitted(true);
  }

  function handleFinish() {
    onComplete(selected.filter(n => topSet.has(n)).length);
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      className="pb-16"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs font-bold tracking-widest uppercase" style={{ color: GOLD }}>{roundName}</div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{subtitle}</div>
        </div>
        <div
          className="px-3 py-1 rounded-full text-sm font-bold"
          style={{
            background: isFull ? "rgba(200,150,12,0.2)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${isFull ? GOLD : "rgba(255,255,255,0.12)"}`,
            color: isFull ? GOLD_LIGHT : "rgba(255,255,255,0.5)",
          }}
        >
          {selected.length}/10
        </div>
      </div>

      <div
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs mb-5"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }}
      >
        All Arteta-era PL appearances · select exactly 10 · order doesn't matter
      </div>

      {/* Player grid */}
      <div className="grid grid-cols-3 gap-1.5 mb-6">
        {allPlayers.map(name => {
          const isSelected = selected.includes(name);
          const isCorrect = topSet.has(name);
          const isDisabled = !isSelected && isFull && !submitted;

          let btnStyle: React.CSSProperties;
          if (submitted) {
            if (isSelected && isCorrect) {
              btnStyle = { background: "rgba(200,150,12,0.18)", border: `2px solid ${GOLD}`, color: GOLD_LIGHT };
            } else if (isSelected && !isCorrect) {
              btnStyle = { background: "rgba(219,0,7,0.15)", border: `2px solid ${RED}`, color: "#ff8888" };
            } else if (!isSelected && isCorrect) {
              btnStyle = { background: "rgba(200,150,12,0.05)", border: "1px solid rgba(200,150,12,0.28)", color: "rgba(200,150,12,0.55)" };
            } else {
              btnStyle = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.15)" };
            }
          } else if (isSelected) {
            btnStyle = { background: "rgba(200,150,12,0.2)", border: `2px solid ${GOLD}`, color: GOLD_LIGHT };
          } else if (isDisabled) {
            btnStyle = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.18)" };
          } else {
            btnStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.11)", color: "white" };
          }

          return (
            <button
              key={name}
              onClick={() => togglePlayer(name)}
              disabled={submitted || isDisabled}
              className="outline-none focus:outline-none rounded-xl py-2.5 px-1.5 text-center transition-all duration-150 active:scale-95 disabled:cursor-default leading-tight"
              style={{ ...btnStyle, fontSize: "0.65rem", fontWeight: 600 }}
            >
              {name}
            </button>
          );
        })}
      </div>

      {/* Submit / reveal */}
      {!submitted ? (
        <AnimatePresence>
          {isFull && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <GoldButton onClick={handleSubmit} className="w-full py-3.5 flex items-center justify-center gap-2">
                <span style={{ fontFamily: BEBAS, letterSpacing: "0.06em", fontSize: "1.1rem" }}>SUBMIT SELECTION</span>
                <ChevronRight className="w-4 h-4" />
              </GoldButton>
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div
            className="rounded-xl p-4 mb-4"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div className="font-bold text-sm text-white mb-1">
              {selected.filter(n => topSet.has(n)).length} / 10 correct
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
              Gold = correct pick. Red = not in top 10. Faded gold outlines = ones you missed.
            </p>
          </div>
          <GoldButton onClick={handleFinish} className="w-full py-3.5 flex items-center justify-center gap-2">
            <span style={{ fontFamily: BEBAS, letterSpacing: "0.06em", fontSize: "1.1rem" }}>FINISH ROUND</span>
            <ChevronRight className="w-4 h-4" />
          </GoldButton>
        </motion.div>
      )}
    </motion.div>
  );
}

function Round6TopScorers({ onComplete }: { onComplete: (score: number) => void }) {
  return (
    <SelectTopTenRound
      topSet={TOP10_SCORERS_SET}
      roundName="Top Scorers"
      subtitle="Select the top 10 PL goalscorers under Arteta"
      onComplete={onComplete}
    />
  );
}

function Round7AssistMasters({ onComplete }: { onComplete: (score: number) => void }) {
  return (
    <SelectTopTenRound
      topSet={TOP10_ASSISTERS_SET}
      roundName="The Assist Masters"
      subtitle="Select the top 10 PL assisters under Arteta"
      onComplete={onComplete}
    />
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ArsenalChampions() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<Phase>("intro");
  const [currentRound, setCurrentRound] = useState(0);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const [devOpen, setDevOpen] = useState(false);

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

              {/* ── DEV: jump to round ── */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1 }}
                className="mt-10 w-full max-w-xs"
              >
                <button
                  onClick={() => setDevOpen(v => !v)}
                  className="outline-none focus:outline-none text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full transition-all"
                  style={{
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "rgba(255,255,255,0.35)",
                  }}
                >
                  {devOpen ? "▲ DEV" : "▼ DEV"}
                </button>

                <AnimatePresence>
                  {devOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div
                        className="rounded-2xl p-3"
                        style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)" }}
                      >
                        <div className="text-[10px] font-bold tracking-widest uppercase mb-2.5 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
                          Jump to round
                        </div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {ROUNDS.map((r, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setRoundScores([]);
                                setCurrentRound(i);
                                setPhase("playing");
                                setDevOpen(false);
                              }}
                              className="outline-none focus:outline-none rounded-xl py-2 flex flex-col items-center gap-0.5 transition-all active:scale-95"
                              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
                            >
                              <span className="text-sm">{r.emoji}</span>
                              <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>R{i + 1}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
                  {currentRound === 0 ? (
                    <Round1TrustTheProcess onComplete={handleRoundComplete} />
                  ) : currentRound === 1 ? (
                    <Round2WhoDoubtedUs onComplete={handleRoundComplete} />
                  ) : currentRound === 2 ? (
                    <Round3ArtetaSpeaks onComplete={handleRoundComplete} />
                  ) : currentRound === 3 ? (
                    <Round4SeasonStats onComplete={handleRoundComplete} />
                  ) : currentRound === 4 ? (
                    <Round5CornerKings onComplete={handleRoundComplete} />
                  ) : currentRound === 5 ? (
                    <Round6TopScorers onComplete={handleRoundComplete} />
                  ) : currentRound === 6 ? (
                    <Round7AssistMasters onComplete={handleRoundComplete} />
                  ) : currentRound === 8 ? (
                    <Round9BuildTheXI onComplete={handleRoundComplete} />
                  ) : currentRound === 9 ? (
                    <Round10GuessTheScore onComplete={handleRoundComplete} />
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
