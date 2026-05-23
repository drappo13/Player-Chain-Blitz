# Refactoring Plan

## Executive Summary

The codebase contains 6 game pages (game.tsx, slam-chain.tsx, target-man.tsx, grid-lock.tsx, overlap.tsx, club-ladder.tsx), each implemented as self-contained ~700-1100 line files. This "monolith per game" approach was intentional and documented in CLAUDE.md, but has led to significant code duplication across games. The most impactful refactoring opportunities are:

1. **Name normalization and player lookup** -- identical `normalizeName()` copied 6 times, `buildPlayerLookup()` copied 4 times with minor variations
2. **End screen UI pattern** -- near-identical button layouts, share logic, GoatCounter tracking, and score saving repeated 6 times
3. **Start screen UI pattern** -- same structural skeleton (home button, icon, title, rules list, high score badge, start button) repeated 6 times
4. **Timer management** -- interval-based countdown with tick sounds, urgent/warning states, cleanup logic repeated 6 times
5. **Screen flash overlays** -- identical correct/wrong AnimatePresence flash overlays copied into every game
6. **PLPlayer type** -- defined identically in overlap.tsx and club-ladder.tsx (should come from data layer)

Estimated total duplicated code: ~2,500+ lines across the 6 game files.

---

## 1. Name Normalization & Player Lookup

### Priority: HIGH

### What's Duplicated

The `normalizeName()` function is **identical** across all 6 game files:

| File | Lines |
|------|-------|
| `game.tsx` | 37-48 |
| `slam-chain.tsx` | 15-27 |
| `target-man.tsx` | 20-31 |
| `grid-lock.tsx` | 15-27 |
| `overlap.tsx` | 67-79 |
| `club-ladder.tsx` | 64-76 |

All 6 implementations do the exact same thing: NFD normalize, strip diacritics, lowercase, replace special chars (ss, o, ae, d, th, d), strip punctuation/whitespace.

Additionally, `getCommonSurname()` is duplicated across 4 PL-data-based games (game.tsx, target-man.tsx, overlap.tsx, club-ladder.tsx) with identical logic.

The `buildPlayerLookup()` function is duplicated in 4 variants:
- **game.tsx + target-man.tsx**: `Map<string, Player>` (single player per key, from `players.ts` goalscorers data)
- **overlap.tsx + club-ladder.tsx**: `Map<string, PLPlayer[]>` (array of players per key, from `pl-players.json`)
- **slam-chain.tsx**: `Map<string, SlamPlayer>` (per-tournament lookup)
- **grid-lock.tsx**: `Map<string, F1Driver>` (per-season lookup)

The mononym overrides (`gilberto -> gilbertosilva`) and alternate spellings (`vannistelrooij -> vannistelrooy`) are duplicated in game.tsx, target-man.tsx, overlap.tsx, and club-ladder.tsx.

### Proposed Solution

Create `client/src/lib/normalize.ts`:
```ts
export function normalizeName(name: string): string { ... }
export function getCommonSurname(displayName: string, lastName: string): string { ... }
```

Create `client/src/lib/player-lookup.ts`:
```ts
// Shared mononyms and alternate spellings
export const MONONYMS = { gilberto: "gilbertosilva", gabriel: "gabrielmagalhaes" };
export const ALTERNATES = { vannistelrooij: "vannistelrooy", nistelrooij: "nistelrooy" };

// Generic lookup builder that games can parameterize
export function buildLookup<T>(items: T[], getKeys: (item: T) => string[]): Map<string, T> { ... }
export function buildMultiLookup<T>(items: T[], getKeys: (item: T) => string[]): Map<string, T[]> { ... }
```

### Files Affected
All 6 game pages, plus new files `lib/normalize.ts` and `lib/player-lookup.ts`.

### Risk: LOW
Pure utility extraction. No behavior change. Each game would import and call the same function. Easy to test by verifying each game still accepts the same inputs.

---

## 2. PLPlayer Type Definition

### Priority: HIGH

### What's Duplicated

The `PLPlayer` interface is defined identically in both `overlap.tsx` (lines 20-31) and `club-ladder.tsx` (lines 20-31):
```ts
interface PLPlayer {
  displayName: string;
  firstName: string;
  lastName: string;
  position: string;
  nationality: string;
  dob: string;
  clubs: Record<string, { appearances: number; goals: number; assists: number }>;
  totalAppearances: number;
  totalGoals: number;
  totalAssists: number;
}
```

This type should be co-located with the data it describes.

### Proposed Solution

Create `client/src/data/pl-player-types.ts` (or add to existing `players.ts`):
```ts
export interface PLPlayer { ... }
export interface ClubStats { appearances: number; goals: number; assists: number; }
```

### Files Affected
- `overlap.tsx`, `club-ladder.tsx` (remove local definitions, import shared type)
- New file `data/pl-player-types.ts`

### Risk: LOW
Type-only change. No runtime behavior affected.

---

## 3. End Screen Pattern

### Priority: HIGH

### What's Duplicated

Every game has an EndScreen component with this identical structure:

1. **Share handler** -- `handleShare()` with navigator.share/clipboard.writeText, `copied` state, 2-second timeout
2. **GoatCounter tracking** -- `(window as any).goatcounter?.count(...)` in a useEffect
3. **Score saving** -- `saveScore(user?.username, gameSlug, score)` in same useEffect
4. **High score sound** -- `isNewHighScore ? playHighScore() : playGameEnd()` in same useEffect
5. **Button layout** -- mobile-first responsive layout with Home/Play Again/Share, duplicated between `sm:hidden` and `hidden sm:flex` blocks
6. **New High Score badge** -- identical motion.div with star icon, amber gradient
7. **Game number display** -- `Game #{totalPlays + 1}` with Ticket icon
8. **Final score display** -- big number with gradient text

The button layout alone is ~60 lines duplicated 6 times (360 lines total).

| File | EndScreen Lines (approx) |
|------|-------------------------|
| `game.tsx` | 779-1007 (228 lines) |
| `slam-chain.tsx` | 778-995 (217 lines) |
| `target-man.tsx` | ~200 lines |
| `grid-lock.tsx` | 723-950 (227 lines) |
| `overlap.tsx` | ~200 lines |
| `club-ladder.tsx` | ~200 lines |

### Proposed Solution

Create `client/src/components/game-end-screen.tsx`:
```ts
interface GameEndScreenProps {
  gameName: string;
  gameSlug: GameSlug;
  gameUrl: string;
  emoji: string;
  score: number;
  highScore: number;
  totalPlays: number;
  scoreLabel: string; // "total goals from 5 players", "tournaments answered correctly", etc.
  failReason?: string;
  themeColors: { primary: string; share: string; }; // for button styling
  onRestart: () => void;
  onHome: () => void;
  children?: ReactNode; // game-specific results chart/list below the score
}
```

This would encapsulate:
- Share logic (handleShare, copied state)
- GoatCounter event firing
- Score saving via saveScore()
- Sound playing (high score vs game end)
- Responsive button layout (Home / Play Again / Share)
- New High Score badge
- Game number display
- Final score hero number
- A slot for game-specific result visualizations

### Files Affected
All 6 game pages (replace local EndScreen with shared component), new component file.

### Risk: MEDIUM
Each game's end screen has slight visual differences (theme colors, result visualizations). The shared component must be flexible enough via props and children slots. The game-specific charts (goal contributions, driver bars, etc.) would remain in each game file and be passed as children.

---

## 4. Start Screen Pattern

### Priority: HIGH

### What's Duplicated

Every game has a StartScreen with identical structure:
1. Home button (absolute positioned, top-left)
2. Background glow blobs
3. Animated icon in rounded box
4. Game title with gradient second word
5. Rules list (icon + text items)
6. High score badge (if > 0)
7. Start Game button

| File | StartScreen Lines (approx) |
|------|---------------------------|
| `game.tsx` | 650-777 (127 lines) |
| `slam-chain.tsx` | 638-776 (138 lines) |
| `target-man.tsx` | ~130 lines |
| `grid-lock.tsx` | 575-720 (145 lines) |
| `overlap.tsx` | ~130 lines |
| `club-ladder.tsx` | ~140 lines |

### Proposed Solution

Create `client/src/components/game-start-screen.tsx`:
```ts
interface GameStartScreenProps {
  icon: ReactNode;
  iconGradient: string;
  titlePlain: string;
  titleGradient: string;
  titleGradientText: string;
  rules: { icon: ReactNode; iconBg: string; text: ReactNode }[];
  highScore: number;
  highScoreLabel?: string; // "goals" for GoalChain, omitted for others
  buttonClass: string;
  glowA: string;
  glowB: string;
  onStart: () => void;
  onHome: () => void;
}
```

### Files Affected
All 6 game pages, new component file.

### Risk: MEDIUM
Same concern as end screen -- slight visual differences per game. The rules list content varies per game, but the layout is identical.

---

## 5. Screen Flash Overlays (Correct/Wrong)

### Priority: HIGH

### What's Duplicated

The correct and wrong screen flash overlays are **nearly identical** across all 6 games. Each game has two AnimatePresence blocks (~25 lines each, ~50 lines per game, ~300 lines total):

```tsx
<AnimatePresence>
  {showCorrect && (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }} className="fixed inset-0 pointer-events-none z-50">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.08 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }} className="absolute inset-0 bg-emerald-500" />
    </motion.div>
  )}
</AnimatePresence>
```

The only variation is the color (emerald for correct in most games, orange in GridLock; red for wrong in all) and the opacity value.

### Proposed Solution

Create `client/src/components/screen-flash.tsx`:
```ts
export function ScreenFlash({ show, color, opacity }: { show: boolean; color: string; opacity?: number }) { ... }
```

Usage: `<ScreenFlash show={showCorrect} color="bg-emerald-500" />`

### Files Affected
All 6 game pages.

### Risk: LOW
Simple presentational component extraction with no logic changes.

---

## 6. Timer Management Hook

### Priority: MEDIUM

### What's Duplicated

Timer logic appears in two patterns:

**Pattern A: Global countdown** (game.tsx, target-man.tsx) -- 90-second game timer, 1-second intervals, tick sounds in last 10 seconds, endGame on zero.

**Pattern B: Per-question countdown** (slam-chain.tsx, grid-lock.tsx, overlap.tsx, club-ladder.tsx) -- 30-second per-question timer, either 1s or 0.1s intervals, tick sounds, endGame/advance on zero.

Common elements:
- `timerRef = useRef<NodeJS.Timeout | null>(null)`
- `clearInterval` in cleanup + goHome + endGame
- Tick sound at threshold (last 5-11 seconds)
- Timer bar percentage calculation: `(timeLeft / DURATION) * 100`
- Urgent/warning state: `isUrgent = timeLeft <= X`, `isWarning = timeLeft <= Y`

### Proposed Solution

Create `client/src/hooks/use-game-timer.ts`:
```ts
interface UseGameTimerOptions {
  duration: number;
  intervalMs?: number; // 1000 or 100
  tickThreshold?: number;
  onExpire: () => void;
}

function useGameTimer(opts: UseGameTimerOptions) {
  return { timeLeft, timerPercent, isUrgent, isWarning, start, stop, reset };
}
```

### Files Affected
All 6 game pages.

### Risk: MEDIUM
Timer logic is subtly different between games (some use 100ms intervals with ref-based tracking, some use 1s intervals with state-based tracking). The hook would need to accommodate both patterns. overlap.tsx and club-ladder.tsx use `turnTimeRef.current` for sub-second precision -- this pattern is more complex.

---

## 7. Floating Emoji Background Effect

### Priority: MEDIUM

### What's Duplicated

All 6 games generate floating emoji arrays with the same pattern:

```ts
const floatingEmojis = useMemo(() => {
  if (!streak.emoji) return [];
  const count = tier === 3 ? N : tier === 2 ? M : K;
  return Array.from({ length: count }, (_, i) => ({
    id: i, emoji, left: `${5 + Math.random() * 90}%`,
    delay: Math.random() * 3, duration: 3 + Math.random() * 4,
    size: 14 + Math.random() * 14,
  }));
}, [deps]);
```

And then render them identically:
```tsx
<AnimatePresence>
  {floatingEmojis.map((e) => (
    <motion.span key={...} initial={{ opacity: 0, y: "100vh" }}
      animate={{ opacity: [0, 0.5, 0.5, 0], y: "-20vh" }}
      ... />
  ))}
</AnimatePresence>
```

~30-40 lines per game, ~200 lines total.

### Proposed Solution

Create `client/src/components/floating-emojis.tsx`:
```ts
export function FloatingEmojis({ emoji, tier }: { emoji: string; tier: number }) { ... }
```

### Files Affected
All 6 game pages.

### Risk: LOW
Pure visual component, no game logic dependency.

---

## 8. Game Input Form

### Priority: MEDIUM

### What's Duplicated

Every game has the same input form structure:
- `<form onSubmit={handleSubmit}>` with `<input>` having identical attributes (autoComplete off, autoCorrect off, etc.)
- Same `onFocus={() => setTimeout(() => window.scrollTo({ top: 0 }), 300)}` workaround
- Same submit button with ChevronRight icon
- Same correct/wrong border styling ternary
- Pass/skip button below input
- "Enter to submit" hint text

~40-50 lines per game, ~270 lines total.

### Proposed Solution

Create `client/src/components/game-input.tsx`:
```ts
interface GameInputProps {
  inputRef: RefObject<HTMLInputElement>;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  placeholder: string;
  showCorrect: boolean;
  showWrong: boolean;
  correctColor?: string;
  focusClass: string;
  rightContent?: ReactNode; // skip/pass buttons
  belowContent?: ReactNode; // "Enter to submit" + pass button
}
```

### Files Affected
All 6 game pages.

### Risk: LOW
Presentational extraction. Each game passes its own handler.

---

## 9. High Score Management Pattern

### Priority: MEDIUM

### What's Duplicated

Every game has this same pattern:
```ts
const [highScore, setHighScore] = useState(() => {
  try { return parseInt(sessionStorage.getItem("GAME-highscore") || "0"); } catch { return 0; }
});
const { highScore: firebaseHighScore, plays: totalPlays, refresh: refreshStats } = useGameStats(user?.username, "gameslug");
const effectiveHighScore = Math.max(highScore, firebaseHighScore);
```

And in endGame:
```ts
setTotalScore((prev) => {
  if (prev > highScore) {
    setHighScore(prev);
    try { sessionStorage.setItem("GAME-highscore", prev.toString()); } catch {}
  }
  refreshStats();
  return prev;
});
```

This is 15-20 lines duplicated 6 times.

### Proposed Solution

Create `client/src/hooks/use-high-score.ts`:
```ts
function useHighScore(gameSlug: GameSlug, username?: string) {
  return { effectiveHighScore, totalPlays, checkAndSave: (score: number) => void, refreshStats };
}
```

### Files Affected
All 6 game pages.

### Risk: LOW
Logic is identical across games, just parameterized by game slug and sessionStorage key.

---

## 10. Share Functionality

### Priority: MEDIUM

### What's Duplicated

Every EndScreen has:
```ts
const [copied, setCopied] = useState(false);
const handleShare = async () => {
  const text = `I scored ${score} on GameName EMOJI Can you beat me?\nhttps://drapk.in/path`;
  if (navigator.share) {
    try { await navigator.share({ text }); } catch {}
  } else {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
};
```

~12 lines x 6 games = ~72 lines.

### Proposed Solution

Create `client/src/lib/share.ts` or a `useShare` hook:
```ts
function useShare() {
  const [copied, setCopied] = useState(false);
  const share = async (text: string) => { ... };
  return { share, copied };
}
```

### Files Affected
All 6 end screen components.

### Risk: LOW

---

## 11. GoatCounter Tracking Pattern

### Priority: LOW

### What's Duplicated

Every EndScreen useEffect has:
```ts
try {
  (window as any).goatcounter?.count({
    path: `game-played-SLUG?${Date.now()}`,
    title: `GameName: ${score}pts`,
    event: true,
  });
} catch {}
```

### Proposed Solution

Add to `lib/save-score.ts` or create `lib/analytics.ts`:
```ts
export function trackGamePlayed(slug: GameSlug, gameName: string, score: number) { ... }
```

### Files Affected
All 6 end screens.

### Risk: LOW

---

## 12. `shuffleArray` and `toSentenceCase` Utility Duplication

### Priority: LOW

### What's Duplicated

- `shuffleArray<T>()` is duplicated in `slam-chain.tsx` (line 141-148) and `grid-lock.tsx` (line 66-73). Identical Fisher-Yates shuffle.
- `toSentenceCase()` is duplicated in `slam-chain.tsx` (line 137-139) and `grid-lock.tsx` (line 62-64).

### Proposed Solution

Add to `lib/utils.ts`:
```ts
export function shuffleArray<T>(arr: T[]): T[] { ... }
export function toSentenceCase(s: string): string { ... }
```

### Files Affected
`slam-chain.tsx`, `grid-lock.tsx`, `lib/utils.ts`.

### Risk: LOW

---

## 13. `getStreakLevel` / `getComboLevel` Duplication

### Priority: LOW

### What's Duplicated

Streak/combo level functions are defined in 5 games with slightly different thresholds and return shapes:

| File | Function | Thresholds | Returns |
|------|----------|-----------|---------|
| `game.tsx` | `getStreakLevel` | 5/10/15 | label, color, glowColor, bgClass, emoji |
| `slam-chain.tsx` | `getStreakLevel` | 5/10/15 | label, color, emoji |
| `grid-lock.tsx` | `getStreakLevel` | 5/10/15 | label, emoji, color |
| `target-man.tsx` | `getComboLevel` | 2/3/4/5 | label, color, bgClass, glowColor |
| `overlap.tsx` | `getComboLevel` | 2/4/6 | label, color, bgClass |

### Proposed Solution

These are similar but each game uses different thresholds and return types. A generic version could work:
```ts
function getStreakLevel<T>(count: number, levels: [number, T][]): T | null { ... }
```

However, the benefit is marginal since the logic is simple and each game's thresholds are game-specific.

### Risk: LOW -- but also low benefit. Consider leaving as-is or extracting only if further consolidation is done.

---

## 14. Game Header Bar

### Priority: MEDIUM

### What's Duplicated

Every game's playing state has a header bar with:
- Home button (icon, same styling)
- Timer display (icon + time, urgent/warning colors)
- Score display
- High score badge (Trophy icon, amber)
- End/Give-up button

The layout is identical, only the specific score elements and theme colors vary.

~30-40 lines per game.

### Proposed Solution

Create `client/src/components/game-header.tsx`:
```ts
interface GameHeaderProps {
  onHome: () => void;
  onEnd: () => void;
  timerDisplay: ReactNode;
  scoreDisplay: ReactNode;
  highScore: number;
  endLabel?: string;
}
```

### Files Affected
All 6 game pages.

### Risk: LOW-MEDIUM
Some games have extra elements in the header (skip indicators, combo badges, question counters). The component would need slots for these.

---

## 15. `GameState` Type

### Priority: LOW

### What's Duplicated

`type GameState = "idle" | "playing" | "finished"` is defined identically in all 6 game files.

### Proposed Solution

Export from a shared types file or from a shared hook.

### Risk: LOW

---

## 16. `useGameStats` Creates Redundant Firebase Queries

### Priority: MEDIUM (performance)

### What's Duplicated / Problematic

`useGameStats` calls `useUserStats` which queries ALL game scores from Firebase, even when only one game's stats are needed. On the home page, `useUserStats` is called once (correct), but on each game page, `useGameStats` calls `useUserStats` internally, fetching all games' data just to return one game's stats.

### Proposed Solution

Option A: Cache the query result in context so it's shared across components.
Option B: Add a per-game query option to `useUserStats` that uses a `where("game", "==", slug)` filter.

### Files Affected
`lib/use-user-stats.ts`, indirectly all game pages.

### Risk: LOW -- Firebase queries are already non-critical (silent failure). Caching or filtering just improves efficiency.

---

## 17. `normalizeChar` in game.tsx (GoalChain-specific)

### Priority: LOW

### What's Duplicated

`game.tsx` has both `normalizeChar()` (single char normalization for letter-chain matching) and `normalizeName()` (full name normalization). These are distinct but overlapping. `normalizeChar` has slightly different replacements (e.g., `ß -> s` vs `ß -> ss`).

### Proposed Solution

Keep `normalizeChar` in game.tsx as it's GoalChain-specific logic. Only extract `normalizeName` to shared.

### Risk: NONE

---

## 18. End Screen Button Layout (Mobile/Desktop Duplication)

### Priority: MEDIUM

### What's Duplicated

Every end screen renders buttons TWICE -- once for mobile (`sm:hidden`) and once for desktop (`hidden sm:flex`). This means each end screen has ~50 lines of duplicated button markup within itself, and this pattern is then duplicated across 6 games.

### Proposed Solution

A responsive `EndScreenActions` component that handles the layout internally:
```tsx
function EndScreenActions({ onHome, onRestart, onShare, copied, themeClass }: Props) {
  // Single source of truth, uses CSS to reorder/resize for mobile vs desktop
}
```

### Files Affected
All 6 end screens.

### Risk: LOW

---

## Priority Summary

| Priority | Item | Estimated Lines Saved | Effort |
|----------|------|-----------------------|--------|
| HIGH | 1. Name normalization extraction | ~150 | Small |
| HIGH | 2. PLPlayer type extraction | ~30 | Tiny |
| HIGH | 3. End screen shared component | ~800+ | Medium |
| HIGH | 4. Start screen shared component | ~500+ | Medium |
| HIGH | 5. Screen flash overlays | ~250 | Small |
| MEDIUM | 6. Timer management hook | ~200 | Medium |
| MEDIUM | 7. Floating emoji component | ~200 | Small |
| MEDIUM | 8. Game input form | ~200 | Small |
| MEDIUM | 9. High score management hook | ~100 | Small |
| MEDIUM | 10. Share functionality | ~70 | Tiny |
| MEDIUM | 14. Game header bar | ~180 | Small |
| MEDIUM | 16. Firebase query efficiency | ~20 | Small |
| LOW | 11. GoatCounter tracking | ~30 | Tiny |
| LOW | 12. shuffleArray/toSentenceCase | ~20 | Tiny |
| LOW | 13. Streak/combo levels | ~60 | Small |
| LOW | 15. GameState type | ~6 | Tiny |
| LOW | 18. Button layout dedup | Included in #3 | Tiny |

**Total estimated lines saved: ~2,800+ lines** (from ~5,500 lines of game page code)

---

## Recommended Implementation Order

1. **Phase 1 -- Zero-risk extractions** (items 1, 2, 5, 7, 11, 12, 15)
   - Pure utility/type/presentational extractions with no behavior change
   - Can be done in a single PR

2. **Phase 2 -- Hooks** (items 6, 9, 10)
   - Extract timer, high score, and share hooks
   - Test each game after extraction

3. **Phase 3 -- Shared UI components** (items 3, 4, 8, 14, 18)
   - Start screen, end screen, input form, header bar
   - Largest impact but requires careful design of prop interfaces
   - Do one game at a time as proof of concept, then migrate others

4. **Phase 4 -- Performance** (item 16)
   - Firebase query optimization
   - Independent of other changes

---

## Architectural Notes

- The convention of "each game is a self-contained file" is documented in CLAUDE.md. After refactoring, each game file would still own its game logic and unique UI, but would import shared components and utilities instead of re-implementing them.
- The `components/ui/` directory (shadcn) should NOT be edited. Shared game components should go in `components/` (not `components/ui/`).
- Since builds only happen via GitHub Actions, each refactoring PR should be small enough to fix forward if a build fails.
- The game themes system (`lib/game-themes.ts`) is already well-extracted and should be used by the new shared components for theming.
