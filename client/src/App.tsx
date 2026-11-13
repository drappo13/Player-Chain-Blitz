import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Switch, Route, useLocation } from "wouter";
import { UserProvider, useUser } from "@/lib/user-context";
import { UsernamePicker } from "@/components/username-picker";
import { InstallSheet } from "@/components/install-sheet";
import { isStandalone } from "@/lib/install"; // also registers the install-prompt listener early
import { UserBadge } from "@/components/user-badge";
import { AppNav, HUB_ROUTES } from "@/components/app-nav";
import { lazy, Suspense, Component, useEffect, useRef, type ReactNode } from "react";
import { trackPageView, identify, trackEvent } from "@/lib/firebase";
import { DAILY_GAMES, useStreak, trackGameExit } from "@/lib/daily";
import type { DailyGameSlug } from "@/lib/daily-score";

// Lazy-load all pages — isolates crashes so one broken page can't kill the whole app
const Home = lazy(() => import("@/pages/home"));
const Game = lazy(() => import("@/pages/game"));
const SlamChain = lazy(() => import("@/pages/slam-chain"));
const GridLock = lazy(() => import("@/pages/grid-lock"));
const TargetMan = lazy(() => import("@/pages/target-man"));
const Overlap = lazy(() => import("@/pages/overlap"));
const ClubLadder = lazy(() => import("@/pages/club-ladder"));
const Griddle = lazy(() => import("@/pages/griddle"));
const CentreCircle = lazy(() => import("@/pages/centre-circle"));
const PhotoFinish = lazy(() => import("@/pages/photo-finish"));
const CareerPath = lazy(() => import("@/pages/career-path"));
const Leaderboard = lazy(() => import("@/pages/leaderboard"));
const Arcade = lazy(() => import("@/pages/arcade"));
const Me = lazy(() => import("@/pages/me"));
const Stats = lazy(() => import("@/pages/stats"));
const ArsenalChampions = lazy(() => import("@/pages/arsenal-champions"));
const NotFound = lazy(() => import("@/pages/not-found"));

// Error boundary — catches crashes and shows refresh button instead of blank screen
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#e5e5e5",
          fontFamily: "system-ui, sans-serif",
          padding: "1rem",
          textAlign: "center",
        }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#a3a3a3", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
            This usually fixes itself with a refresh.
          </p>
          <button
            onClick={() => {
              // Clear any cached state that might cause the crash
              sessionStorage.clear();
              // Force reload bypassing cache
              window.location.href = window.location.pathname + "?cb=" + Date.now();
            }}
            style={{
              padding: "0.75rem 2rem",
              borderRadius: "0.5rem",
              border: "1px solid #3b82f6",
              background: "#3b82f6",
              color: "white",
              fontWeight: 600,
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function Loading() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0a0a0a",
    }}>
      <div style={{
        width: "1.5rem",
        height: "1.5rem",
        border: "2px solid #333",
        borderTop: "2px solid #3b82f6",
        borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<Loading />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/goalchain" component={Game} />
        <Route path="/slamchain" component={SlamChain} />
        <Route path="/gridlock" component={GridLock} />
        <Route path="/targetman" component={TargetMan} />
        <Route path="/overlap" component={Overlap} />
        <Route path="/clubladder" component={ClubLadder} />
        <Route path="/griddle" component={Griddle} />
        <Route path="/centrecircle" component={CentreCircle} />
        <Route path="/photofinish" component={PhotoFinish} />
        <Route path="/careerpath" component={CareerPath} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/arcade" component={Arcade} />
        <Route path="/me" component={Me} />
        <Route path="/stats" component={Stats} />
        <Route path="/arsenal-pl-champions-2026" component={ArsenalChampions} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// A title per page, so the tab and analytics can tell the games apart
const PAGE_TITLES: Record<string, string> = {
  "/": "Today", "/arcade": "Arcade", "/leaderboard": "Leaderboards", "/me": "Me",
  "/careerpath": "Career Path", "/photofinish": "Photo Finish", "/centrecircle": "CentreCircle", "/griddle": "Griddle",
  "/targetman": "TargetMan", "/overlap": "Overlap", "/clubladder": "Ladder Up", "/goalchain": "GoalChain",
  "/slamchain": "Slam16", "/gridlock": "GridLock", "/arsenal-pl-champions-2026": "Champions Quiz", "/stats": "Stats",
};
const DEFAULT_TITLE = "drapk.in · Daily Premier League games";
const GAME_AT = Object.fromEntries(DAILY_GAMES.map((g) => [g.href, g.slug])) as Record<string, DailyGameSlug>;

/** Logs game_exit when someone leaves a daily game unfinished: moving to another page,
 *  or the tab/app being hidden (closing it, switching apps). */
function GameExitTracker({ location }: { location: string }) {
  const { user } = useUser();
  const prev = useRef(location);
  useEffect(() => {
    const was = GAME_AT[prev.current];
    if (was && prev.current !== location) trackGameExit(user?.username, was, "navigate");
    prev.current = location;
  }, [location, user?.username]);
  useEffect(() => {
    const onHide = () => {
      const game = GAME_AT[prev.current];
      if (game && document.visibilityState === "hidden") trackGameExit(user?.username, game, "hidden");
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [user?.username]);
  return null;
}

/** Keeps analytics tied to the signed-in account, tagged with its retention stats so any
 *  report can be split by streak, days played or how they joined. */
function AnalyticsIdentity() {
  const { user, isGuest } = useUser();
  const { current, best, daysPlayed, view } = useStreak(user?.username);
  const doneToday = DAILY_GAMES.filter((g) => view[g.slug]?.status === "done").length;
  useEffect(() => {
    if (!user) { identify(null); return; }
    identify(isGuest ? null : user.username.toLowerCase(), {
      account: isGuest ? "guest" : "named",
      current_streak: current,
      best_streak: best,
      days_played: daysPlayed,
      days_played_band: daysPlayed >= 30 ? "30+" : daysPlayed >= 7 ? "7-29" : daysPlayed >= 2 ? "2-6" : daysPlayed === 1 ? "1" : "0",
      daily_done_today: doneToday,
      display_mode: isStandalone() ? "home_screen" : "browser",
    });
  }, [user?.username, isGuest, current, best, daysPlayed, doneToday]);
  return null;
}

// Opened from a reminder notification (?src=push_streak / push_morning)
if (typeof window !== "undefined") {
  const src = new URLSearchParams(window.location.search).get("src");
  if (src?.startsWith("push")) trackEvent("push_open", { kind: src.replace("push_", "") });
}

/** The optional pick-a-name sheet (guests), and a log-in prompt the first time the iPhone
 *  home-screen app opens (it doesn't share Safari's storage, so the name isn't there yet). */
function ClaimSheet() {
  const { isGuest, claimSource, openClaim, closeClaim } = useUser();
  useEffect(() => {
    if (!isGuest || !isStandalone()) return;
    try {
      if (localStorage.getItem("pcb-standalone-asked")) return;
      localStorage.setItem("pcb-standalone-asked", "1");
    } catch { return; }
    openClaim("standalone_first");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest]);
  if (!isGuest || !claimSource) return null;
  if (claimSource === "standalone_first") {
    return <UsernamePicker initialMode="login" onClose={closeClaim} loginSubtitle="Log in with your name to bring your streak over" closeLabel="New here? Play as a guest" />;
  }
  return (
    <UsernamePicker
      onClose={closeClaim}
      signupTitle="Pick a name"
      signupSubtitle="Get on the leaderboards and keep your streak on any device. Your games so far come with you."
    />
  );
}

function AppContent() {
  const { user, loading } = useUser();
  const [location] = useLocation();

  // Fire a Firebase Analytics page_view on every wouter route change. No-ops
  // if Analytics isn't configured (no measurementId in firebase.ts).
  useEffect(() => {
    const name = PAGE_TITLES[location];
    document.title = name ? `${name} · drapk.in` : DEFAULT_TITLE;
    trackPageView(location);
  }, [location]);

  if (loading) return null;

  const isHub = HUB_ROUTES.includes(location);

  return (
    <>
      <AnalyticsIdentity />
      <GameExitTracker location={location} />
      <ClaimSheet />
      <InstallSheet />
      {isHub ? <AppNav /> : <UserBadge />}
      <Router />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <UserProvider>
            <Toaster />
            <AppContent />
          </UserProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
