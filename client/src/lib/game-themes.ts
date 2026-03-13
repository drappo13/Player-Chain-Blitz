/**
 * Game theme definitions.
 *
 * Each game picks a theme which provides consistent color classes for
 * buttons, accents, focus rings, input borders, timer colors, etc.
 *
 * To add a new game theme:
 *   1. Add a new entry to `gameThemes`
 *   2. Import it in your game page: `import { gameThemes } from "@/lib/game-themes"`
 *   3. Use `const theme = gameThemes.yourGame` and reference `theme.primaryBtn`, etc.
 */

export interface GameTheme {
  /** Primary action button (Start Game, Play Again) */
  primaryBtn: string;
  /** Outline button (Home on end screen) */
  outlineBtn: string;
  /** Input focus border + shadow */
  inputFocus: string;
  /** Timer bar color (normal state) */
  timerBar: string;
  /** Timer icon background + color (normal state) */
  timerIcon: string;
  timerIconColor: string;
  /** Accent color for scores, highlights, links */
  accent: string;
  /** Background glow blobs */
  glowA: string;
  glowB: string;
}

export const gameThemes = {
  /** GoalChain + SlamChain: emerald/primary */
  emerald: {
    primaryBtn: "shadow-xl shadow-primary/20",
    outlineBtn: "font-bold",
    inputFocus: "focus:border-primary/60 focus:shadow-lg focus:shadow-primary/10",
    timerBar: "bg-primary",
    timerIcon: "bg-primary/15",
    timerIconColor: "text-primary",
    accent: "text-primary",
    glowA: "bg-primary/5",
    glowB: "bg-chart-2/5",
  },

  /** GridLock + TargetMan: orange/amber warm tones */
  warm: {
    primaryBtn: "shadow-xl shadow-orange-500/20 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-orange-600 focus-visible:ring-orange-500",
    outlineBtn: "font-bold border-border focus-visible:ring-orange-500",
    inputFocus: "focus:border-orange-500/60 focus:shadow-lg focus:shadow-orange-500/10",
    timerBar: "bg-orange-500",
    timerIcon: "bg-orange-500/15",
    timerIconColor: "text-orange-400",
    accent: "text-orange-400",
    glowA: "bg-orange-500/5",
    glowB: "bg-amber-500/5",
  },

  /** GridLock specific: red/orange racing tones */
  racing: {
    primaryBtn: "shadow-xl shadow-red-500/20 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white border-red-600 focus-visible:ring-orange-500",
    outlineBtn: "font-bold border-border focus-visible:ring-orange-500",
    inputFocus: "focus:border-red-500/60 focus:shadow-lg focus:shadow-red-500/10",
    timerBar: "bg-red-500",
    timerIcon: "bg-red-500/15",
    timerIconColor: "text-red-400",
    accent: "text-red-400",
    glowA: "bg-red-500/5",
    glowB: "bg-orange-500/5",
  },
  /** Overlap: blue/cyan tones */
  overlap: {
    primaryBtn: "shadow-xl shadow-blue-500/20 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-blue-600 focus-visible:ring-blue-500",
    outlineBtn: "font-bold border-border focus-visible:ring-blue-500",
    inputFocus: "focus:border-blue-500/60 focus:shadow-lg focus:shadow-blue-500/10",
    timerBar: "bg-blue-500",
    timerIcon: "bg-blue-500/15",
    timerIconColor: "text-blue-400",
    accent: "text-blue-400",
    glowA: "bg-blue-500/5",
    glowB: "bg-cyan-500/5",
  },
  /** LadderUp: purple/indigo tones */
  ladder: {
    primaryBtn: "shadow-xl shadow-purple-500/20 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white border-purple-600 focus-visible:ring-purple-500",
    outlineBtn: "font-bold border-border focus-visible:ring-purple-500",
    inputFocus: "focus:border-purple-500/60 focus:shadow-lg focus:shadow-purple-500/10",
    timerBar: "bg-purple-500",
    timerIcon: "bg-purple-500/15",
    timerIconColor: "text-purple-400",
    accent: "text-purple-400",
    glowA: "bg-purple-500/5",
    glowB: "bg-indigo-500/5",
  },
} as const satisfies Record<string, GameTheme>;
