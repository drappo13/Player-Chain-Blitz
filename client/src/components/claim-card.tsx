import { useEffect } from "react";
import { UserPlus } from "lucide-react";
import { useUser } from "@/lib/user-context";
import { todayKey } from "@/lib/daily";
import { askedThisVisit, askRecord, noteAsk } from "@/lib/asks";
import { trackEvent } from "@/lib/firebase";

/** On a guest's end screen: put this score on the leaderboard by picking a name.
 *  The pick-a-name sheet also opens by itself at the first finish and once on a later day, then never again. */
export function ClaimCard({ game, score }: { game: string; score?: number }) {
  const { openClaim } = useUser();
  useEffect(() => {
    const today = todayKey();
    const r = askRecord("claim");
    const due = r.count === 0 || (r.count === 1 && r.lastDay !== today);
    if (!due || askedThisVisit()) return;
    const t = setTimeout(() => { noteAsk("claim", today); openClaim("end_screen_auto"); }, 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mb-4 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card p-3.5 flex items-center gap-3">
      <span className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
        <UserPlus className="w-5 h-5" />
      </span>
      <p className="flex-1 min-w-0 text-sm font-bold text-foreground leading-snug">
        {score != null && score > 0 ? <>Pick a name to put <span className="tabular-nums">{score.toLocaleString()}</span> on the leaderboard</> : "Pick a name to get on the leaderboards"}
      </p>
      <button
        onClick={() => { trackEvent("claim_prompt_click", { source: "end_screen", game }); openClaim("end_screen"); }}
        className="shrink-0 rounded-full bg-primary text-primary-foreground px-3.5 py-2 text-xs font-black"
      >
        Pick a name
      </button>
    </div>
  );
}
