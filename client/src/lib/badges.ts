import {
  Flag, LayoutGrid, Ticket, Flame, CalendarCheck, Infinity as InfinityIcon, Shirt, Shield, Shuffle, Search,
  Gem, Eye, Camera, BookOpen, Library, Grid3x3, Sunrise, Moon, Gamepad2, UserPlus, type LucideIcon,
} from "lucide-react";
import type { DailyEntry } from "./daily";

// Badges are worked out from what's already stored (daily history, streaks, arcade plays,
// invites) — nothing extra is saved, so they apply retroactively.

export interface BadgeContext {
  entries: DailyEntry[];
  bestStreak: number;
  daysPlayed: number;
  fullSets: number;
  arcadePlays: number;
  invites: number;
}

export interface Badge {
  id: string;
  name: string;
  how: string;
  icon: LucideIcon;
  colour: string; // gradient for the unlocked medal
  unit?: string; // shown after progress numbers, e.g. "%"
  /** [current, target]; unlocked when current >= target */
  progress: (c: BadgeContext) => [number, number];
}

const best = (c: BadgeContext, game: DailyEntry["game"], f: (e: DailyEntry) => number) =>
  Math.max(0, ...c.entries.filter((e) => e.game === game).map(f));
const anyAt = (c: BadgeContext, test: (h: number) => boolean) =>
  c.entries.some((e) => e.at != null && test(new Date(e.at).getHours())) ? 1 : 0;

const STREAK = "from-orange-500 to-amber-400";
const GOLD = "from-amber-400 to-yellow-200";
const STEEL = "from-slate-400 to-slate-200";
const VIOLET = "from-violet-500 to-fuchsia-400";
const AMBER = "from-amber-500 to-orange-300";
const GREEN = "from-emerald-500 to-teal-300";
const SKY = "from-sky-500 to-cyan-300";
const PINK = "from-pink-500 to-rose-300";

export const BADGES: Badge[] = [
  { id: "kickoff", name: "Kick-off", how: "Finish your first daily game", icon: Flag, colour: STEEL,
    progress: (c) => [Math.min(1, c.entries.length), 1] },
  { id: "fullhouse", name: "Full House", how: "Finish all four daily games in one day", icon: LayoutGrid, colour: GOLD,
    progress: (c) => [Math.min(1, c.fullSets), 1] },
  { id: "seasonticket", name: "Season Ticket", how: "Finish all four on 5 different days", icon: Ticket, colour: GOLD,
    progress: (c) => [c.fullSets, 5] },
  { id: "hattrick", name: "Hat-trick", how: "Play three days in a row", icon: Flame, colour: STREAK,
    progress: (c) => [c.bestStreak, 3] },
  { id: "weekin", name: "Week In, Week Out", how: "Play seven days in a row", icon: CalendarCheck, colour: STREAK,
    progress: (c) => [c.bestStreak, 7] },
  { id: "everpresent", name: "Ever-present", how: "Play 30 days in a row", icon: InfinityIcon, colour: STREAK,
    progress: (c) => [c.bestStreak, 30] },
  { id: "squad", name: "Squad Player", how: "Play on 10 different days", icon: Shirt, colour: STEEL,
    progress: (c) => [c.daysPlayed, 10] },
  { id: "servant", name: "Club Servant", how: "Play on 50 different days", icon: Shield, colour: STEEL,
    progress: (c) => [c.daysPlayed, 50] },
  { id: "utility", name: "Utility Player", how: "Finish each of the four daily games at least once", icon: Shuffle, colour: PINK,
    progress: (c) => [new Set(c.entries.map((e) => e.game)).size, 4] },
  { id: "scout", name: "Scout", how: "Name all five players in a Career Path", icon: Search, colour: VIOLET,
    progress: (c) => [best(c, "careerpath", (e) => e.found ?? 0), 5] },
  { id: "perfect", name: "Perfect 100", how: "Score 100 in Career Path", icon: Gem, colour: VIOLET,
    progress: (c) => [best(c, "careerpath", (e) => e.score), 100] },
  { id: "eagle", name: "Eagle Eye", how: "Score 800+ in Photo Finish", icon: Eye, colour: AMBER,
    progress: (c) => [best(c, "photofinish", (e) => e.score), 800] },
  { id: "photographic", name: "Photographic Memory", how: "Get 5 photos spot on in one Photo Finish", icon: Camera, colour: AMBER,
    progress: (c) => [best(c, "photofinish", (e) => e.found ?? 0), 5] },
  { id: "wordsmith", name: "Wordsmith", how: "Find 30 names in one CentreCircle", icon: BookOpen, colour: GREEN,
    progress: (c) => [best(c, "centrecircle", (e) => e.found ?? 0), 30] },
  { id: "encyclopaedic", name: "Encyclopaedic", how: "Find half of a CentreCircle board", icon: Library, colour: GREEN, unit: "%",
    progress: (c) => [Math.round(best(c, "centrecircle", (e) => (e.total ? (e.found ?? 0) / e.total : 0)) * 100), 50] },
  { id: "joined", name: "Joined-up Thinking", how: "Find 25 players in one Griddle", icon: Grid3x3, colour: SKY,
    progress: (c) => [best(c, "griddle", (e) => e.found ?? 0), 25] },
  { id: "early", name: "Early Kick-off", how: "Finish a daily game before 8am", icon: Sunrise, colour: AMBER,
    progress: (c) => [anyAt(c, (h) => h < 8), 1] },
  { id: "late", name: "Late Kick-off", how: "Finish a daily game after 11pm", icon: Moon, colour: SKY,
    progress: (c) => [anyAt(c, (h) => h >= 23), 1] },
  { id: "arcade", name: "Arcade Regular", how: "Play 25 arcade games", icon: Gamepad2, colour: PINK,
    progress: (c) => [c.arcadePlays, 25] },
  { id: "recruiter", name: "Recruiter", how: "Get a mate to sign up with your invite link", icon: UserPlus, colour: GOLD,
    progress: (c) => [c.invites, 1] },
];

export const isUnlocked = (b: Badge, c: BadgeContext) => {
  const [cur, target] = b.progress(c);
  return cur >= target;
};
