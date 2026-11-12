import { Link } from "wouter";
import { motion } from "framer-motion";
import { ChevronRight, Trophy, Ticket } from "lucide-react";
import { useUser } from "@/lib/user-context";
import { useUserStats, type GameStats } from "@/lib/use-user-stats";
import type { GameSlug } from "@/lib/save-score";
import { HubPage } from "@/components/app-nav";

interface GameCard {
  href: string;
  slug: GameSlug;
  testId: string;
  emoji: string;
  iconGradient: string;
  iconBorder: string;
  title: [string, string]; // [plain, gradient]
  titleGradient: string;
  description: string;
  playColor: string;
}

const footballGames: GameCard[] = [
  {
    href: "/targetman",
    slug: "targetman",
    testId: "link-targetman",
    emoji: "🎯",
    iconGradient: "from-orange-500/20 to-orange-500/5",
    iconBorder: "border-orange-500/20",
    title: ["Target", "Man"],
    titleGradient: "from-orange-400 to-amber-400",
    description: "Match the target goal number. Combos, boosts & precision scoring.",
    playColor: "text-orange-400",
  },
  {
    href: "/overlap",
    slug: "overlap",
    testId: "link-overlap",
    emoji: "🔗",
    iconGradient: "from-blue-500/20 to-blue-500/5",
    iconBorder: "border-blue-500/20",
    title: ["Over", "lap"],
    titleGradient: "from-blue-400 to-cyan-400",
    description: "Name a player who appeared for both clubs. Obscure overlaps score big.",
    playColor: "text-blue-400",
  },
  {
    href: "/clubladder",
    slug: "clubladder",
    testId: "link-clubladder",
    emoji: "📈",
    iconGradient: "from-purple-500/20 to-purple-500/5",
    iconBorder: "border-purple-500/20",
    title: ["Ladder", "Up"],
    titleGradient: "from-purple-400 to-indigo-400",
    description: "Climb the goal threshold. 3 clubs, multipliers, 1 shield. How high can you go?",
    playColor: "text-purple-400",
  },
  {
    href: "/goalchain",
    slug: "goalchain",
    testId: "link-goalchain",
    emoji: "⚽",
    iconGradient: "from-primary/20 to-primary/5",
    iconBorder: "border-primary/20",
    title: ["Goal", "Chain"],
    titleGradient: "from-primary to-emerald-400",
    description: "Chain PL scorers by the last letter of their surname. Score = total goals.",
    playColor: "text-primary",
  },
];

const tennisGames: GameCard[] = [
  {
    href: "/slamchain",
    slug: "slamchain",
    testId: "link-slamchain",
    emoji: "🎾",
    iconGradient: "from-emerald-500/20 to-emerald-500/5",
    iconBorder: "border-emerald-500/20",
    title: ["Slam", "16"],
    titleGradient: "from-emerald-400 to-teal-400",
    description: "Name players from Grand Slam tournaments. One wrong answer ends the game.",
    playColor: "text-emerald-400",
  },
];

const f1Games: GameCard[] = [
  {
    href: "/gridlock",
    slug: "gridlock",
    testId: "link-gridlock",
    emoji: "🏎️",
    iconGradient: "from-red-500/20 to-red-500/5",
    iconBorder: "border-red-500/20",
    title: ["Grid", "Lock"],
    titleGradient: "from-red-500 to-orange-500",
    description: "Name F1 drivers who scored points each season. Score = championship points.",
    playColor: "text-red-400",
  },
];

function GameCardComponent({ game, delay, gameStats: rawStats }: { game: GameCard; delay: number; gameStats: GameStats }) {
  const gameStats = rawStats || { highScore: 0, plays: 0 };
  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="h-full">
      <Link href={game.href} data-testid={game.testId}>
        <div className="group cursor-pointer rounded-2xl border border-border/60 bg-card p-4 sm:p-5 text-left hover-elevate transition-all duration-200 h-full flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${game.iconGradient} border ${game.iconBorder} flex items-center justify-center`}>
              <span className="text-xl sm:text-2xl">{game.emoji}</span>
            </div>
            <div className="h-5 flex items-center">
              {gameStats.plays > 0 ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Ticket className="w-3 h-3" />
                    <span className="text-[10px] font-medium">{gameStats.plays}</span>
                  </div>
                  <div className="flex items-center gap-1 text-amber-400">
                    <Trophy className="w-3 h-3" />
                    <span className="text-[10px] font-bold">{gameStats.highScore.toLocaleString()}</span>
                  </div>
                </div>
              ) : (
                <span className="text-[10px] font-medium text-muted-foreground/60 px-2 py-0.5 rounded-full border border-border/60">New</span>
              )}
            </div>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1.5">
            {game.title[0]}
            <span className={`bg-gradient-to-r ${game.titleGradient} bg-clip-text text-transparent`}>{game.title[1]}</span>
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3 flex-1">{game.description}</p>
          <div className={`flex items-center gap-1 text-xs font-medium ${game.playColor}`}>
            Play
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function GameSection({ label, emoji, games, baseDelay, allStats, single = false }: {
  single?: boolean;
  label: string;
  emoji: string;
  games: GameCard[];
  baseDelay: number;
  allStats: Record<GameSlug, GameStats>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">{emoji}</span>
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
      </div>
      <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${single ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {games.map((game, i) => (
          <GameCardComponent key={game.href} game={game} delay={baseDelay + i * 0.06} gameStats={allStats[game.slug]} />
        ))}
      </div>
    </div>
  );
}

export default function Arcade() {
  const { user } = useUser();
  const { stats } = useUserStats(user?.username);

  return (
    <HubPage wide>
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Arcade</h1>
        <p className="text-sm text-muted-foreground">Quick-fire games. Play as often as you like and chase your high score.</p>
      </div>

      <div className="space-y-6 sm:space-y-8">
        <GameSection label="Football" emoji="⚽" games={footballGames} baseDelay={0.05} allStats={stats} />

        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">🏆</span>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Specials</span>
          </div>
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Link href="/arsenal-pl-champions-2026" data-testid="link-arsenal-champions">
              <div className="group cursor-pointer rounded-2xl border border-red-700/40 bg-gradient-to-br from-red-950/60 via-[#1a0a0a] to-[#0a0a0f] p-4 sm:p-5 text-left hover-elevate transition-all duration-200 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600/30 to-amber-500/10 border border-red-600/30 flex items-center justify-center shrink-0">
                  <span className="text-2xl">🏆</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-foreground">
                    <span className="text-red-500">Champions</span>
                    <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent"> Quiz</span>
                  </h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">Relive Arsenal's title-winning journey. 10 rounds, 100 questions.</p>
                </div>
                <ChevronRight className="w-5 h-5 text-amber-400 shrink-0" />
              </div>
            </Link>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-4">
          <GameSection label="Tennis" emoji="🎾" games={tennisGames} baseDelay={0.35} allStats={stats} single />
          <GameSection label="Formula 1" emoji="🏎️" games={f1Games} baseDelay={0.4} allStats={stats} single />
        </div>
      </div>
    </HubPage>
  );
}
