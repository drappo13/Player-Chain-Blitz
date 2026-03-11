import { Link } from "wouter";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

interface GameCard {
  href: string;
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
    href: "/goalchain",
    testId: "link-goalchain",
    emoji: "⚽",
    iconGradient: "from-primary/20 to-primary/5",
    iconBorder: "border-primary/20",
    title: ["Goal", "Chain"],
    titleGradient: "from-primary to-emerald-400",
    description: "Chain PL scorers by the last letter of their surname. Score = total goals.",
    playColor: "text-primary",
  },
  {
    href: "/targetman",
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
    testId: "link-overlap",
    emoji: "🔗",
    iconGradient: "from-blue-500/20 to-blue-500/5",
    iconBorder: "border-blue-500/20",
    title: ["Over", "lap"],
    titleGradient: "from-blue-400 to-cyan-400",
    description: "Name a player who appeared for both clubs. Obscure overlaps score big.",
    playColor: "text-blue-400",
  },
];

const tennisGames: GameCard[] = [
  {
    href: "/slamchain",
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

function GameCardComponent({ game, delay }: { game: GameCard; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="h-full"
    >
      <Link href={game.href} data-testid={game.testId}>
        <div className="group cursor-pointer rounded-md border border-border/60 bg-card p-4 sm:p-6 text-left hover-elevate transition-all duration-200 h-full flex flex-col">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-md bg-gradient-to-br ${game.iconGradient} border ${game.iconBorder} flex items-center justify-center mb-3 sm:mb-4`}>
            <span className="text-xl sm:text-2xl">{game.emoji}</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1.5">
            {game.title[0]}
            <span className={`bg-gradient-to-r ${game.titleGradient} bg-clip-text text-transparent`}>
              {game.title[1]}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3 sm:mb-4 flex-1">
            {game.description}
          </p>
          <div className={`flex items-center gap-1 text-xs font-medium ${game.playColor}`}>
            Play
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function GameSection({
  label,
  emoji,
  games,
  baseDelay,
}: {
  label: string;
  emoji: string;
  games: GameCard[];
  baseDelay: number;
}) {
  return (
    <div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: baseDelay - 0.05 }}
        className="flex items-center gap-2 mb-3"
      >
        <span className="text-sm">{emoji}</span>
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          {label}
        </span>
      </motion.div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {games.map((game, i) => (
          <GameCardComponent key={game.href} game={game} delay={baseDelay + i * 0.08} />
        ))}
      </div>
    </div>
  );
}

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
        className="text-center max-w-4xl w-full relative z-10"
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

        <div className="space-y-6 sm:space-y-8 text-left">
          <GameSection label="Football" emoji="⚽" games={footballGames} baseDelay={0.3} />
          <GameSection label="Tennis" emoji="🎾" games={tennisGames} baseDelay={0.55} />
          <GameSection label="Formula 1" emoji="🏎️" games={f1Games} baseDelay={0.65} />
        </div>
      </motion.div>
    </div>
  );
}
