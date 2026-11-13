import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Users, X, Plus, UserPlus, Check } from "lucide-react";
import { useUser, shareLink } from "@/lib/user-context";
import { shareText } from "@/lib/daily";
import { useFriends, useFriendsDay, type FriendScore } from "@/lib/friends";
import type { DailyGameSlug } from "@/lib/daily-score";

/** End screen: how your friends did on this game ("connor 780 · ghus 640"). */
export function FriendsOnEndScreen({ game, dateKey }: { game: DailyGameSlug; dateKey: string }) {
  const { user } = useUser();
  const { day } = useFriendsDay(user?.username, dateKey);
  const rows = day[game] ?? [];
  if (!rows.length) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
      className="mb-4 rounded-2xl border border-border bg-card px-3.5 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
        <Users className="w-3 h-3" /> Friends today
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {rows.slice(0, 6).map((r) => (
          <span key={r.username} className="text-sm text-foreground inline-flex items-center gap-1">
            <span>{r.avatar}</span>
            <span className="font-semibold truncate max-w-[110px]">{r.username}</span>
            <span className="font-black tabular-nums">{r.score.toLocaleString()}</span>
          </span>
        ))}
      </div>
    </motion.div>
  );
}

/** Tiny "🦊 connor 780" for a home tile footer: your best friend score on that game today. */
export function FriendBest({ best }: { best?: FriendScore }) {
  if (!best) return null;
  return (
    <span className="min-w-0 inline-flex items-center gap-1 text-[11px] font-semibold text-white/80" title={`${best.username}: ${best.score}`}>
      <span className="shrink-0">{best.avatar}</span>
      <span className="truncate max-w-[52px] sm:max-w-[90px]">{best.username}</span>
      <span className="shrink-0 font-black tabular-nums text-white">{best.score.toLocaleString()}</span>
    </span>
  );
}

/** Me: friends and invites in one place — add by username, send your invite link, see who joined through it. */
export function FriendsSection({ invitees, streak }: { invitees: string[]; streak: number }) {
  const { user } = useUser();
  const { list, add, remove } = useFriends(user?.username);
  const [copied, setCopied] = useState(false);
  const invite = async () => {
    const text = [
      "Four daily Premier League games on drapk.in. A new set every day.",
      streak > 1 ? `I'm on a ${streak}-day streak \uD83D\uDD25 come and play` : "Come and play",
      shareLink("/", "invite"),
    ].join("\n");
    if (await shareText(text)) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };
  // Invitees first, then everyone else you follow
  const shown = [...list].sort((a, b) => Number(invitees.includes(b)) - Number(invitees.includes(a)));
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Arriving from "Add friends" on an end screen: jump here and focus the box
  useEffect(() => {
    if (window.location.hash !== "#friends") return;
    const t = setTimeout(() => {
      document.getElementById("friends")?.scrollIntoView({ behavior: "smooth", block: "start" });
      inputRef.current?.focus({ preventScroll: true });
    }, 350);
    return () => clearTimeout(t);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const err = await add(name);
    setBusy(false);
    setMsg(err);
    if (!err) setName("");
  };

  return (
    <section id="friends" className="rounded-2xl border border-border bg-card p-4 mb-6 scroll-mt-24">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-black text-foreground flex items-center gap-1.5">
          <Users className="w-4 h-4 text-sky-300" /> Friends
          {list.length > 0 && <span className="text-xs font-semibold text-muted-foreground tabular-nums">{list.length}</span>}
        </h2>
        <button onClick={invite} className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3.5 py-1.5 text-xs font-black">
          {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><UserPlus className="w-3.5 h-3.5" /> Invite</>}
        </button>
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => { setName(e.target.value); setMsg(null); }}
          placeholder="Add by username"
          maxLength={16}
          autoCapitalize="none"
          autoCorrect="off"
          className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/30"
        />
        <button type="submit" disabled={busy || !name.trim()}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-sky-500 text-white px-3 py-2 text-sm font-black disabled:opacity-50">
          <Plus className="w-4 h-4" /> Add
        </button>
      </form>
      {msg && <p className="mt-2 text-xs text-amber-300">{msg}</p>}
      {list.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {shown.map((f) => (
            <span key={f} className={`inline-flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-1 text-xs font-semibold text-foreground ${
              invitees.includes(f) ? "bg-primary/10 border-primary/40" : "bg-white/5 border-border"}`}>
              {f}
              {invitees.includes(f) && <span className="text-[10px] font-bold text-primary">joined via you</span>}
              <button onClick={() => remove(f)} aria-label={`Remove ${f}`} className="w-5 h-5 rounded-full hover:bg-white/10 flex items-center justify-center text-muted-foreground">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {invitees.length > 0
          ? `${invitees.length} ${invitees.length === 1 ? "mate has" : "mates have"} joined from your invite link`
          : "Their scores show on your games and leaderboards. Anyone who joins through your invite link is added automatically."}
      </p>
    </section>
  );
}
