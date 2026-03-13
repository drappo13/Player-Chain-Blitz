import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Switch, Route } from "wouter";
import { UserProvider, useUser } from "@/lib/user-context";
import { UsernamePicker } from "@/components/username-picker";
import { UserBadge } from "@/components/user-badge";
import Home from "@/pages/home";
import Game from "@/pages/game";
import SlamChain from "@/pages/slam-chain";
import GridLock from "@/pages/grid-lock";
import TargetMan from "@/pages/target-man";
import Overlap from "@/pages/overlap";
import ClubLadder from "@/pages/club-ladder";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/goalchain" component={Game} />
      <Route path="/slamchain" component={SlamChain} />
      <Route path="/gridlock" component={GridLock} />
      <Route path="/targetman" component={TargetMan} />
      <Route path="/overlap" component={Overlap} />
      <Route path="/clubladder" component={ClubLadder} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user, loading } = useUser();

  if (loading) return null;

  return (
    <>
      {!user && <UsernamePicker />}
      <UserBadge />
      <Router />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UserProvider>
          <Toaster />
          <AppContent />
        </UserProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
