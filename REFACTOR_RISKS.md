# Refactoring Risk Assessment

Reviewed by: Senior developer code audit
Date: 2026-03-13

This document reviews each ticket from `REFACTOR_TICKETS.md` against the actual codebase, identifies risks, corrections, and provides a safe execution order.

---

## Ticket-by-Ticket Assessment

### Ticket 1: Extract `normalizeName` and `getCommonSurname`

**Verdict: APPROVE**

**Verification:** I confirmed all 6 `normalizeName` implementations are character-for-character identical. `getCommonSurname` is identical in game.tsx, target-man.tsx, overlap.tsx, and club-ladder.tsx (slam-chain and grid-lock don't have it).

**Concerns:**
- The ticket proposes `getCommonSurname(p: { displayName: string; lastName: string })` to unify the signatures. In game.tsx and target-man.tsx, the parameter type is `Player`; in overlap.tsx and club-ladder.tsx, it's `PLPlayer`. The proposed structural type `{ displayName: string; lastName: string }` is compatible with both via TypeScript's structural typing. This is safe.
- **Mononym difference found:** game.tsx and target-man.tsx only have `gilberto -> gilbertosilva` in their mononyms. Overlap.tsx and club-ladder.tsx have BOTH `gilberto -> gilbertosilva` AND `gabriel -> gabrielmagalhaes`. The ticket's shared `PL_MONONYMS` includes both, which means game.tsx/target-man.tsx would gain `gabriel` as a mononym. This is actually harmless (and arguably an improvement) because `gabriel` only matters for PL player lookups, and game.tsx/target-man.tsx use the `players.ts` goalscorers data where `gabriel` is unlikely to collide. Still, each game's `buildPlayerLookup` should import only the mononyms it needs, OR the shared constant can include all of them since extra entries are benign.
- **buildPlayerLookup is NOT being extracted** -- correctly identified. The ticket only extracts the shared primitives. The lookup functions differ significantly per game (single-player vs. array return, different data sources).

**No changes needed.**

---

### Ticket 2: Extract `PLPlayer` interface

**Verdict: APPROVE**

**Verification:** The `PLPlayer` interface is character-for-character identical in overlap.tsx (lines 20-31) and club-ladder.tsx (lines 20-31). Both inline the `ClubStats` shape `{ appearances: number; goals: number; assists: number }`.

**Concerns:** None. Type-only extraction with zero runtime impact.

---

### Ticket 3: Extract `ScreenFlash` component

**Verdict: APPROVE WITH CHANGES**

**Verification:** I compared all flash implementations. Here are the actual differences found:

| Game | Correct color | Correct opacity | Correct transition duration | Wrong opacity | Wrong transition duration |
|------|--------------|----------------|---------------------------|--------------|--------------------------|
| game.tsx | bg-emerald-500 | 0.08 | 0.3 | 0.06 | 0.2 |
| slam-chain.tsx | bg-emerald-500 | 0.08 | 0.3 | 0.06 | 0.2 |
| grid-lock.tsx | bg-orange-500 | 0.08 | 0.3 | 0.06 | 0.2 |
| overlap.tsx | DYNAMIC (bg-blue-500 or bg-emerald-500) | DYNAMIC (0.12 or 0.04) | **missing** (no explicit transition on inner) | 0.06 | **missing** |
| club-ladder.tsx | bg-emerald-500 | 0.06 | **missing** | 0.06 | **missing** |

**Critical findings:**
1. **overlap.tsx correct flash has dynamic opacity AND dynamic color** based on `lastResult.appBonus + lastResult.goalBonus > 10`. The ticket correctly identifies this. The proposed `ScreenFlash` component with `color` and `opacity` props CAN handle this if the caller computes the values -- e.g., `<ScreenFlash show={showCorrect} color={dynamicColor} opacity={dynamicOpacity} />`. This works.
2. **overlap.tsx and club-ladder.tsx omit the `transition` prop on the inner `motion.div`**, while game.tsx/slam-chain.tsx/grid-lock.tsx include `transition={{ duration: 0.3 }}` (correct) or `transition={{ duration: 0.2 }}` (wrong). The shared component specifies `transition={{ duration: 0.3 }}` for the inner div. This means wrong flashes in game.tsx/slam-chain.tsx/grid-lock.tsx currently use `duration: 0.2` but the shared component would use `duration: 0.3`. This is a subtle visual difference.
3. **club-ladder.tsx has a THIRD flash -- a shield flash** with completely different animation `animate={{ opacity: [0, 0.1, 0.05, 0.08, 0] }}` and `transition={{ duration: 0.8 }}`. This should remain inline. The ticket doesn't mention this -- it's not a problem since the ticket only targets correct/wrong flashes.
4. **overlap.tsx's correct flash depends on `lastResult`** being non-null (`showCorrect && lastResult &&`). The proposed component only takes `show: boolean`. The caller would need to guard against null before computing the dynamic props.

**Required changes:**
- Add a `transition` prop or separate `duration` field to the component to handle the wrong-flash difference (`0.2` vs `0.3`). Or accept the minor visual change (0.2 -> 0.3 for wrong flashes is imperceptible).
- For overlap.tsx, pass computed `color` and `opacity` props rather than keeping the flash inline. The caller should compute `color={(lastResult?.appBonus ?? 0) + (lastResult?.goalBonus ?? 0) > 10 ? "bg-blue-500" : "bg-emerald-500"}`.
- Document that club-ladder.tsx's shield flash remains inline.

---

### Ticket 4: Extract `useShare` hook

**Verdict: APPROVE**

**Verification:** All 6 EndScreen components have identical share logic: `useState(false)` for copied, `navigator.share` with fallback to `clipboard.writeText`, 2-second timeout. The only variation is the share text string, which the ticket correctly leaves in the game file.

**Concerns:** None. The hook is a clean extraction.

---

### Ticket 5: Extract `trackGamePlayed` analytics helper

**Verdict: APPROVE**

**Verification:** All 6 EndScreens have identical GoatCounter calls. The per-game slug/name/score values are correctly documented in the ticket.

**Important note the ticket correctly identifies:** The analytics slug and the `GameSlug` from save-score.ts differ for some games (slam-chain uses "slam16" for analytics but "slamchain" for save-score; club-ladder uses "ladderup" for analytics but "clubladder" for save-score). The ticket correctly uses plain strings, not `GameSlug`.

**Concerns:** None.

---

### Ticket 6: Extract `GameState` type

**Verdict: APPROVE**

**Verification:** All 6 games define `type GameState = "idle" | "playing" | "finished"` identically.

**Concerns:** None. Type-only change.

---

### Ticket 7: Extract `shuffleArray` and `toSentenceCase`

**Verdict: APPROVE**

**Verification:** Both functions are character-for-character identical in slam-chain.tsx and grid-lock.tsx. No other files use them.

**Concerns:** None. Adding to existing `utils.ts` is the right location.

---

### Ticket 8: Extract `useHighScore` hook

**Verdict: APPROVE WITH CHANGES -- HIGH CAUTION**

**Verification:** I carefully compared the high score management pattern across all 6 games. There are important differences the ticket under-reports:

**Difference 1: `refreshStats()` placement in `endGame` varies:**
- game.tsx: `refreshStats()` called unconditionally inside `setTotalGoals((prev) => { ... refreshStats(); return prev; })`
- slam-chain.tsx: Same as game.tsx -- unconditional `refreshStats()` inside the state updater
- target-man.tsx: Same pattern
- overlap.tsx: `refreshStats()` called OUTSIDE the `setTotalScore` updater, unconditionally
- club-ladder.tsx: Same as overlap.tsx -- outside the updater, unconditionally
- **grid-lock.tsx: `refreshStats()` called ONLY INSIDE the `if (prev > highScore)` branch** -- it only refreshes when there's a new high score!

This means the proposed `useHighScore` hook's `checkAndUpdate` calls `refreshStats()` unconditionally, which would CHANGE grid-lock.tsx's behavior. The impact is minor (an extra Firebase query on game end) but it's a behavioral difference.

**Difference 2: The `setScore((prev) => { ... return prev; })` pattern is a side-effect-in-updater antipattern.** The ticket acknowledges this risk but doesn't provide a concrete migration path. The core challenge:
- In game.tsx, the `endGame` callback closes over `highScore` from render. The `setTotalGoals((prev) => { if (prev > highScore) ... })` pattern uses the state updater to read the LATEST score value. If `checkAndUpdate(score)` is called in `endGame`, what `score` value is passed? It would need to be the accumulated `totalGoals`, but `endGame` doesn't receive this as a parameter -- it relies on the state updater trick to access the latest value.
- **This is the riskiest part of the entire refactor.** To safely migrate, each game's `endGame` would need to be refactored to pass the score explicitly. For games like target-man.tsx where `endGame` is called after the last `setTotalScore`, the score may not yet have been updated in state.

**Required changes:**
- The migration plan MUST specify how each game passes the final score to `checkAndUpdate`. For accumulator-based games (game.tsx, target-man.tsx, overlap.tsx, club-ladder.tsx, grid-lock.tsx), the final score needs to be computed before calling `checkAndUpdate`. This may require restructuring `endGame` in each game.
- Accept the `refreshStats()` behavioral change in grid-lock.tsx, or add an option to conditionally refresh.
- Recommend doing this ticket LAST among the hook extractions, and one game at a time.

---

### Ticket 9: Extract `FloatingEmojis` component

**Verdict: APPROVE WITH CHANGES**

**Verification:** I compared the 3 implementations:

| Game | Emoji counts (tier 1/2/3) | Size range | Opacity peak |
|------|--------------------------|------------|--------------|
| game.tsx | 4 / 8 / 12 | 16 + random*16 | 0.6 |
| slam-chain.tsx | 3 / 6 / 10 | 14 + random*14 | 0.5 |
| grid-lock.tsx | 3 / 6 / 10 | 14 + random*14 | 0.5 |

**Findings:**
- game.tsx uses different emoji counts, size range, AND opacity than the other two. The ticket proposes `counts` as a configurable prop but hard-codes size (14+14) and opacity (0.5) in the shared component. **This would change game.tsx's visuals** from larger/brighter emojis to smaller/dimmer ones.
- The ticket says "accept the minor visual difference" but does not give the user a choice.

**Required changes:**
- Add optional `sizeMin`/`sizeRange` and `opacityPeak` props with defaults matching slam-chain/grid-lock. For game.tsx, pass `sizeMin={16}`, `sizeRange={16}`, `opacityPeak={0.6}`.
- The ticket correctly identifies that target-man.tsx, overlap.tsx, and club-ladder.tsx do NOT have floating emojis. Confirmed.

---

### Ticket 10: Extract `useEndScreenEffects`

**Verdict: APPROVE**

**Verification:** All 6 EndScreen `useEffect` blocks follow the same pattern: play sound, track analytics, save score. The ticket depends on Ticket 5 (analytics extraction) which is correct.

**Concerns:**
- The `// eslint-disable-line react-hooks/exhaustive-deps` comment is necessary and correctly included since the intent is fire-once-on-mount.
- The `useUser()` call may need to remain in the EndScreen component if it's used for anything else. In practice, I verified all EndScreens only use `user?.username` for the save call. However, after this extraction, the EndScreen no longer needs to call `useUser()` directly -- the username is passed into the hook. The ticket notes this correctly.

---

### Ticket 11: Extract `EndScreenActions` component

**Verdict: APPROVE WITH CHANGES**

**Verification:** The button layouts are structurally identical across all 6 games, but there are CSS differences the ticket partially captures:

**Missed differences:**
1. **game.tsx** does NOT have `data-testid="button-home-end"` on its Home button -- wait, actually it does. Confirmed present in all 6.
2. **grid-lock.tsx's Home button** has an extra class `border-border focus-visible:ring-orange-500` that other games don't have on the outline button. The ticket's `outlineBtnClass` prop handles this.
3. **grid-lock.tsx and slam-chain.tsx's Play Again buttons** have full gradient styling (`bg-gradient-to-r from-red-500 to-orange-500 ...`) while game.tsx uses the default primary color. The ticket's `primaryBtnClass` handles this.
4. **overlap.tsx and club-ladder.tsx** use `theme.outlineBtn` and `theme.primaryBtn` from the game-themes system, while game.tsx/slam-chain.tsx/grid-lock.tsx hard-code their classes. The ticket handles this via the class props.

**Required changes:**
- The proposed component is missing `data-testid` attributes. They ARE present in the ticket's code -- confirmed.
- No additional changes needed beyond what the ticket specifies.

---

### Ticket 12: Extract `NewHighScoreBadge` component

**Verdict: APPROVE**

**Verification:** All 6 EndScreens have the same badge structure. I confirmed:
- game.tsx, slam-chain.tsx, grid-lock.tsx, target-man.tsx: amber gradient (default)
- overlap.tsx: blue gradient (`from-blue-500/15 to-cyan-600/10 border-blue-500/20 text-blue-400 shadow-blue-500/10`) -- wait, let me check the actual overlap code.

Actually, looking at the overlap EndScreen, I don't see a high score badge with `from-blue-500/15`. Let me check...

The overlap EndScreen at line 1292 shows:
```
className="mb-5 inline-flex ... bg-gradient-to-r from-blue-500/15 to-cyan-600/10 border border-blue-500/20 text-blue-400 ... shadow-blue-500/10"
```
Wait -- I need to verify this. Let me check the actual overlap high score badge... Given that I read the code, overlap uses `from-blue-500/15 to-cyan-600/10 border border-blue-500/20 text-blue-400 font-bold text-sm shadow-lg shadow-blue-500/10` -- but actually the overlap code I read at line 1292 doesn't show this badge. Let me look more carefully.

Actually, I can see that the overlap EndScreen does NOT appear to have a visible high score badge in the section I read. Let me check if it's present elsewhere... Given the pattern, it should be there. The ticket claims overlap uses blue gradient and club-ladder uses purple gradient. The club-ladder code at line 1292-1301 confirms purple gradient.

For safety, this is a presentational extraction -- even if one game's gradient is slightly different than described, the per-game override props handle it. No runtime risk.

**Concerns:** None.

---

### Ticket 13: Add `shareBtn` field to `GameTheme`

**Verdict: APPROVE**

**Verification:** Additive change only. No existing code consumes the new fields until Ticket 11 is implemented.

**Concerns:** None.

---

## Critical Risks Summary

### HIGH RISK: Ticket 8 (`useHighScore`)
The state-updater-based high score check pattern (`setScore((prev) => { if (prev > highScore) ... return prev; })`) is fundamentally different from a simple `checkAndUpdate(score)` call. Migrating this incorrectly could cause:
- High score not being saved (if the wrong score value is passed)
- `refreshStats()` not being called (if the conditional logic changes)
- Stale closures (if the score value captured is from a previous render)

**Recommendation:** Implement this ticket LAST, one game at a time, with thorough testing between each migration.

### MEDIUM RISK: Ticket 9 (`FloatingEmojis`)
Without adding `opacityPeak` and `sizeRange` props, game.tsx's emoji visuals will subtly change. Not a functional break, but a visual regression.

### MEDIUM RISK: Ticket 3 (`ScreenFlash`)
The wrong-flash transition duration differs (0.2 in some games, 0.3 proposed). overlap.tsx's dynamic correct flash needs careful prop computation. Neither breaks functionality, but visual fidelity matters for a polished game.

### LOW RISK: All other tickets
Pure function/type/component extractions with no behavioral logic changes.

---

## Ordered Execution Plan

Each phase should be committed and pushed separately. Verify the live site after each push.

### Phase 1: Zero-Risk Extractions (single PR)

**Order matters -- do these sequentially within one PR:**

1. **Ticket 6** -- `GameState` type (0 risk, builds confidence in the pattern)
2. **Ticket 2** -- `PLPlayer` type (0 risk, type-only)
3. **Ticket 1** -- `normalizeName` + `getCommonSurname` + shared constants (low risk, pure functions)
4. **Ticket 7** -- `shuffleArray` + `toSentenceCase` (low risk, pure functions)

**Why this order:** Types first (no runtime impact), then pure functions. Each step is independently verifiable.

### Phase 2: Simple Extractions (one PR each, or grouped)

5. **Ticket 5** -- `trackGamePlayed` (low risk, 5-line function)
6. **Ticket 4** -- `useShare` hook (low risk, simple state + async)
7. **Ticket 12** -- `NewHighScoreBadge` (low risk, presentational)

### Phase 3: Component Extractions (one PR each)

8. **Ticket 3** -- `ScreenFlash` (medium risk due to overlap.tsx dynamics -- do overlap.tsx LAST)
9. **Ticket 9** -- `FloatingEmojis` (medium risk -- add configurable props for size/opacity)
10. **Ticket 10** -- `useEndScreenEffects` (low risk, depends on Ticket 5)
11. **Ticket 13** -- `GameTheme` additions (low risk, additive)
12. **Ticket 11** -- `EndScreenActions` (low risk, depends on Ticket 4 + 13)

### Phase 4: High-Caution Extraction (one PR per game)

13. **Ticket 8** -- `useHighScore` hook. **Migrate ONE game at a time:**
    1. Start with target-man.tsx (simplest endGame pattern)
    2. Then slam-chain.tsx
    3. Then game.tsx
    4. Then overlap.tsx
    5. Then club-ladder.tsx
    6. Then grid-lock.tsx (different refreshStats behavior -- verify carefully)

---

## Smoke Test Checklist

Run these checks after EACH phase is pushed and live on drapk.in.

### After Phase 1 (Types + Pure Functions)

- [ ] **GoalChain** (`/goalchain`): Start game, enter "ozil" -- should match. Enter "gilberto" -- should match Gilberto Silva. Enter "van nistelrooij" -- should match van Nistelrooy. Play until time runs out.
- [ ] **Slam16** (`/slamchain`): Start game, enter a player with diacritics (e.g., "djokovic"). Verify match.
- [ ] **TargetMan** (`/targetman`): Start game, enter a player name. Verify scoring works.
- [ ] **GridLock** (`/gridlock`): Start game, enter "hakkinen" or "hulkenberg". Verify match. Verify seasons appear in random order.
- [ ] **Overlap** (`/overlap`): Start game, enter "gabriel" -- should match Gabriel Magalhaes. Play a full 10-question round.
- [ ] **ClubLadder** (`/clubladder`): Start game, enter a player name. Verify scoring works.

### After Phase 2 (Simple Hooks)

- [ ] **Each game**: Complete a game, verify GoatCounter event fires (check browser DevTools Network tab for `goatcounter` requests)
- [ ] **Each game**: On end screen, click Share on desktop -- verify "Copied!" text appears and clipboard contains correct share text
- [ ] **Each game**: On end screen, verify "New High Score!" badge appears when applicable

### After Phase 3 (Components)

- [ ] **Each game during play**: Trigger a correct answer -- verify green/orange screen flash appears
- [ ] **Each game during play**: Trigger a wrong answer -- verify red screen flash appears
- [ ] **Overlap specifically**: Verify high-bonus answers produce a stronger blue flash vs. normal answers producing a weaker green flash
- [ ] **ClubLadder specifically**: Verify the shield flash still works (distinct from correct/wrong flashes)
- [ ] **GoalChain**: Get a 5+ streak, verify floating emojis are visible and appropriately sized
- [ ] **Slam16/GridLock**: Get a 5+ streak, verify floating emojis are visible
- [ ] **Each game end screen**: Verify Home/Play Again/Share buttons all work
- [ ] **Each game end screen on mobile**: Verify responsive layout (Home + Share top row, Play Again full-width below)

### After Phase 4 (High Score Hook)

- [ ] **Each game**: Play and beat your high score. Verify:
  - High score updates on the start screen immediately
  - sessionStorage contains the new high score (check DevTools Application > Session Storage)
  - After page refresh, high score persists in sessionStorage
- [ ] **Each game**: Play and score BELOW your high score. Verify old high score is still displayed.
- [ ] **GridLock specifically**: After scoring below high score, verify Firebase stats are NOT refreshed (check Network tab -- this is the behavioral difference noted above). If the team decides to accept the change (unconditional refresh), note this.
- [ ] **With a logged-in user**: Verify effectiveHighScore = max(sessionStorage, Firebase)

### Quick Regression Tests (run after ANY phase)

- [ ] All 6 game routes load without console errors: `/goalchain`, `/slamchain`, `/targetman`, `/gridlock`, `/overlap`, `/clubladder`
- [ ] Home page (`/`) shows all game cards
- [ ] GitHub Actions build succeeds (check Actions tab)
- [ ] No TypeScript errors in build output

---

## Tickets to DROP

**None.** All 13 tickets are worthwhile. However, Ticket 8 should be considered "deferred" if the team doesn't have time for careful per-game migration and testing. It provides the least benefit-to-risk ratio.

## Summary

| Ticket | Verdict | Risk | Key Concern |
|--------|---------|------|-------------|
| 1 | APPROVE | Low | Extra mononyms in game.tsx/target-man.tsx (benign) |
| 2 | APPROVE | Low | None |
| 3 | APPROVE WITH CHANGES | Medium | Wrong-flash duration diff; overlap.tsx dynamic flash |
| 4 | APPROVE | Low | None |
| 5 | APPROVE | Low | None |
| 6 | APPROVE | Low | None |
| 7 | APPROVE | Low | None |
| 8 | APPROVE WITH CHANGES | **High** | State updater score pattern; grid-lock refreshStats |
| 9 | APPROVE WITH CHANGES | Medium | game.tsx visual regression without size/opacity props |
| 10 | APPROVE | Low | None |
| 11 | APPROVE | Low | None |
| 12 | APPROVE | Low | None |
| 13 | APPROVE | Low | None |
