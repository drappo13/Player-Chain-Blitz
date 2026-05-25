import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Switch, Route, useLocation } from "wouter";
import { UserProvider, useUser } from "@/lib/user-context";
import { UsernamePicker } from "@/components/username-picker";
import { UserBadge } from "@/components/user-badge";
import { lazy, Suspense, Component, type ReactNode } from "react";

// Lazy-load all pages — isolates crashes so one broken page can't kill the whole app
const Home = lazy(() => import("@/pages/home"));
const Game = lazy(() => import("@/pages/game"));
const SlamChain = lazy(() => import("@/pages/slam-chain"));
const GridLock = lazy(() => import("@/pages/grid-lock"));
const TargetMan = lazy(() => import("@/pages/target-man"));
const Overlap = lazy(() => import("@/pages/overlap"));
const ClubLadder = lazy(() => import("@/pages/club-ladder"));
const Griddle = lazy(() => import("@/pages/griddle"));
const Leaderboard = lazy(() => import("@/pages/leaderboard"));
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
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/arsenal-pl-champions-2026" component={ArsenalChampions} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// Routes where anonymous play is allowed — UsernamePicker is opt-in instead of forced.
const ANON_ALLOWED_ROUTES = ["/arsenal-pl-champions-2026"];

function AppContent() {
  const { user, loading } = useUser();
  const [location] = useLocation();

  if (loading) return null;

  const allowAnonymous = ANON_ALLOWED_ROUTES.includes(location);

  return (
    <>
      {!user && !allowAnonymous && <UsernamePicker />}
      <UserBadge />
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
