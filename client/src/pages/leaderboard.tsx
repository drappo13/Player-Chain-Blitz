import { useState } from "react";
import { motion } from "framer-motion";
import { Home, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useUser } from "@/lib/user-context";
import { useGameLeaderboard, useGlobalLeaderboard, type LeaderboardPeriod } from "@/lib/use-leaderboard";
import { useDailyLeaderboard, type DailyPeriod } from "@/lib/use-daily-leaderboard";
import { LeaderboardTable } from "@/components/leaderboard-table";
import type { GameSlug } from "@/lib/save-score";
import type { DailyGameSlug } from "@/lib/daily-score";

type LeaderboardMode = "daily" | "arcade";

const ARCADE_TABS: { slug: GameSlug; label: string; accent: string }[] = [
  { slug: "targetman", label: "TargetMan", accent: "bg-orange-500/10 border-orange-500/30" },
  { slug: "overlap", label: "Overlap", accent: "bg-blue-500/10 border-blue-500/30" },
  { slug: "clubladder", label: "LadderUp", accent: "bg-purple-500/10 border-purple-500/30" },
  { slug: "goalchain", label: "GoalChain", accent: "bg-emerald-500/10 border-emerald-500/30" },
  { slug: "slamchain", label: "Slam16", accent: "bg-emerald-500/10 border-emerald-500/30" },
  { slug: "gridlock", label: "GridLock", accent: "bg-red-500/10 border-red-500/30" },
];

const DAILY_TABS: { slug: DailyGameSlug; label: string; accent: string }[] = [
  { slug: "griddle", label: "Griddle", accent: "bg-blue-500/10 border-blue-500/30" },
];

export default function Leaderboard() {
  const [, navigate] = useLocation();
  const { user } = useUser();
  const [mode, setMode] = useState<LeaderboardMode>("daily");
  const [arcadeTab, setArcadeTab] = useState<GameSlug | "global">("targetman");
  const [arcadePeriod, setArcadePeriod] = useState<LeaderboardPeriod>("alltime");
  const [globalMode, setGlobalMode] = useState<"points" | "plays">("points");
  const [dailyTab, setDailyTab] = useState<DailyGameSlug>("griddle");
  const [dailyPeriod, setDailyPeriod] = useState<DailyPeriod>("today");

  const activeArcadeGame = ARCADE_TABS.find(g => g.slug === arcadeTab);
  const activeDailyGame = DAILY_TABS.find(g => g.slug === dailyTab);

  return (
    <div className="min-h-screen bg-background flex items-start pt-10 sm:pt-14 justify-center p-4 relative overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-chart-2/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-lg w-full relative z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate("/")} className="font-bold">
            <Home className="w-4 h-4 mr-1.5" />Home
          </Button>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-black text-foreground">Leaderboards</h1>
          </div>
          <div className="w-[72px]" />
        </div>

        {/* Mode toggle: Daily / Arcade */}
        <div className="flex justify-center gap-1 mb-4">
          {(["daily", "arcade"] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                mode === m
                  ? m === "daily"
                    ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                    : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              {m === "daily" ? "Daily" : "Arcade"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="rounded-lg border border-border/60 bg-card p-3 sm:p-4">
          {mode === "daily" ? (
            <>
              {/* Daily game tabs */}
              {DAILY_TABS.length > 1 && (
                <div className="flex gap-1 overflow-x-auto pb-2 mb-4 -mx-1 px-1 no-scrollbar">
                  {DAILY_TABS.map(g => (
                    <TabButton key={g.slug} active={dailyTab === g.slug} onClick={() => setDailyTab(g.slug)} label={g.label} />
                  ))}
                </div>
              )}
              <DailySection
                game={dailyTab}
                period={dailyPeriod}
                onPeriodChange={setDailyPeriod}
                currentUser={user?.username}
                accentBg={activeDailyGame?.accent || ""}
              />
            </>
          ) : (
            <>
              {/* Arcade game tabs */}
              <div className="flex gap-1 overflow-x-auto pb-2 mb-4 -mx-1 px-1 no-scrollbar">
                <TabButton active={arcadeTab === "global"} onClick={() => setArcadeTab("global")} label="All Games" accent />
                {ARCADE_TABS.map(g => (
                  <TabButton key={g.slug} active={arcadeTab === g.slug} onClick={() => setArcadeTab(g.slug)} label={g.label} />
                ))}
              </div>
              {arcadeTab === "global" ? (
                <GlobalSection
                  period={arcadePeriod}
                  onPeriodChange={setArcadePeriod}
                  mode={globalMode}
                  onModeChange={setGlobalMode}
                  currentUser={user?.username}
                />
              ) : activeArcadeGame ? (
                <ArcadeGameSection
                  game={activeArcadeGame.slug}
                  period={arcadePeriod}
                  onPeriodChange={setArcadePeriod}
                  currentUser={user?.username}
                  accentBg={activeArcadeGame.accent}
                />
              ) : null}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function TabButton({ active, onClick, label, accent }: {
  active: boolean; onClick: () => void; label: string; accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors shrink-0 ${
        active
          ? accent ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : "bg-foreground/10 text-foreground"
          : accent ? "text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
      }`}
    >
      {label}
    </button>
  );
}

function DailySection({ game, period, onPeriodChange, currentUser, accentBg }: {
  game: DailyGameSlug;
  period: DailyPeriod;
  onPeriodChange: (p: DailyPeriod) => void;
  currentUser?: string;
  accentBg: string;
}) {
  const { entries, loading } = useDailyLeaderboard(game, period, 20);

  return (
    <div>
      <div className="flex justify-center gap-1 mb-4">
        {(["today", "yesterday"] as const).map(p => (
          <button
            key={p}
            onClick={() => onPeriodChange(p)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              period === p ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p === "today" ? "Today" : "Yesterday"}
          </button>
        ))}
      </div>
      <LeaderboardTable
        entries={entries}
        loading={loading}
        period="today"
        onPeriodChange={() => {}}
        currentUser={currentUser}
        accentBg={accentBg}
        scoreLabel="Score"
        mini
        max={20}
      />
    </div>
  );
}

function ArcadeGameSection({ game, period, onPeriodChange, currentUser, accentBg }: {
  game: GameSlug;
  period: LeaderboardPeriod;
  onPeriodChange: (p: LeaderboardPeriod) => void;
  currentUser?: string;
  accentBg: string;
}) {
  const { entries, loading } = useGameLeaderboard(game, period, 20);
  return (
    <LeaderboardTable
      entries={entries}
      loading={loading}
      period={period}
      onPeriodChange={onPeriodChange}
      currentUser={currentUser}
      accentBg={accentBg}
      scoreLabel="High Score"
    />
  );
}

function GlobalSection({ period, onPeriodChange, mode, onModeChange, currentUser }: {
  period: LeaderboardPeriod;
  onPeriodChange: (p: LeaderboardPeriod) => void;
  mode: "points" | "plays";
  onModeChange: (m: "points" | "plays") => void;
  currentUser?: string;
}) {
  const { entries, loading } = useGlobalLeaderboard(mode, period, 20);
  return (
    <div>
      <div className="flex justify-center gap-1 mb-3">
        {(["points", "plays"] as const).map(m => (
          <button key={m} onClick={() => onModeChange(m)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              mode === m ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>
            {m === "points" ? "Total Points" : "Most Plays"}
          </button>
        ))}
      </div>
      <LeaderboardTable
        entries={entries}
        loading={loading}
        period={period}
        onPeriodChange={onPeriodChange}
        currentUser={currentUser}
        scoreLabel={mode === "points" ? "Points" : "Plays"}
        formatScore={(score, entry) => mode === "plays" ? `${score} plays` : score.toLocaleString()}
      />
    </div>
  );
}
