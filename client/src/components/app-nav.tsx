import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { CalendarCheck, Gamepad2, Trophy, UserRound, Flame } from "lucide-react";
import { useUser } from "@/lib/user-context";
import { DAILY_GAMES, useStreak } from "@/lib/daily";

export const HUB_ROUTES = ["/", "/arcade", "/leaderboard", "/me"];

const TABS = [
  { href: "/", label: "Today", icon: CalendarCheck },
  { href: "/arcade", label: "Arcade", icon: Gamepad2 },
  { href: "/leaderboard", label: "Leaders", icon: Trophy },
  { href: "/me", label: "Me", icon: UserRound },
];

function StreakChip({ streak, playedToday }: { streak: number; playedToday: boolean }) {
  return (
    <span
      title={playedToday ? `${streak}-day streak` : streak ? "Play today to keep your streak" : "Finish a daily game to start a streak"}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black tabular-nums border ${
        playedToday && streak
          ? "bg-gradient-to-r from-orange-500 to-amber-400 border-amber-300/50 text-white shadow-md shadow-orange-500/25"
          : "bg-white/5 border-border text-muted-foreground"
      }`}
    >
      <Flame className={`w-3.5 h-3.5 ${playedToday && streak ? "fill-yellow-100 text-yellow-100" : ""}`} />
      {streak}
    </span>
  );
}

function Wordmark() {
  return (
    <Link href="/" className="font-black tracking-tight text-lg text-foreground">
      drapk<span className="text-primary">.in</span>
    </Link>
  );
}

/** Site navigation for the hub pages: a top bar on desktop, a header + bottom tab bar on phones. */
export function AppNav() {
  const [location] = useLocation();
  const { user } = useUser();
  const { current, playedToday, day, entries, today } = useStreak(user?.username);
  const left = DAILY_GAMES.filter(
    (g) => day[g.slug]?.status !== "done" && !entries.some((e) => e.game === g.slug && e.dateKey === today),
  ).length;

  const userChip = user && (
    <Link href="/me" className="flex items-center gap-1.5 rounded-full bg-card border border-border pl-1.5 pr-2.5 py-1 hover:bg-muted transition-colors">
      <span className="text-base leading-none">{user.avatar}</span>
      <span className="text-xs font-semibold text-foreground max-w-[90px] truncate">{user.username}</span>
    </Link>
  );

  return (
    <>
      {/* Top bar: tabs inline on desktop, just the wordmark + user on phones */}
      <header className="fixed top-0 inset-x-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="max-w-5xl mx-auto h-12 md:h-16 px-4 flex items-center justify-between gap-4">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-1">
            {TABS.map((t) => {
              const active = location === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {active && <motion.span layoutId="nav-pill-desktop" className="absolute inset-0 rounded-full bg-white/10" />}
                  <t.icon className="w-4 h-4 relative" />
                  <span className="relative">{t.label}</span>
                  {t.href === "/" && left > 0 && user && (
                    <span className="relative ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-[10px] font-black text-primary-foreground flex items-center justify-center">{left}</span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            {user && (
              <Link href="/me" aria-label="Your stats">
                <StreakChip streak={current} playedToday={playedToday} />
              </Link>
            )}
            {userChip}
          </div>
        </div>
      </header>

      {/* Bottom tab bar on phones */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/90 backdrop-blur-md border-t border-border/60 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4 h-16">
          {TABS.map((t) => {
            const active = location === t.href;
            return (
              <Link key={t.href} href={t.href} className="relative flex flex-col items-center justify-center gap-1">
                {active && <motion.span layoutId="nav-pill-mobile" className="absolute top-0 h-0.5 w-10 rounded-full bg-primary" />}
                <span className="relative">
                  <t.icon className={`w-5 h-5 ${active ? "text-foreground" : "text-muted-foreground"}`} strokeWidth={active ? 2.5 : 2} />
                  {t.href === "/" && left > 0 && user && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-[9px] font-black text-primary-foreground flex items-center justify-center">{left}</span>
                  )}
                </span>
                <span className={`text-[10px] font-bold ${active ? "text-foreground" : "text-muted-foreground"}`}>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

/** Wrapper that leaves room for the nav bars. */
export function HubPage({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-background pt-[60px] md:pt-24 pb-24 md:pb-12 px-4 overflow-x-hidden">
      <div className={`${wide ? "max-w-5xl" : "max-w-3xl"} mx-auto`}>{children}</div>
    </div>
  );
}
