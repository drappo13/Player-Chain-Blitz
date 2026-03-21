# Player Chain Blitz

Sports trivia game site hosted at **drapk.in** via GitHub Pages.

## Quick Reference

- **Live site:** https://drapk.in
- **Repo:** Public on GitHub
- **Deploy:** Auto on push to `main` (~1 min via GitHub Actions)
- **Architecture doc:** See `docs/ARCHITECTURE.md` for full technical context

## Tech Stack

- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS + shadcn/ui (Radix primitives)
- **Routing:** Wouter (client-side SPA)
- **Animation:** Framer Motion
- **Sound:** Web Audio API (oscillators, no audio files)
- **State:** React hooks (no global store), TanStack React Query for async
- **Database:** Firebase Firestore (scores, users, daily-scores)
- **Icons:** Lucide React

## Critical Rules

1. **Each game is a single self-contained page file** — game logic + UI together in one file under `client/src/pages/`
2. **No backend** — all game data is bundled client-side. Firebase is only used for scores/users/leaderboards
3. **Builds happen in GitHub Actions only** — Kandji MDM blocks local `npm install`. Commit + push to verify builds
4. **No lockfile** — use `npm install` not `npm ci`
5. **Always commit and push after changes** — the user expects to see updates live immediately
6. **Don't edit `components/ui/`** — these are shadcn/ui generated components
7. **Use game themes** — newer games use `lib/game-themes.ts` for consistent colors (TargetMan, Overlap, ClubLadder, Griddle). Older games (GoalChain, SlamChain, GridLock) use inline color classes. Either way, don't introduce unrelated colors for a game
8. **Player name lookup** — shared normalization in `lib/normalize.ts`, each game builds its own lookup Map. Some games use `Map<string, PLPlayer[]>` (arrays), others use `Map<string, Player>` (single value) — the priority mononym handling differs between these
9. **SPA single bundle** — a crash in ANY module kills ALL pages. Always verify imports don't break other games
10. **Pin dependency versions** — no lockfile means `^` ranges can pull breaking versions. Pin exact if issues arise

## Game Types

There are two categories of games:

### Daily Games (play once per day, submit score)
- **Griddle** (`/griddle`) — Daily 3×3 PL club grid, name players for 2+ clubs

### Arcade Games (play anytime, replayable)
- **TargetMan** (`/targetman`) — Match target goal numbers
- **Overlap** (`/overlap`) — Name players who appeared for both shown clubs
- **ClubLadder** (`/clubladder`) — Climb goal thresholds across 3 clubs
- **GoalChain** (`/goalchain`) — Chain PL scorers by last letter of surname
- **Slam16** (`/slamchain`) — Name Grand Slam tennis players
- **GridLock** (`/gridlock`) — Name F1 points scorers

## Development

```bash
npm install    # install deps
npm run dev    # start dev server (if not blocked by MDM)
npm run build  # production build
npm run check  # TypeScript type checking
```

If a build fails after push, check GitHub Actions log and fix forward.

## Keeping Docs Updated

When pushing changes, update `docs/ARCHITECTURE.md` if you:
- Add a new game, route, or page
- Add or change a Firebase collection or its structure
- Change the scoring system or game mechanics
- Add a new shared library, hook, or component
- Change the build/deploy pipeline
- Add a new data source or modify data model

Do NOT update docs for: copy changes, bug fixes, styling tweaks, name lookups, or minor UI adjustments. Only document things that would meaningfully help a future agent understand the codebase.

## Key Files to Read First

When starting work, read these to understand the codebase:
1. **This file** — conventions and rules
2. **`docs/ARCHITECTURE.md`** — full technical context, Firebase setup, game patterns, data model
3. **The specific game page** you're modifying (e.g., `client/src/pages/griddle.tsx`)
4. **`client/src/lib/normalize.ts`** — player name normalization (shared across all PL games)
5. **`client/src/lib/game-themes.ts`** — color theme system
6. **`client/src/lib/sounds.ts`** — sound effects API
