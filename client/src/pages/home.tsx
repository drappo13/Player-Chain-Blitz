import { Link } from "wouter";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex items-start pt-12 sm:items-center sm:pt-0 justify-center p-4 relative overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-chart-2/6 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-3xl w-full relative z-10"
      >
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl sm:text-4xl font-black text-foreground mb-2 tracking-tight"
          data-testid="text-app-title"
        >
          Pick Your Game
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-sm text-muted-foreground mb-6 sm:mb-10"
        >
          Test your sports knowledge
        </motion.p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Link href="/goalchain" data-testid="link-goalchain">
              <div className="group cursor-pointer rounded-md border border-border/60 bg-card p-4 sm:p-6 text-left hover-elevate transition-all duration-200">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mb-3 sm:mb-4">
                  <span className="text-xl sm:text-2xl">⚽</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1.5">
                  Goal
                  <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
                    Chain
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                  Chain Premier League scorers by the last letter of their surname. Score = total goals.
                </p>
                <div className="flex items-center gap-1 text-xs font-medium text-primary">
                  Play
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Link href="/slamchain" data-testid="link-slamchain">
              <div className="group cursor-pointer rounded-md border border-border/60 bg-card p-4 sm:p-6 text-left hover-elevate transition-all duration-200">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center mb-3 sm:mb-4">
                  <span className="text-xl sm:text-2xl">🎾</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1.5">
                  Slam
                  <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    16
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                  Name players from Grand Slam tournaments. One wrong answer ends the game.
                </p>
                <div className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                  Play
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Link href="/gridlock" data-testid="link-gridlock">
              <div className="group cursor-pointer rounded-md border border-border/60 bg-card p-4 sm:p-6 text-left hover-elevate transition-all duration-200">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md bg-gradient-to-br from-red-500/20 to-red-500/5 border border-red-500/20 flex items-center justify-center mb-3 sm:mb-4">
                  <span className="text-xl sm:text-2xl">🏎️</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1.5">
                  Grid
                  <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                    Lock
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3 sm:mb-4">
                  Name F1 drivers who scored points each season. Score = championship points.
                </p>
                <div className="flex items-center gap-1 text-xs font-medium text-red-400">
                  Play
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
