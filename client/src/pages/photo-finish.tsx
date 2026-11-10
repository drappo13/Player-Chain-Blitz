import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import photoPool from "@/data/photo-finish.json";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Home, Trophy, ChevronRight, Info, Minus, Plus, ExternalLink, Share2, Check, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { playCorrect, playNeutral, playHighScore, playGameEnd, playComboCorrect } from "@/lib/sounds";
import { ScreenFlash } from "@/components/screen-flash";
import { useUser } from "@/lib/user-context";
import { submitDailyScore, hasDailySubmission } from "@/lib/daily-score";
import { useDailyLeaderboard, type DailyPeriod } from "@/lib/use-daily-leaderboard";
import { LeaderboardTable } from "@/components/leaderboard-table";

// --- Photos ---
// Each photo is the lead image of a BBC Sport Premier League match report.
// `season` is the start year (2009 = 2009/10); `small` marks the ~200px images
// of the mid-2000s, which are shown in a polaroid frame instead of stretched.
interface Photo {
  season: number;
  date: string;
  score: string;
  caption: string;
  intro: string;
  img: string;
  url: string;
  small: boolean;
}

const POOL = photoPool as Photo[];
const ROUNDS = 10;
const FIRST_SEASON = 1992;
const LAST_SEASON = Math.max(...POOL.map(p => p.season));
const ROUND_VERSION = 1; // bump to reshuffle every day's photos
const PF_EPOCH = "2026-11-10";

// Points by how many seasons out the guess was
const POINTS = [100, 80, 60, 45, 30, 15, 5];
const pointsFor = (off: number) => POINTS[off] ?? 0;
const MAX_SCORE = ROUNDS * POINTS[0];

const RANKS = [
  { min: 0, label: "Sunday League" },
  { min: 250, label: "Squad Player" },
  { min: 400, label: "First Team" },
  { min: 550, label: "Seasoned Pro" },
  { min: 700, label: "Club Historian" },
  { min: 850, label: "Archivist" },
  { min: 950, label: "Time Lord" },
];
const rankFor = (score: number) => [...RANKS].reverse().find(r => score >= r.min)!;

// Where a season sits along the slider, as a CSS left offset
const pos = (y: number) => `${((y - FIRST_SEASON) / (LAST_SEASON - FIRST_SEASON)) * 100}%`;

const seasonLabel = (y: number) => `${y}/${String(y + 1).slice(2)}`;

// --- Seeded RNG ---
function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rng: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// --- Daily rounds ---
// The pool is sorted by date and cut into ten equal bands, so every day gets one
// photo from each era; each band deals its photos in a shuffled order day by day.
let bandsCache: Photo[][] | null = null;
function eraBands(): Photo[][] {
  if (bandsCache) return bandsCache;
  const sorted = [...POOL].sort((a, b) => a.date.localeCompare(b.date));
  const bands = Array.from({ length: ROUNDS }, (_, k) =>
    sorted.slice(Math.floor((k * sorted.length) / ROUNDS), Math.floor(((k + 1) * sorted.length) / ROUNDS)));
  bands.forEach((b, k) => shuffleInPlace(b, mulberry32(hashString(`photofinish-v${ROUND_VERSION}-${k}`))));
  bandsCache = bands;
  return bands;
}

function daysSinceEpoch(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [ey, em, ed] = PF_EPOCH.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ey, em - 1, ed)) / 86400000);
}

function photosFor(dateKey: string): Photo[] {
  const n = daysSinceEpoch(dateKey);
  const picks = eraBands().map(b => b[((n % b.length) + b.length) % b.length]);
  shuffleInPlace(picks, mulberry32(hashString(`photofinish-day-${dateKey}`)));
  return picks;
}

// A copy served from localhost is a test build: ?day=YYYY-MM-DD plays any day's
// photos and scores never reach the leaderboard.
const IS_LOCAL = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);

function shiftDay(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function getTodayStr(): string {
  if (IS_LOCAL) {
    const day = new URLSearchParams(window.location.search).get("day");
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// --- Daily state persistence ---
interface PFState {
  dateKey: string;
  roundsHash: string;
  guesses: number[]; // one locked-in season per round played
  submitted: boolean;
}

const makeRoundsHash = (photos: Photo[]) => String(hashString(photos.map(p => p.url).join("|")));

function storageKey(dateKey: string, username?: string): string {
  return username ? `photofinish-${username.toLowerCase()}-${dateKey}` : `photofinish-${dateKey}`;
}

function loadState(dateKey: string, photos: Photo[], username?: string): PFState {
  const hash = makeRoundsHash(photos);
  try {
    const raw = localStorage.getItem(storageKey(dateKey, username));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.dateKey === dateKey && parsed.roundsHash === hash) {
        return { ...parsed, guesses: parsed.guesses || [], submitted: parsed.submitted || false };
      }
    }
  } catch { /* ignore */ }
  return { dateKey, roundsHash: hash, guesses: [], submitted: false };
}

function saveState(state: PFState, username?: string) {
  try {
    localStorage.setItem(storageKey(state.dateKey, username), JSON.stringify(state));
  } catch { /* ignore */ }
}

const scoreOf = (photos: Photo[], guesses: number[]) =>
  guesses.reduce((s, g, i) => s + pointsFor(Math.abs(g - photos[i].season)), 0);

// A light tap on phones that support it (Android); silently nothing elsewhere.
function buzz(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}

const offColour = (off: number) =>
  off === 0 ? "text-emerald-300" : off <= 2 ? "text-amber-300" : off <= 4 ? "text-orange-400" : "text-red-400";
const offSquare = (off: number) => (off === 0 ? "🟩" : off <= 2 ? "🟨" : off <= 4 ? "🟧" : "⬛");
const offMessage = (off: number) => (off === 0 ? "Spot on!" : off === 1 ? "One season out" : `${off} seasons out`);

const formatDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
};

const formatMatchDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

export default function PhotoFinish() {
  const [, navigate] = useLocation();
  const { user } = useUser();
  const dateKey = useMemo(() => getTodayStr(), []);
  const photos = useMemo(() => photosFor(dateKey), [dateKey]);

  const [state, setState] = useState<PFState>(() => loadState(dateKey, photos, user?.username));
  // The round on screen; it trails guesses.length by one while a reveal is showing
  const [round, setRound] = useState(() => Math.min(loadState(dateKey, photos, user?.username).guesses.length, ROUNDS - 1));
  const [guess, setGuess] = useState(2009);
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [showRules, setShowRules] = useState(() => {
    const s = loadState(dateKey, photos, user?.username);
    return s.guesses.length === 0 && !s.submitted;
  });
  const checkedRemote = useRef(false);

  const score = scoreOf(photos, state.guesses);
  const photo = photos[round];
  const revealed = state.guesses.length > round;
  const isFinished = state.submitted;

  useEffect(() => {
    if (checkedRemote.current || !user?.username || IS_LOCAL) return;
    checkedRemote.current = true;
    hasDailySubmission(user.username, "photofinish", dateKey).then(result => {
      if (result.submitted && !state.submitted) setState(prev => ({ ...prev, submitted: true }));
    });
  }, [user?.username, dateKey, state.submitted]);

  useEffect(() => {
    saveState(state, user?.username);
  }, [state]);

  // Warm the next photo so it's ready when the reveal is dismissed
  useEffect(() => {
    const next = photos[round + 1];
    if (next) new Image().src = next.img;
  }, [photos, round]);

  const handleFinish = useCallback(async (guesses: number[]) => {
    setSubmitting(true);
    const total = scoreOf(photos, guesses);
    const exact = guesses.filter((g, i) => g === photos[i].season).length;
    if (user?.username && !IS_LOCAL) await submitDailyScore(user.username, "photofinish", dateKey, total, exact, ROUNDS);
    setState(prev => ({ ...prev, submitted: true }));
    setSubmitting(false);
    if (total >= 700) playHighScore(); else playGameEnd();
    setShowEndScreen(true);
  }, [photos, user?.username, dateKey]);

  const lockIn = useCallback(() => {
    if (revealed || isFinished) return;
    const off = Math.abs(guess - photo.season);
    setState(prev => ({ ...prev, guesses: [...prev.guesses, guess] }));
    if (off === 0) {
      playComboCorrect(5);
      buzz([30, 40, 30]);
      setFlashColor("bg-emerald-400");
      setTimeout(() => setFlashColor(null), 300);
    } else if (off <= 2) {
      playCorrect();
      buzz(15);
    } else {
      playNeutral();
      buzz(10);
    }
  }, [revealed, isFinished, guess, photo]);

  const next = useCallback(() => {
    if (round >= ROUNDS - 1) {
      handleFinish(state.guesses);
      return;
    }
    setRound(r => r + 1);
    setGuess(2009);
    setLoaded(false);
    window.scrollTo({ top: 0 });
  }, [round, state.guesses, handleFinish]);

  const nudge = (d: number) => {
    setGuess(g => Math.min(LAST_SEASON, Math.max(FIRST_SEASON, g + d)));
    buzz(4);
  };

  // Arrow keys nudge, Enter locks in / moves on
  useEffect(() => {
    if (showRules || showEndScreen || isFinished) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type === "range" && e.key.startsWith("Arrow")) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); if (!revealed) nudge(-1); }
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); if (!revealed) nudge(1); }
      else if (e.key === "Enter") { e.preventDefault(); if (revealed) next(); else lockIn(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showRules, showEndScreen, isFinished, revealed, next, lockIn]);

  const header = (
    <div className="w-full flex items-center justify-between mb-4">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}
          className="text-muted-foreground hover:text-foreground">
          <Home className="w-4 h-4 mr-1" /> Home
        </Button>
        {!showRules && (
          <button onClick={() => setShowRules(true)} title="How to play"
            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors">
            <Info className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-semibold">
          <Calendar className="w-3 h-3" />DAILY
        </span>
        <span className="text-sm text-muted-foreground">{formatDate(dateKey)}</span>
      </div>
      {IS_LOCAL && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 whitespace-nowrap rounded-full border border-amber-500/40 bg-background/90 px-3 py-1.5 text-xs shadow-lg">
          <span className="font-semibold text-amber-300">Test build</span>
          <span className="text-muted-foreground">no leaderboard</span>
          <a href={`/photofinish?day=${shiftDay(dateKey, -1)}`} className="px-2 py-0.5 rounded-full bg-muted/50 hover:bg-muted">← day</a>
          <a href={`/photofinish?day=${shiftDay(dateKey, 1)}`} className="px-2 py-0.5 rounded-full bg-muted/50 hover:bg-muted">day →</a>
        </div>
      )}
    </div>
  );

  const glow = (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full blur-3xl bg-amber-500/5" />
      <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full blur-3xl bg-orange-500/5" />
    </div>
  );

  // --- End Screen ---
  if (showEndScreen || (isFinished && !showRules)) {
    return <EndScreen photos={photos} guesses={state.guesses} dateKey={dateKey} navigate={navigate} username={user?.username} />;
  }

  // --- Rules Screen ---
  if (showRules) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {glow}
        <div className="relative z-10 flex flex-col items-center w-full max-w-lg mx-auto px-4 pt-4 pb-8 flex-1">
          {header}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full text-center">
            <h1 className="text-3xl font-black tracking-tight mb-1">
              <span className="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">Photo Finish</span>
            </h1>
            <p className="text-sm text-muted-foreground mb-6">Daily PL photo dating game</p>

            <div className="text-left space-y-3 mb-8">
              <RuleItem icon="📸" text={`${ROUNDS} photos from Premier League matches, each with its caption from the BBC match report`} />
              <RuleItem icon="📅" text="Slide to the season you think each photo was taken in, then lock it in" />
              <RuleItem icon="🎯" text={`Exact season scores ${POINTS[0]}. Then ${POINTS.slice(1).join(", ")} the further out you are. ${MAX_SCORE.toLocaleString()} is a perfect day`} />
              <RuleItem icon="📰" text="After each guess you'll see the match, the date and the report's opening line" />
            </div>

            <Button className="w-full text-lg py-6 shadow-xl shadow-amber-500/20 bg-gradient-to-r from-amber-300 to-orange-400 hover:from-amber-400 hover:to-orange-500 text-amber-950 font-bold"
              onClick={() => setShowRules(false)}>
              {isFinished ? "See today's results" : state.guesses.length > 0 ? "Back to today's photos" : "Play today's photos"}
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  const off = revealed ? Math.abs(state.guesses[round] - photo.season) : 0;

  // --- Playing Screen ---
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {glow}
      <ScreenFlash show={flashColor !== null} color={flashColor || "bg-amber-400"} />
      <style>{SLIDER_CSS}</style>

      <div className="relative z-10 flex flex-col items-center w-full max-w-lg mx-auto px-4 pt-4 pb-16 flex-1">
        {header}

        <div className="w-full flex items-center justify-between mb-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Photo {round + 1} of {ROUNDS}</div>
          <motion.div key={score} initial={{ scale: 1.25 }} animate={{ scale: 1 }}
            className="text-sm font-bold tabular-nums text-amber-300">{score} pts</motion.div>
        </div>
        <div className="w-full flex gap-1 mb-3">
          {photos.map((p, i) => {
            const g = state.guesses[i];
            const o = g === undefined ? null : Math.abs(g - p.season);
            return (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
                o === null ? (i === round ? "bg-amber-400/40" : "bg-muted")
                : o === 0 ? "bg-emerald-400" : o <= 2 ? "bg-amber-300" : o <= 4 ? "bg-orange-400" : "bg-red-400/70"}`} />
            );
          })}
        </div>

        {/* Photo */}
        <AnimatePresence mode="wait">
          <motion.div key={round} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }} className="w-full">
            <div className={`relative w-full min-h-[200px] rounded-xl overflow-hidden border border-border flex items-center justify-center ${
              photo.small ? "py-6 bg-[repeating-linear-gradient(45deg,#1a1410,#1a1410_10px,#1e1813_10px,#1e1813_20px)]" : "bg-black"}`}>
              {!loaded && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
                  <Camera className="w-10 h-10 animate-pulse" />
                </div>
              )}
              <motion.img src={photo.img} alt="" referrerPolicy="no-referrer"
                onLoad={() => setLoaded(true)} onError={() => setLoaded(true)}
                initial={false}
                animate={loaded ? { opacity: 1, filter: "brightness(1) sepia(0)" } : { opacity: 0, filter: "brightness(2.2) sepia(0.6)" }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className={photo.small
                  ? "w-auto max-w-[80%] max-h-[340px] bg-white p-2 pb-7 rounded-sm shadow-2xl shadow-black/70 -rotate-[1.5deg]"
                  : "w-full h-auto"} />
              {/* Shutter flash as the photo lands */}
              <AnimatePresence>
                {loaded && (
                  <motion.div key="flash" className="absolute inset-0 bg-white pointer-events-none"
                    initial={{ opacity: 0.85 }} animate={{ opacity: 0 }} transition={{ duration: 0.45, ease: "easeOut" }} />
                )}
              </AnimatePresence>
            </div>
            {photo.caption && (
              <p className="mt-2.5 px-0.5 font-serif italic text-[15px] leading-snug text-foreground/80">“{photo.caption}”</p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Guess / reveal */}
        {!revealed ? (
          <div className="w-full mt-4 rounded-2xl border border-border bg-card/60 p-4">
            <div className="text-center">
              <motion.div key={guess} initial={{ y: -3, opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.12 }}
                className="text-5xl font-black tabular-nums tracking-tight">{seasonLabel(guess)}</motion.div>
              <div className="text-xs text-muted-foreground mt-1">drag, or nudge with − +</div>
            </div>
            <div className="flex items-center gap-2.5 mt-3">
              <button type="button" onClick={() => nudge(-1)} aria-label="Earlier season"
                className="h-11 w-11 shrink-0 rounded-xl border border-border bg-background/60 flex items-center justify-center active:scale-95 transition">
                <Minus className="w-5 h-5" />
              </button>
              <input type="range" min={FIRST_SEASON} max={LAST_SEASON} value={guess} aria-label="Season"
                onChange={e => { setGuess(Number(e.target.value)); buzz(4); }}
                className="pf-slider flex-1" />
              <button type="button" onClick={() => nudge(1)} aria-label="Later season"
                className="h-11 w-11 shrink-0 rounded-xl border border-border bg-background/60 flex items-center justify-center active:scale-95 transition">
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="relative h-4 mx-[69px] -mt-1 text-[10px] text-muted-foreground/70 tabular-nums">
              {[1995, 2000, 2005, 2010, 2015, 2020, 2025].map(y => (
                <span key={y} className="absolute -translate-x-1/2 flex flex-col items-center" style={{ left: pos(y) }}>
                  <span className="w-px h-1.5 bg-muted-foreground/40" />{y % 10 === 0 ? `'${String(y).slice(2)}` : ""}
                </span>
              ))}
            </div>
            <Button className="w-full mt-4 text-base py-6 bg-gradient-to-r from-amber-300 to-orange-400 hover:from-amber-400 hover:to-orange-500 text-amber-950 font-bold"
              onClick={lockIn}>
              Lock in
            </Button>
          </div>
        ) : (
          <div className="w-full mt-4">
            <div className="rounded-2xl border border-border bg-card/60 px-4 pt-3 pb-3">
              <div className="relative h-16 mx-2">
                <div className="absolute inset-x-0 top-[27px] h-1.5 rounded-full bg-muted" />
                <motion.div className="absolute top-[2px] z-10 -translate-x-1/2 text-center text-xs font-bold text-amber-300 whitespace-nowrap"
                  initial={{ left: pos(state.guesses[round]) }} animate={{ left: pos(photo.season) }}
                  transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.1 }}>
                  {seasonLabel(photo.season)}
                  <div className="w-5 h-5 mx-auto mt-0.5 rounded-full bg-amber-400 border-[3px] border-background" />
                </motion.div>
                <div className="absolute top-[24px] -translate-x-1/2 text-center text-[11px] font-semibold text-muted-foreground whitespace-nowrap"
                  style={{ left: pos(state.guesses[round]) }}>
                  <div className="w-3.5 h-3.5 mx-auto mb-1 rounded-full bg-muted-foreground border-[3px] border-background" />
                  You: {seasonLabel(state.guesses[round])}
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">{offMessage(off)}</span>
                <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 14, delay: 0.35 }}
                  className={`text-3xl font-black tabular-nums ${offColour(off)}`}>+{pointsFor(off)}</motion.span>
              </div>
            </div>

            <motion.div initial={{ opacity: 0, y: 14, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: 0.4 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.25 }}
              className="mt-3 rounded-md bg-[#f3ecdc] text-[#2a2620] px-4 pt-3 pb-3.5 shadow-xl shadow-black/50">
              <div className="flex justify-between border-b border-[#cfc4ad] pb-1.5 text-[10px] uppercase tracking-[0.14em] text-[#7a6f5c]">
                <span>BBC Sport</span><span>{formatMatchDate(photo.date)}</span>
              </div>
              <h2 className="font-serif text-2xl font-semibold mt-2 mb-1.5 leading-tight">{photo.score}</h2>
              <p className="font-serif text-[15px] leading-relaxed">{photo.intro}</p>
              <a href={photo.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-[#8a5a00] hover:underline">
                Read the match report <ExternalLink className="w-3 h-3" />
              </a>
            </motion.div>

            <Button className="w-full mt-4 text-base py-6 bg-gradient-to-r from-amber-300 to-orange-400 hover:from-amber-400 hover:to-orange-500 text-amber-950 font-bold"
              onClick={next} disabled={submitting}>
              {round < ROUNDS - 1 ? "Next photo" : submitting ? "Submitting..." : "See your score"}
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

const SLIDER_CSS = `
.pf-slider{-webkit-appearance:none;appearance:none;height:40px;background:transparent;touch-action:none}
.pf-slider::-webkit-slider-runnable-track{height:8px;border-radius:4px;background:linear-gradient(90deg,#3a2f17,#f5b942)}
.pf-slider::-webkit-slider-thumb{-webkit-appearance:none;width:30px;height:30px;border-radius:50%;background:#ffd27a;border:3px solid #fff;margin-top:-11px;box-shadow:0 2px 10px rgba(0,0,0,.5)}
.pf-slider::-moz-range-track{height:8px;border-radius:4px;background:linear-gradient(90deg,#3a2f17,#f5b942)}
.pf-slider::-moz-range-thumb{width:26px;height:26px;border-radius:50%;background:#ffd27a;border:3px solid #fff}
`;

function RuleItem({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-lg shrink-0 mt-0.5">{icon}</span>
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  );
}

// --- End Screen Component ---
function EndScreen({ photos, guesses, dateKey, navigate, username }: {
  photos: Photo[];
  guesses: number[];
  dateKey: string;
  navigate: (to: string) => void;
  username?: string;
}) {
  const total = scoreOf(photos, guesses);
  const rank = rankFor(total);
  const offs = photos.map((p, i) => (guesses[i] === undefined ? null : Math.abs(guesses[i] - p.season)));
  const [lbPeriod, setLbPeriod] = useState<DailyPeriod>("today");
  const { entries, loading } = useDailyLeaderboard("photofinish", lbPeriod, 10, 1000);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const text = `Photo Finish ${formatDate(dateKey)}\n${offs.map(o => (o === null ? "⬜" : offSquare(o))).join("")} ${total}/${MAX_SCORE}\ndrapk.in/photofinish`;
    try {
      if (navigator.share && !window.matchMedia?.("(pointer: fine)").matches) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch { /* dismissed */ }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full blur-3xl bg-amber-500/5" />
        <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full blur-3xl bg-orange-500/5" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-lg mx-auto px-4 pt-4 pb-8 flex-1">
        <div className="w-full flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            <Home className="w-4 h-4 mr-1" /> Home
          </Button>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-semibold">
              <Calendar className="w-3 h-3" />DAILY
            </span>
            <span className="text-sm text-muted-foreground">{formatDate(dateKey)}</span>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            <span className="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">Photo Finish</span>
            <span className="text-muted-foreground text-lg ml-2">— Complete</span>
          </h1>
          <div className="text-5xl font-black tabular-nums text-amber-300">{total}</div>
          <div className="text-sm text-muted-foreground mt-1">out of {MAX_SCORE.toLocaleString()} · {offs.filter(o => o === 0).length} spot on</div>
          <div className="text-2xl tracking-[0.2em] mt-3">{offs.map(o => (o === null ? "⬜" : offSquare(o))).join("")}</div>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-sm font-bold px-3 py-1 rounded-full border bg-amber-500/10 border-amber-400/30 text-amber-300">{rank.label}</span>
            <button onClick={share}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full border border-border bg-card/60 hover:border-amber-400/50 transition-colors">
              {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</> : <><Share2 className="w-3.5 h-3.5" /> Share</>}
            </button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="w-full mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Trophy className="w-3 h-3" />Leaderboard
            </div>
            <div className="flex gap-1">
              {(["today", "yesterday"] as const).map(p => (
                <button key={p} onClick={() => setLbPeriod(p)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                    lbPeriod === p ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {p === "today" ? "Today" : "Yesterday"}
                </button>
              ))}
            </div>
          </div>
          <LeaderboardTable entries={entries} loading={loading} period="today" onPeriodChange={() => {}}
            currentUser={username} accentBg="bg-amber-500/10 border-amber-500/30" scoreLabel="Score" mini max={10} />
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="w-full mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Today's photos</h3>
          <div className="space-y-1.5">
            {photos.map((p, i) => (
              <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-2 py-2 rounded-lg border text-sm bg-card/50 border-border hover:border-amber-400/40 transition-colors">
                <img src={p.img} alt="" referrerPolicy="no-referrer" className="w-14 h-10 object-cover rounded shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.score}</div>
                  <div className="text-xs text-muted-foreground">
                    {seasonLabel(p.season)}{guesses[i] !== undefined && <> · you said {seasonLabel(guesses[i])}</>}
                  </div>
                </div>
                <span className={`font-bold tabular-nums ml-1 ${offs[i] === null ? "text-muted-foreground" : offColour(offs[i]!)}`}>
                  +{offs[i] === null ? 0 : pointsFor(offs[i]!)}
                </span>
              </a>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
          className="w-full text-center py-4 text-muted-foreground">
          <p className="text-sm">Come back tomorrow for new photos!</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/")}>
            <Home className="w-4 h-4 mr-1.5" /> Back to games
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
