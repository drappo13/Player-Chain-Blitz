import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Loader2 } from "lucide-react";
import { useGameLeaderboard, type LeaderboardEntry, type LeaderboardPeriod } from "@/lib/use-leaderboard";
import type { GameSlug } from "@/lib/save-score";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  loading: boolean;
  period: LeaderboardPeriod;
  onPeriodChange: (p: LeaderboardPeriod) => void;
  /** Current user's username (to highlight their row) */
  currentUser?: string;
  /** Accent color class for the highlight row, e.g. "bg-purple-500/10 border-purple-500/30" */
  accentBg?: string;
  /** Label for the score column — defaults to "Score" */
  scoreLabel?: string;
  /** If true, shows a compact mini view (5 rows, no period toggle) */
  mini?: boolean;
  /** Max entries to show */
  max?: number;
  /** Format the score value for display */
  formatScore?: (score: number, entry: LeaderboardEntry) => string;
}

const RANK_MEDALS = ["", "\uD83E\uDD47", "\uD83E\uDD48", "\uD83E\uDD49"];

export function LeaderboardTable({
  entries,
  loading,
  period,
  onPeriodChange,
  currentUser,
  accentBg = "bg-primary/10 border-primary/30",
  scoreLabel = "Score",
  mini = false,
  max,
  formatScore,
}: LeaderboardTableProps) {
  const displayed = max ? entries.slice(0, max) : entries;
  const currentUserLower = currentUser?.toLowerCase();

  // Find current user's rank if not in displayed entries
  const userInList = displayed.some(
    (e) => e.username.toLowerCase() === currentUserLower,
  );
  const userRank = !userInList && currentUserLower
    ? entries.findIndex((e) => e.username.toLowerCase() === currentUserLower) + 1
    : 0;
  const userEntry = !userInList && userRank > 0
    ? entries[userRank - 1]
    : null;

  const formatFn = formatScore || ((s: number) => s.toLocaleString());

  return (
    <div>
      {/* Period toggle — hidden in mini mode */}
      {!mini && (
        <div className="flex justify-center gap-1 mb-4">
          {(["today", "alltime"] as const).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                period === p
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "today" ? "Today" : "All Time"}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          {period === "today" ? "No scores today yet. Be the first!" : "No scores yet."}
        </div>
      ) : (
        <div className="space-y-1">
          {displayed.map((entry, i) => {
            const rank = i + 1;
            const isMe = entry.username.toLowerCase() === currentUserLower;
            return (
              <motion.div
                key={`${entry.username}-${rank}`}
                initial={mini ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                  isMe ? `border ${accentBg}` : "hover:bg-muted/30"
                }`}
              >
                {/* Rank */}
                <span className="w-6 text-center font-bold text-muted-foreground shrink-0">
                  {RANK_MEDALS[rank] || rank}
                </span>

                {/* Avatar */}
                <span className="text-base shrink-0">{entry.avatar}</span>

                {/* Username */}
                <span
                  className={`font-medium truncate flex-1 min-w-0 ${
                    isMe ? "text-foreground" : "text-foreground/80"
                  }`}
                >
                  {entry.username}
                  {isMe && (
                    <span className="text-[10px] text-muted-foreground ml-1">(you)</span>
                  )}
                </span>

                {/* Score */}
                <span className="font-bold tabular-nums shrink-0">
                  {formatFn(entry.score, entry)}
                </span>
              </motion.div>
            );
          })}

          {/* Pinned "You" row if not in top N */}
          {userEntry && userRank > 0 && (
            <>
              <div className="border-t border-border/40 my-1" />
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm border ${accentBg}`}
              >
                <span className="w-6 text-center font-bold text-muted-foreground shrink-0">
                  {userRank}
                </span>
                <span className="text-base shrink-0">{userEntry.avatar}</span>
                <span className="font-medium truncate flex-1 min-w-0 text-foreground">
                  {userEntry.username}
                  <span className="text-[10px] text-muted-foreground ml-1">(you)</span>
                </span>
                <span className="font-bold tabular-nums shrink-0">
                  {formatFn(userEntry.score, userEntry)}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Self-contained mini-leaderboard for game end screens.
 *  Owns its own hook call and period toggle. Shows top 5 + user's rank. */
export function MiniLeaderboard({
  game,
  delay = 0,
  currentUser,
  accentBg,
}: {
  game: GameSlug;
  delay?: number;
  currentUser?: string;
  accentBg?: string;
}) {
  const [period, setPeriod] = useState<LeaderboardPeriod>("alltime");
  const { entries, loading } = useGameLeaderboard(game, period, 10, delay);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Trophy className="w-3 h-3" />
          Top Scores
        </div>
        <button
          onClick={() => setPeriod((p) => p === "alltime" ? "today" : "alltime")}
          className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded border border-border/40"
        >
          {period === "alltime" ? "All Time" : "Today"}
        </button>
      </div>
      <LeaderboardTable
        entries={entries}
        loading={loading}
        period={period}
        onPeriodChange={setPeriod}
        currentUser={currentUser}
        accentBg={accentBg}
        mini
        max={5}
      />
    </div>
  );
}
