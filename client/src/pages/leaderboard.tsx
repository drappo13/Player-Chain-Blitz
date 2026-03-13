import { useState } from "react";
import { motion } from "framer-motion";
import { Home, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useUser } from "@/lib/user-context";
import { useGameLeaderboard, useGlobalLeaderboard, type LeaderboardPeriod } from "@/lib/use-leaderboard";
import { LeaderboardTable } from "@/components/leaderboard-table";
import type { GameSlug } from "@/lib/save-score";

const GAME_TABS: { slug: GameSlug; label: string; accent: string }[] = [
  { slug: "targetman", label: "TargetMan", accent: "bg-orange-500/10 border-orange-500/30" },
  { slug: "overlap", label: "Overlap", accent: "bg-blue-500/10 border-blue-500/30" },
  { slug: "clubladder", label: "LadderUp", accent: "bg-purple-500/10 border-purple-500/30" },
  { slug: "goalchain", label: "GoalChain", accent: "bg-emerald-500/10 border-emerald-500/30" },
  { slug: "slamchain", label: "Slam16", accent: "bg-emerald-500/10 border-emerald-500/30" },
  { slug: "gridlock", label: "GridLock", accent: "bg-red-500/10 border-red-500/30" },
];

type TabId = GameSlug | "global";

export default function Leaderboard() {
  const [, navigate] = useLocation();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<TabId>("targetman");
  const [period, setPeriod] = useState<LeaderboardPeriod>("alltime");
  const [globalMode, setGlobalMode] = useState<"points" | "plays">("points");

  const activeGame = GAME_TABS.find((g) => g.slug === activeTab);

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/")}
            className="font-bold"
          >
            <Home className="w-4 h-4 mr-1.5" />
            Home
          </Button>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-black text-foreground">Leaderboards</h1>
          </div>
          <div className="w-[72px]" /> {/* Spacer to center title */}
        </div>

        {/* Tab bar — horizontally scrollable on mobile */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
          <TabButton
            active={activeTab === "global"}
            onClick={() => setActiveTab("global")}
            label="Global"
          />
          {GAME_TABS.map((g) => (
            <TabButton
              key={g.slug}
              active={activeTab === g.slug}
              onClick={() => setActiveTab(g.slug)}
              label={g.label}
            />
          ))}
        </div>

        {/* Content */}
        <div className="rounded-lg border border-border/60 bg-card p-3 sm:p-4">
          {activeTab === "global" ? (
            <GlobalSection
              period={period}
              onPeriodChange={setPeriod}
              mode={globalMode}
              onModeChange={setGlobalMode}
              currentUser={user?.username}
            />
          ) : activeGame ? (
            <GameSection
              game={activeGame.slug}
              period={period}
              onPeriodChange={setPeriod}
              currentUser={user?.username}
              accentBg={activeGame.accent}
            />
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors shrink-0 ${
        active
          ? "bg-foreground/10 text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
      }`}
    >
      {label}
    </button>
  );
}

function GameSection({
  game,
  period,
  onPeriodChange,
  currentUser,
  accentBg,
}: {
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

function GlobalSection({
  period,
  onPeriodChange,
  mode,
  onModeChange,
  currentUser,
}: {
  period: LeaderboardPeriod;
  onPeriodChange: (p: LeaderboardPeriod) => void;
  mode: "points" | "plays";
  onModeChange: (m: "points" | "plays") => void;
  currentUser?: string;
}) {
  const { entries, loading } = useGlobalLeaderboard(mode, period, 20);

  return (
    <div>
      {/* Mode toggle */}
      <div className="flex justify-center gap-1 mb-3">
        {(["points", "plays"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              mode === m
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
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
        formatScore={(score, entry) =>
          mode === "plays"
            ? `${score} plays`
            : score.toLocaleString()
        }
      />
    </div>
  );
}
