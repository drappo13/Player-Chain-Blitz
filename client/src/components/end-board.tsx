import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Trophy, UserPlus } from "lucide-react";
import { useUser } from "@/lib/user-context";
import { useDailyLeaderboard } from "@/lib/use-daily-leaderboard";
import { useFriendsDay } from "@/lib/friends";
import { shiftDay, todayKey, useDayProgress } from "@/lib/daily";
import { trackEvent } from "@/lib/firebase";
import { LeaderboardTable } from "@/components/leaderboard-table";
import type { DailyGameSlug } from "@/lib/daily-score";

/** End-screen leaderboard: Friends (you + the people you follow) or Everyone. Defaults to Friends
 *  when you have some. Shows the board for the day you played (yesterday's set → yesterday's board). */
export function EndBoard({ game, dateKey, accentBg }: { game: DailyGameSlug; dateKey: string; accentBg: string }) {
  const [, navigate] = useLocation();
  const { user, isGuest, openClaim } = useUser();
  const period = dateKey === shiftDay(todayKey(), -1) ? "yesterday" : "today";
  const { entries, loading } = useDailyLeaderboard(game, period, 10, 1000);
  const { friends, day } = useFriendsDay(user?.username, dateKey, true);
  const mine = useDayProgress(user?.username, dateKey)[game];
  const [tab, setTab] = useState<"friends" | "everyone" | null>(null);
  const shown = tab ?? (friends.length > 0 ? "friends" : "everyone");

  // Friends board: everyone you follow who played, plus you (from this device if your score isn't saved yet)
  const me = user?.username.toLowerCase();
  const rows = (day[game] ?? []).map((r) => ({ username: r.username, avatar: r.avatar, score: r.score }));
  if (me && mine && !rows.some((r) => r.username === me)) rows.push({ username: me, avatar: user!.avatar, score: mine.score });
  rows.sort((a, b) => b.score - a.score);

  const pick = (t: "friends" | "everyone") => { setTab(t); trackEvent("end_board_tab", { game, tab: t, friends: friends.length }); };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="w-full mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Trophy className="w-3 h-3" />{period === "yesterday" ? "Yesterday's board" : "Leaderboard"}
        </div>
        <div className="flex rounded-full bg-white/5 p-0.5 text-[11px] font-bold">
          {(["friends", "everyone"] as const).map((t) => (
            <button key={t} onClick={() => pick(t)}
              className={`rounded-full px-2.5 py-1 transition-colors ${shown === t ? "bg-foreground/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t === "friends" ? "Friends" : "Everyone"}
            </button>
          ))}
        </div>
      </div>

      {shown === "everyone" ? (
        <LeaderboardTable entries={entries} loading={loading} period="today" onPeriodChange={() => {}}
          currentUser={user?.username} accentBg={accentBg} scoreLabel="Score" mini max={10} />
      ) : friends.length > 0 ? (
        <LeaderboardTable entries={rows} loading={false} period="today" onPeriodChange={() => {}}
          currentUser={user?.username} accentBg={accentBg} scoreLabel="Score" mini max={20} />
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-5 text-center">
          <p className="text-sm font-bold text-foreground">Add friends to see their scores here</p>
          <p className="text-xs text-muted-foreground mt-1">Follow anyone by their username, or invite a mate</p>
          <button
            onClick={() => {
              trackEvent("end_board_add_friends", { game, guest: isGuest });
              if (isGuest) openClaim("end_board_friends"); else navigate("/me#friends");
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sky-500 text-white px-4 py-2 text-xs font-black">
            <UserPlus className="w-3.5 h-3.5" /> {isGuest ? "Pick a name to add friends" : "Add friends"}
          </button>
        </div>
      )}
    </motion.div>
  );
}
