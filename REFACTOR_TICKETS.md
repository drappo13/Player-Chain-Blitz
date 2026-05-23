# Refactoring Tickets

Based on the analysis in `REFACTOR_PLAN.md` and review of all 6 game source files. Each ticket targets **true duplication** -- identical or near-identical code that can be safely extracted without changing game behavior.

---

## Ticket 1: Extract `normalizeName` and `getCommonSurname` to shared utility

**Priority:** P0 (critical duplication)

**Files affected:**
- `client/src/pages/game.tsx` (lines 37-49)
- `client/src/pages/slam-chain.tsx` (lines 15-27)
- `client/src/pages/target-man.tsx` (lines 20-32)
- `client/src/pages/grid-lock.tsx` (lines 15-27)
- `client/src/pages/overlap.tsx` (lines 67-79)
- `client/src/pages/club-ladder.tsx` (lines 64-76)
- **New file:** `client/src/lib/normalize.ts`

**What to extract:**

```ts
// client/src/lib/normalize.ts

/**
 * Normalize a player name for lookup: strip diacritics, lowercase,
 * replace special characters, remove punctuation and whitespace.
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ð/g, "d")
    .replace(/þ/g, "th")
    .replace(/đ/g, "d")
    .replace(/['\-\s]/g, "");
}

/**
 * Get the "common" surname for display name matching.
 * Uses the last word of displayName if multi-word, otherwise falls back to lastName.
 * Works with any player type that has { displayName: string; lastName: string }.
 */
export function getCommonSurname(p: { displayName: string; lastName: string }): string {
  const displayParts = p.displayName.trim().split(/\s+/);
  if (displayParts.length > 1) {
    return displayParts[displayParts.length - 1];
  }
  return p.lastName;
}

/**
 * Shared mononym overrides for PL player lookups.
 * Maps normalized alias -> normalized displayName key.
 */
export const PL_MONONYMS: Record<string, string> = {
  gilberto: "gilbertosilva",
  gabriel: "gabrielmagalhaes",
};

/**
 * Shared alternate spelling overrides for PL player lookups.
 */
export const PL_ALTERNATES: Record<string, string> = {
  vannistelrooij: "vannistelrooy",
  nistelrooij: "nistelrooy",
};
```

**Migration steps for each game page:**

1. Add import: `import { normalizeName, getCommonSurname, PL_MONONYMS, PL_ALTERNATES } from "@/lib/normalize";`
2. Delete the local `normalizeName` function definition
3. Delete the local `getCommonSurname` function definition (in game.tsx, target-man.tsx, overlap.tsx, club-ladder.tsx)
4. Replace local `mononyms` and `alternates` objects in `buildPlayerLookup` with the imported constants (in game.tsx, target-man.tsx, overlap.tsx, club-ladder.tsx)
5. Note: `game.tsx` keeps its own `normalizeChar` function -- it is GoalChain-specific and NOT duplicated
6. Note: `getCommonSurname` signature uses `{ displayName: string; lastName: string }` which is compatible with both `Player` (from players.ts) and `PLPlayer` (from pl-players.json)

**Testing checklist:**
- [ ] GoalChain: enter player names with diacritics (e.g., "ozil", "haaland"), verify they still match
- [ ] GoalChain: enter "gilberto", verify it maps to Gilberto Silva
- [ ] TargetMan: enter "van nistelrooij", verify alternate spelling works
- [ ] Overlap: enter "gabriel", verify it maps to Gabriel Magalhaes
- [ ] SlamChain: enter names with accents, verify they normalize correctly
- [ ] GridLock: enter "hakkinen", "hulkenberg" etc., verify accent stripping
- [ ] Build succeeds in GitHub Actions

**Risk:** LOW. Pure function extraction. All 6 implementations are character-for-character identical. `getCommonSurname` has a slightly wider signature (`{ displayName, lastName }` instead of `Player` or `PLPlayer`) which is structurally compatible via TypeScript's structural typing.

---

## Ticket 2: Extract `PLPlayer` interface to shared types

**Priority:** P0 (critical duplication)

**Files affected:**
- `client/src/pages/overlap.tsx` (lines 20-31)
- `client/src/pages/club-ladder.tsx` (lines 20-31)
- **New file:** `client/src/data/pl-player-types.ts`

**What to extract:**

```ts
// client/src/data/pl-player-types.ts

export interface ClubStats {
  appearances: number;
  goals: number;
  assists: number;
}

export interface PLPlayer {
  displayName: string;
  firstName: string;
  lastName: string;
  position: string;
  nationality: string;
  dob: string;
  clubs: Record<string, ClubStats>;
  totalAppearances: number;
  totalGoals: number;
  totalAssists: number;
}
```

**Migration steps:**

1. Create `client/src/data/pl-player-types.ts` with the above content
2. In `overlap.tsx`: delete local `PLPlayer` interface (lines 20-31), add `import type { PLPlayer } from "@/data/pl-player-types";`
3. In `club-ladder.tsx`: delete local `PLPlayer` interface (lines 20-31), add `import type { PLPlayer } from "@/data/pl-player-types";`

**Testing checklist:**
- [ ] Overlap game loads and plays normally
- [ ] ClubLadder game loads and plays normally
- [ ] Build succeeds (type-only change, no runtime impact)

**Risk:** LOW. Type-only change. No runtime behavior affected. Both local definitions are character-for-character identical.

---

## Ticket 3: Extract `ScreenFlash` component

**Priority:** P0 (critical duplication)

**Files affected:**
- `client/src/pages/game.tsx` (lines 607-645)
- `client/src/pages/slam-chain.tsx` (lines 591-629)
- `client/src/pages/grid-lock.tsx` (lines 532-570)
- `client/src/pages/overlap.tsx` (lines 1066-1103)
- `client/src/pages/club-ladder.tsx` (lines ~930-970)
- **New file:** `client/src/components/screen-flash.tsx`

**What to extract:**

```tsx
// client/src/components/screen-flash.tsx
import { AnimatePresence, motion } from "framer-motion";

interface ScreenFlashProps {
  show: boolean;
  /** Tailwind background color class, e.g. "bg-emerald-500" or "bg-red-500" */
  color: string;
  /** Flash opacity (0-1). Defaults to 0.08 for correct, 0.06 for wrong. */
  opacity?: number;
}

export function ScreenFlash({ show, color, opacity = 0.08 }: ScreenFlashProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 pointer-events-none z-50"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={`absolute inset-0 ${color}`}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

**Migration steps for each game page:**

1. Add import: `import { ScreenFlash } from "@/components/screen-flash";`
2. Replace both `<AnimatePresence>{showCorrect && ...}</AnimatePresence>` blocks with:
   ```tsx
   <ScreenFlash show={showCorrect} color="bg-emerald-500" />
   ```
3. Replace both `<AnimatePresence>{showWrong && ...}</AnimatePresence>` blocks with:
   ```tsx
   <ScreenFlash show={showWrong} color="bg-red-500" opacity={0.06} />
   ```
4. Per-game color overrides:
   - `game.tsx`: correct = `bg-emerald-500` (opacity 0.08), wrong = `bg-red-500` (opacity 0.06)
   - `slam-chain.tsx`: correct = `bg-emerald-500` (opacity 0.08), wrong = `bg-red-500` (opacity 0.06)
   - `grid-lock.tsx`: correct = `bg-orange-500` (opacity 0.08), wrong = `bg-red-500` (opacity 0.06)
   - `club-ladder.tsx`: correct = `bg-emerald-500` (opacity 0.06), wrong = `bg-red-500` (opacity 0.06)
   - `overlap.tsx`: NOTE -- overlap's correct flash has dynamic opacity/color based on `lastResult.appBonus + lastResult.goalBonus`. This game will need to pass those values as props rather than use the simple component. Options: (a) keep overlap's custom flash inline, or (b) pass `opacity` and `color` as computed values.
5. Remove the `AnimatePresence` import from game pages IF it's no longer used elsewhere in the file (unlikely -- most games use it for other animations too).

**Testing checklist:**
- [ ] Each game: trigger correct answer, see green/orange flash
- [ ] Each game: trigger wrong answer, see red flash
- [ ] Overlap specifically: verify that big-bonus answers have stronger blue flash vs. small-bonus answers having weaker green flash
- [ ] Flash animation timing feels the same (0.15s in, 0.3s hold)
- [ ] Build succeeds

**Risk:** LOW for 5 games with simple flash. MEDIUM for overlap.tsx which has dynamic opacity/color -- recommend keeping overlap's correct flash inline and only extracting its wrong flash (which is identical to all others). Or pass computed `color` and `opacity` props.

---

## Ticket 4: Extract `useShare` hook

**Priority:** P1 (significant duplication)

**Files affected:**
- `client/src/pages/game.tsx` (EndScreen: lines 794-807)
- `client/src/pages/slam-chain.tsx` (SlamEndScreen: lines 796-808)
- `client/src/pages/target-man.tsx` (EndScreen: lines 1133-1141)
- `client/src/pages/grid-lock.tsx` (GridLockEndScreen: lines 744-753)
- `client/src/pages/overlap.tsx` (EndScreen: lines 1262-1271)
- `client/src/pages/club-ladder.tsx` (EndScreen: lines 1208-1217)
- **New file:** `client/src/hooks/use-share.ts`

**What to extract:**

```ts
// client/src/hooks/use-share.ts
import { useState, useCallback } from "react";

/**
 * Hook for sharing game results via Web Share API with clipboard fallback.
 * Returns { share, copied } where share(text) triggers the share/copy
 * and copied is true for 2 seconds after a clipboard copy.
 */
export function useShare() {
  const [copied, setCopied] = useState(false);

  const share = useCallback(async (text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  return { share, copied };
}
```

**Migration steps for each game page:**

1. Add import: `import { useShare } from "@/hooks/use-share";`
2. In each EndScreen component, replace:
   ```ts
   const [copied, setCopied] = useState(false);
   const handleShare = async () => {
     const text = `I scored ...`;
     if (navigator.share) { ... } else { ... }
   };
   ```
   with:
   ```ts
   const { share, copied } = useShare();
   const handleShare = () => share(`I scored ${score.toLocaleString()} on GameName EMOJI Can you beat me?\nhttps://drapk.in/path`);
   ```
3. No changes to the Share button JSX -- it already references `handleShare` and `copied`.

**Testing checklist:**
- [ ] On mobile: tap Share, verify native share sheet opens
- [ ] On desktop: click Share, verify "Copied!" appears for 2 seconds, verify text is in clipboard
- [ ] Verify share text content for each game (game name, emoji, URL)
- [ ] Build succeeds

**Risk:** LOW. The share logic is identical across all 6 games. The only variance is the share text string, which remains in the game file.

---

## Ticket 5: Extract `trackGamePlayed` analytics helper

**Priority:** P1 (significant duplication)

**Files affected:**
- All 6 game pages (EndScreen useEffect)
- **New file:** `client/src/lib/analytics.ts`

**What to extract:**

```ts
// client/src/lib/analytics.ts

/**
 * Fire a GoatCounter event for a completed game.
 * Silent failure -- never breaks the game experience.
 */
export function trackGamePlayed(slug: string, gameName: string, score: number): void {
  try {
    (window as any).goatcounter?.count({
      path: `game-played-${slug}?${Date.now()}`,
      title: `${gameName}: ${score}pts`,
      event: true,
    });
  } catch {}
}
```

**Migration steps for each game page:**

1. Add import: `import { trackGamePlayed } from "@/lib/analytics";`
2. In each EndScreen's `useEffect`, replace the `try { (window as any).goatcounter... } catch {}` block with:
   - `game.tsx`: `trackGamePlayed("goalchain", "GoalChain", totalGoals);`
   - `slam-chain.tsx`: `trackGamePlayed("slam16", "Slam16", score);`
   - `target-man.tsx`: `trackGamePlayed("targetman", "TargetMan", totalScore);`
   - `grid-lock.tsx`: `trackGamePlayed("gridlock", "GridLock", score);`
   - `overlap.tsx`: `trackGamePlayed("overlap", "Overlap", totalScore);`
   - `club-ladder.tsx`: `trackGamePlayed("ladderup", "LadderUp", totalScore);`

Note: The `slug` parameter in the GoatCounter path is NOT the same as `GameSlug` from save-score.ts in all cases (e.g., slam-chain uses "slam16" for analytics but "slamchain" for score saving, and club-ladder uses "ladderup" for analytics but "clubladder" for score saving). Keep these as plain strings, not `GameSlug`.

**Testing checklist:**
- [ ] Complete a game, verify GoatCounter event fires in browser DevTools (Network tab or GoatCounter dashboard)
- [ ] Verify the path and title format match existing behavior for each game
- [ ] Build succeeds

**Risk:** LOW. Pure extraction of a try/catch-wrapped analytics call. Silent failure is preserved.

---

## Ticket 6: Extract `GameState` type to shared file

**Priority:** P2 (nice-to-have)

**Files affected:**
- All 6 game pages
- **New file:** `client/src/lib/game-types.ts`

**What to extract:**

```ts
// client/src/lib/game-types.ts

/** Game lifecycle state used by all game pages */
export type GameState = "idle" | "playing" | "finished";
```

**Migration steps:**

1. Create `client/src/lib/game-types.ts`
2. In each game page, replace `type GameState = "idle" | "playing" | "finished";` with `import type { GameState } from "@/lib/game-types";`

**Testing checklist:**
- [ ] Build succeeds
- [ ] No runtime behavior change (type-only)

**Risk:** LOW. Type-only extraction.

---

## Ticket 7: Extract `shuffleArray` and `toSentenceCase` to `lib/utils.ts`

**Priority:** P2 (nice-to-have)

**Files affected:**
- `client/src/pages/slam-chain.tsx` (lines 137-148)
- `client/src/pages/grid-lock.tsx` (lines 62-73)
- `client/src/lib/utils.ts` (add to existing file)

**What to extract (add to existing `client/src/lib/utils.ts`):**

```ts
/** Fisher-Yates shuffle. Returns a new array. */
export function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Capitalize the first letter of each word */
export function toSentenceCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
```

**Migration steps:**

1. Add both functions to `client/src/lib/utils.ts`
2. In `slam-chain.tsx`: delete local `shuffleArray` and `toSentenceCase`, add `import { shuffleArray, toSentenceCase } from "@/lib/utils";` (merge with existing `cn` import if present)
3. In `grid-lock.tsx`: delete local `shuffleArray` and `toSentenceCase`, add `import { shuffleArray, toSentenceCase } from "@/lib/utils";`

**Testing checklist:**
- [ ] SlamChain: tournaments still appear in random order
- [ ] GridLock: seasons still appear in random order
- [ ] GridLock: wrong-answer display names still get sentence casing
- [ ] Build succeeds

**Risk:** LOW. Both functions are character-for-character identical between the two files.

---

## Ticket 8: Extract `useHighScore` hook

**Priority:** P1 (significant duplication)

**Files affected:**
- All 6 game pages
- **New file:** `client/src/hooks/use-high-score.ts`

**What to extract:**

```ts
// client/src/hooks/use-high-score.ts
import { useState, useCallback } from "react";
import { useGameStats } from "@/lib/use-user-stats";
import type { GameSlug } from "@/lib/save-score";

interface UseHighScoreReturn {
  /** Max of local session + Firebase high score */
  effectiveHighScore: number;
  /** Total plays from Firebase */
  totalPlays: number;
  /**
   * Call at end of game. If score > local high score, updates sessionStorage.
   * Also triggers a Firebase stats refresh.
   */
  checkAndUpdate: (score: number) => void;
  /** Force refresh from Firebase */
  refreshStats: () => void;
}

/**
 * Manages high score state: reads from sessionStorage + Firebase,
 * writes to sessionStorage when a new high is achieved.
 *
 * @param sessionKey - sessionStorage key, e.g. "goalchain-highscore"
 * @param gameSlug - GameSlug for Firebase stats lookup
 * @param username - current user's username (undefined if not logged in)
 */
export function useHighScore(
  sessionKey: string,
  gameSlug: GameSlug,
  username: string | undefined,
): UseHighScoreReturn {
  const [localHighScore, setLocalHighScore] = useState(() => {
    try {
      return parseInt(sessionStorage.getItem(sessionKey) || "0");
    } catch {
      return 0;
    }
  });

  const {
    highScore: firebaseHighScore,
    plays: totalPlays,
    refresh: refreshStats,
  } = useGameStats(username, gameSlug);

  const effectiveHighScore = Math.max(localHighScore, firebaseHighScore);

  const checkAndUpdate = useCallback(
    (score: number) => {
      if (score > localHighScore) {
        setLocalHighScore(score);
        try {
          sessionStorage.setItem(sessionKey, score.toString());
        } catch {}
      }
      refreshStats();
    },
    [localHighScore, sessionKey, refreshStats],
  );

  return { effectiveHighScore, totalPlays, checkAndUpdate, refreshStats };
}
```

**Migration steps for each game page:**

1. Add import: `import { useHighScore } from "@/hooks/use-high-score";`
2. Remove the local `highScore` useState + sessionStorage init
3. Remove the local `useGameStats` call
4. Remove the local `effectiveHighScore` calculation
5. Replace with single call:
   ```ts
   const { effectiveHighScore, totalPlays, checkAndUpdate, refreshStats } =
     useHighScore("goalchain-highscore", "goalchain", user?.username);
   ```
6. In `endGame`, replace the `setTotalGoals/setScore((prev) => { if (prev > highScore) ... })` pattern with just calling `checkAndUpdate(score)` after setting the final score.

Per-game sessionKey values:
- `game.tsx`: `"chaingoal-highscore"`, `"goalchain"`
- `slam-chain.tsx`: `"slamchain-highscore"`, `"slamchain"`
- `target-man.tsx`: `"targetman-highscore"`, `"targetman"`
- `grid-lock.tsx`: `"gridlock-highscore"`, `"gridlock"`
- `overlap.tsx`: `"overlap-highscore"`, `"overlap"`
- `club-ladder.tsx`: `"clubladder-highscore"`, `"clubladder"`

**Testing checklist:**
- [ ] Each game: play and beat your high score, verify the high score updates on the start screen
- [ ] Each game: play and score lower than high score, verify old high score is still shown
- [ ] Refresh the page, verify sessionStorage high score persists
- [ ] Log in with a user that has Firebase scores, verify effective high score uses the max of local and Firebase
- [ ] Build succeeds

**Risk:** MEDIUM. The `endGame` functions in several games use a `setScore(prev => { ... })` pattern to access the final score inside a state updater. The refactored version needs to ensure `checkAndUpdate` is called with the correct final score. For games like GoalChain where the score is an accumulator that hasn't changed yet at endGame time, the logic is slightly different from games like SlamChain where the score is already set. Requires careful per-game testing.

---

## Ticket 9: Extract `FloatingEmojis` component

**Priority:** P1 (significant duplication)

**Files affected:**
- `client/src/pages/game.tsx` (lines 311-384)
- `client/src/pages/slam-chain.tsx` (lines 192-399)
- `client/src/pages/grid-lock.tsx` (lines 133-332)
- **New file:** `client/src/components/floating-emojis.tsx`

Note: `target-man.tsx`, `overlap.tsx`, and `club-ladder.tsx` do NOT have floating emojis.

**What to extract:**

```tsx
// client/src/components/floating-emojis.tsx
import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface FloatingEmojisProps {
  /** The emoji character to float, e.g. "fire" or "zap". Empty string = no emojis. */
  emoji: string;
  /** Streak tier: 0 = none, 1 = few, 2 = medium, 3 = many */
  tier: number;
  /** Emoji counts per tier. Defaults to [0, 4, 8, 12]. */
  counts?: [number, number, number, number];
}

export function FloatingEmojis({
  emoji,
  tier,
  counts = [0, 4, 8, 12],
}: FloatingEmojisProps) {
  const emojis = useMemo(() => {
    if (!emoji || tier === 0) return [];
    const count = counts[tier] ?? counts[counts.length - 1];
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      emoji,
      left: `${5 + Math.random() * 90}%`,
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 4,
      size: 14 + Math.random() * 14,
    }));
  }, [emoji, tier, counts]);

  return (
    <AnimatePresence>
      {emojis.map((e) => (
        <motion.span
          key={`${e.id}-${emoji}`}
          initial={{ opacity: 0, y: "100vh" }}
          animate={{ opacity: [0, 0.5, 0.5, 0], y: "-20vh" }}
          exit={{ opacity: 0 }}
          transition={{
            duration: e.duration,
            delay: e.delay,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute select-none"
          style={{ left: e.left, fontSize: e.size }}
        >
          {e.emoji}
        </motion.span>
      ))}
    </AnimatePresence>
  );
}
```

**Migration steps:**

1. In `game.tsx`: delete the `floatingEmojis` useMemo and the `<AnimatePresence>{floatingEmojis.map(...)}</AnimatePresence>` block. Replace with:
   ```tsx
   <FloatingEmojis emoji={streak.emoji} tier={streakTier} counts={[0, 4, 8, 12]} />
   ```
   Note: game.tsx uses slightly different sizes (16 + random*16 vs 14 + random*14) and opacity (0.6 vs 0.5). Decide: accept the minor visual difference, or add `sizeRange` and `opacityPeak` props. Recommendation: accept the difference -- it's imperceptible.

2. In `slam-chain.tsx`: same pattern, replace with `<FloatingEmojis emoji={streak.emoji} tier={streakTier} counts={[0, 3, 6, 10]} />`

3. In `grid-lock.tsx`: same pattern, replace with `<FloatingEmojis emoji={streak.emoji} tier={streakTier} counts={[0, 3, 6, 10]} />`

**Testing checklist:**
- [ ] GoalChain: get 5+ streak, see floating emojis appear
- [ ] GoalChain: get 10+, see more emojis
- [ ] SlamChain: same streak tests
- [ ] GridLock: same streak tests, verify racing-themed emojis
- [ ] Build succeeds

**Risk:** LOW. Pure presentational component. Minor visual differences in opacity (0.5 vs 0.6) and size ranges between games; these are imperceptible and can be accepted. If pixel-perfectness is required, add optional `sizeMin`, `sizeRange`, and `opacityPeak` props.

---

## Ticket 10: Extract End-Screen side effects (`useEndScreenEffects`)

**Priority:** P1 (significant duplication)

**Files affected:**
- All 6 game pages (EndScreen useEffect blocks)
- **New file:** `client/src/hooks/use-end-screen-effects.ts`

**What to extract:**

Every EndScreen has an identical `useEffect` that:
1. Plays `playHighScore()` or `playGameEnd()` based on `isNewHighScore`
2. Fires GoatCounter analytics
3. Saves score to Firebase

```ts
// client/src/hooks/use-end-screen-effects.ts
import { useEffect } from "react";
import { playHighScore, playGameEnd } from "@/lib/sounds";
import { trackGamePlayed } from "@/lib/analytics"; // from Ticket 5
import { saveScore, type GameSlug } from "@/lib/save-score";

/**
 * Side effects that run once when an EndScreen mounts:
 * - Play appropriate sound (high score celebration vs. game end)
 * - Track the game play in GoatCounter
 * - Save the score to Firebase
 */
export function useEndScreenEffects(opts: {
  isNewHighScore: boolean;
  analyticsSlug: string;
  analyticsName: string;
  gameSlug: GameSlug;
  score: number;
  username: string | undefined;
}) {
  useEffect(() => {
    if (opts.isNewHighScore) {
      playHighScore();
    } else {
      playGameEnd();
    }
    trackGamePlayed(opts.analyticsSlug, opts.analyticsName, opts.score);
    saveScore(opts.username, opts.gameSlug, opts.score);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
```

**Migration steps:**

1. First complete Ticket 5 (trackGamePlayed extraction)
2. In each EndScreen, replace the `useEffect` containing sound + goatcounter + saveScore with:
   ```ts
   useEndScreenEffects({
     isNewHighScore,
     analyticsSlug: "goalchain",
     analyticsName: "GoalChain",
     gameSlug: "goalchain",
     score: totalGoals,
     username: user?.username,
   });
   ```
3. Remove the local `useUser()` call from EndScreen IF it was only used for the score saving (check -- some EndScreens may use `user` for nothing else). In practice, all EndScreens call `useUser()` only for `user?.username` in the save/analytics, so the import can stay or be removed per file.

Per-game values:

| Game | analyticsSlug | analyticsName | gameSlug | scoreVar |
|------|---------------|---------------|----------|----------|
| game.tsx | "goalchain" | "GoalChain" | "goalchain" | totalGoals |
| slam-chain.tsx | "slam16" | "Slam16" | "slamchain" | score |
| target-man.tsx | "targetman" | "TargetMan" | "targetman" | totalScore |
| grid-lock.tsx | "gridlock" | "GridLock" | "gridlock" | score |
| overlap.tsx | "overlap" | "Overlap" | "overlap" | totalScore |
| club-ladder.tsx | "ladderup" | "LadderUp" | "clubladder" | totalScore |

**Testing checklist:**
- [ ] Each game: finish with new high score, hear celebration arpeggio
- [ ] Each game: finish with low score, hear descending game-end tones
- [ ] Verify GoatCounter event fires on game completion (DevTools Network tab)
- [ ] Verify Firebase score document is created on game completion
- [ ] Build succeeds

**Risk:** LOW. This is a direct extraction of 3 side-effect calls into a hook. The `[]` dependency array is intentional (fire once on mount) and matches existing behavior.

---

## Ticket 11: Extract End-Screen action buttons component

**Priority:** P1 (significant duplication)

**Files affected:**
- All 6 game pages (EndScreen button sections)
- **New file:** `client/src/components/end-screen-actions.tsx`

**What to extract:**

Every EndScreen renders the same responsive 3-button layout (Home, Play Again, Share) twice: once for mobile (`sm:hidden`) and once for desktop (`hidden sm:flex`). This is ~50 lines per game, 300 lines total.

```tsx
// client/src/components/end-screen-actions.tsx
import { Button } from "@/components/ui/button";
import { Home, RotateCcw, Share2 } from "lucide-react";

interface EndScreenActionsProps {
  onHome: () => void;
  onRestart: () => void;
  onShare: () => void;
  copied: boolean;
  /** Tailwind classes for the primary (Play Again) button */
  primaryBtnClass: string;
  /** Tailwind classes for the outline (Home) button */
  outlineBtnClass: string;
  /** Tailwind classes for the share button, e.g. "border-primary/40 text-primary hover:bg-primary/10" */
  shareBtnClass: string;
}

export function EndScreenActions({
  onHome,
  onRestart,
  onShare,
  copied,
  primaryBtnClass,
  outlineBtnClass,
  shareBtnClass,
}: EndScreenActionsProps) {
  return (
    <>
      {/* Mobile layout */}
      <div className="flex items-center justify-between gap-3 sm:hidden mb-3">
        <Button
          onClick={onHome}
          variant="outline"
          size="lg"
          className={`${outlineBtnClass} flex-1`}
          data-testid="button-home-end"
        >
          <Home className="w-5 h-5 mr-2" />
          Home
        </Button>
        <Button
          onClick={onShare}
          variant="outline"
          size="lg"
          className={`font-bold flex-1 ${shareBtnClass}`}
        >
          <Share2 className="w-5 h-5 mr-2" />
          {copied ? "Copied!" : "Share"}
        </Button>
      </div>
      <div className="flex justify-center sm:hidden">
        <Button
          onClick={onRestart}
          size="lg"
          className={`text-lg px-10 font-bold w-full ${primaryBtnClass}`}
          data-testid="button-restart"
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Play Again
        </Button>
      </div>

      {/* Desktop layout */}
      <div className="hidden sm:flex items-center justify-center gap-3">
        <Button
          onClick={onHome}
          variant="outline"
          size="lg"
          className={outlineBtnClass}
          data-testid="button-home-end"
        >
          <Home className="w-5 h-5 mr-2" />
          Home
        </Button>
        <Button
          onClick={onRestart}
          size="lg"
          className={`text-lg px-10 font-bold ${primaryBtnClass}`}
          data-testid="button-restart"
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Play Again
        </Button>
        <Button
          onClick={onShare}
          variant="outline"
          size="lg"
          className={`font-bold ${shareBtnClass}`}
        >
          <Share2 className="w-5 h-5 mr-2" />
          {copied ? "Copied!" : "Share"}
        </Button>
      </div>
    </>
  );
}
```

**Migration steps:**

1. In each EndScreen, replace the entire mobile + desktop button block with:
   ```tsx
   <EndScreenActions
     onHome={onHome}
     onRestart={onRestart}
     onShare={handleShare}
     copied={copied}
     primaryBtnClass={theme.primaryBtn}  // or "shadow-xl shadow-primary/20" for emerald games
     outlineBtnClass={theme.outlineBtn}
     shareBtnClass="border-blue-500/40 text-blue-400 hover:bg-blue-500/10" // per game theme
   />
   ```

Per-game share button classes:
- `game.tsx`: `"border-primary/40 text-primary hover:bg-primary/10"`
- `slam-chain.tsx`: `"border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"`
- `target-man.tsx`: `"border-orange-500/40 text-orange-400 hover:bg-orange-500/10"`
- `grid-lock.tsx`: `"border-red-500/40 text-red-400 hover:bg-red-500/10"`
- `overlap.tsx`: `"border-blue-500/40 text-blue-400 hover:bg-blue-500/10"`
- `club-ladder.tsx`: `"border-purple-500/40 text-purple-400 hover:bg-purple-500/10"`

**Testing checklist:**
- [ ] Each game end screen: verify all 3 buttons appear and work
- [ ] Test on narrow viewport (mobile): Home and Share on top row, Play Again below full-width
- [ ] Test on wide viewport (desktop): all 3 in a row
- [ ] Share button shows "Copied!" for 2 seconds after clicking
- [ ] Build succeeds

**Risk:** LOW. The button layouts are structurally identical across all 6 games. The only difference is CSS classes, which are parameterized.

---

## Ticket 12: Extract `NewHighScoreBadge` component

**Priority:** P2 (nice-to-have)

**Files affected:**
- All 6 game pages (EndScreen high score badge)
- **New file:** `client/src/components/new-high-score-badge.tsx`

**What to extract:**

Every EndScreen has an identical "New High Score!" badge that only differs in the gradient color:

```tsx
// client/src/components/new-high-score-badge.tsx
import { motion } from "framer-motion";
import { Star } from "lucide-react";

interface NewHighScoreBadgeProps {
  show: boolean;
  /** Tailwind gradient + border classes. Defaults to amber (used by most games). */
  gradientClass?: string;
}

export function NewHighScoreBadge({
  show,
  gradientClass = "from-amber-500/15 to-amber-600/10 border-amber-500/20 text-amber-400 shadow-amber-500/10",
}: NewHighScoreBadgeProps) {
  if (!show) return null;
  return (
    <motion.div
      initial={{ scale: 0, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
      className={`mb-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${gradientClass} font-bold text-sm shadow-lg`}
    >
      <Star className="w-4 h-4 fill-current" />
      New High Score!
    </motion.div>
  );
}
```

**Migration steps:**

In each EndScreen, replace the `{isNewHighScore && (<motion.div ...>)}` block with:
```tsx
<NewHighScoreBadge show={isNewHighScore} />
```

Per-game gradient overrides:
- game.tsx, slam-chain.tsx, grid-lock.tsx, target-man.tsx: default amber (no override needed)
- overlap.tsx: `gradientClass="from-blue-500/15 to-cyan-600/10 border-blue-500/20 text-blue-400 shadow-blue-500/10"`
- club-ladder.tsx: `gradientClass="from-purple-500/15 to-indigo-600/10 border-purple-500/20 text-purple-400 shadow-purple-500/10"`

**Testing checklist:**
- [ ] Each game: finish with new high score, see animated badge
- [ ] Badge spring animation looks the same
- [ ] Overlap/ClubLadder use their themed color instead of amber
- [ ] Build succeeds

**Risk:** LOW. Pure presentational extraction. The animation and text are identical across all 6 games.

---

## Ticket 13: Add `shareBtn` field to `GameTheme` interface

**Priority:** P2 (nice-to-have, supports Ticket 11)

**Files affected:**
- `client/src/lib/game-themes.ts`

**What to change:**

Add a `shareBtn` field to the `GameTheme` interface so end-screen share button styling is theme-driven rather than hardcoded per game.

```ts
// Add to GameTheme interface:
/** Share button styling on end screen */
shareBtn: string;
```

Values:
- emerald: `"border-primary/40 text-primary hover:bg-primary/10"`
- warm: `"border-orange-500/40 text-orange-400 hover:bg-orange-500/10"`
- racing: `"border-red-500/40 text-red-400 hover:bg-red-500/10"`
- overlap: `"border-blue-500/40 text-blue-400 hover:bg-blue-500/10"`
- ladder: `"border-purple-500/40 text-purple-400 hover:bg-purple-500/10"`

Also add:
```ts
/** High-score glow blobs on end screen */
endGlowA: string;
endGlowB: string;
```

**Testing checklist:**
- [ ] Build succeeds
- [ ] No visual changes until Ticket 11 consumes the new fields

**Risk:** LOW. Additive change to an existing interface. No existing code breaks.

---

## Summary and Recommended Implementation Order

### Phase 1 -- Zero-risk extractions (can be one PR)
1. **Ticket 1** -- `normalizeName` + `getCommonSurname` (P0)
2. **Ticket 2** -- `PLPlayer` type (P0)
3. **Ticket 3** -- `ScreenFlash` component (P0)
4. **Ticket 6** -- `GameState` type (P2)
5. **Ticket 7** -- `shuffleArray` + `toSentenceCase` (P2)

### Phase 2 -- Hook extractions (one PR each)
6. **Ticket 4** -- `useShare` hook (P1)
7. **Ticket 5** -- `trackGamePlayed` analytics (P1)
8. **Ticket 10** -- `useEndScreenEffects` hook (P1, depends on Ticket 5)
9. **Ticket 8** -- `useHighScore` hook (P1)

### Phase 3 -- UI component extractions (one PR each)
10. **Ticket 9** -- `FloatingEmojis` component (P1)
11. **Ticket 11** -- `EndScreenActions` component (P1, depends on Ticket 4)
12. **Ticket 12** -- `NewHighScoreBadge` component (P2)
13. **Ticket 13** -- `GameTheme` additions (P2, supports Ticket 11)

### Not included (intentionally excluded)

The following items from the refactoring plan are **not ticketed** because they involve code that is similar but has meaningful per-game differences:

- **Timer management hook** -- Timer implementations differ significantly. game.tsx/target-man.tsx use a global 90s countdown. slam-chain.tsx/grid-lock.tsx use per-question 30s countdown that resets on advance. overlap.tsx/club-ladder.tsx use 100ms intervals with ref-based sub-second precision. Unifying these would require a complex hook with many options, and the risk of subtle timer bugs outweighs the benefit.

- **Start screen wrapper** -- While the layout skeleton is similar, each game's start screen has different rules content, different icon components, different gradient values, and different numbers of rules. The amount of props needed to parameterize all this would make the component harder to maintain than the current duplication.

- **Game input form** -- The input forms are similar but several games have game-specific content below the input (overlap has scoring feedback, club-ladder has threshold display). The savings (~30 lines per game) don't justify the complexity.

- **Game header bar** -- Each game's header has different elements (guess count vs. skip indicators vs. combo badges). The layout isn't as uniform as it appears at first glance.

- **Streak/combo level functions** -- Different thresholds, different return shapes, different field sets per game. A generic version would be more complex than the per-game implementations.

- **Firebase query optimization** -- Performance improvement, not duplication. Track separately.
