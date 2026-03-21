# Player Chain Blitz

Sports trivia game site at **drapk.in** — React SPA deployed via GitHub Pages.

> **Full technical context:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

---

## Must-Read Rules

1. **One game = one file.** Each game is self-contained in `client/src/pages/`. Don't split game logic into separate files.
2. **No backend.** All game data is bundled client-side. Firebase is scores/users/leaderboards only.
3. **Builds are remote only.** Kandji MDM blocks local `npm install`. Commit + push → GitHub Actions builds → live in ~1 min.
4. **No lockfile.** Use `npm install`, not `npm ci`. Pin exact versions if a dep breaks.
5. **Push = deploy.** The user expects changes live immediately after push to `main`.
6. **Don't edit `components/ui/`.** These are generated shadcn/ui components.
7. **SPA = shared bundle.** A crash in ANY module kills ALL pages. Always verify imports.
8. **New Firebase collections need rules.** Firestore blocks all access to unlisted collections. Rules are in Firebase Console, not in repo.

## Games

| Route | File | Type | Description |
|-------|------|------|-------------|
| `/griddle` | `griddle.tsx` | Daily | 3×3 PL club grid, name players for 2+ clubs |
| `/targetman` | `target-man.tsx` | Arcade | Match target goal numbers |
| `/overlap` | `overlap.tsx` | Arcade | Name players who appeared for both clubs |
| `/clubladder` | `club-ladder.tsx` | Arcade | Climb goal thresholds across 3 clubs |
| `/goalchain` | `game.tsx` | Arcade | Chain PL scorers by last letter of surname |
| `/slamchain` | `slam-chain.tsx` | Arcade | Name Grand Slam tennis players |
| `/gridlock` | `grid-lock.tsx` | Arcade | Name F1 points scorers |

## Tech Stack

React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Wouter, Framer Motion, Web Audio API, Firebase Firestore, Lucide React

## Commands

```bash
npm install    # install deps
npm run dev    # dev server
npm run build  # production build
npm run check  # TypeScript check
```

## When to Update Docs

Update `docs/ARCHITECTURE.md` when you:
- Add a new game, route, Firebase collection, or shared component
- Change scoring mechanics, data models, or the build pipeline

Skip updates for: copy changes, bug fixes, styling tweaks, player name additions.

## Where to Look

| Need to understand... | Read... |
|---|---|
| Full architecture & Firebase | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Player name matching | `client/src/lib/normalize.ts` |
| Color themes | `client/src/lib/game-themes.ts` |
| Sound effects | `client/src/lib/sounds.ts` |
| Score saving (arcade) | `client/src/lib/save-score.ts` |
| Score saving (daily) | `client/src/lib/daily-score.ts` |
| Adding a new game checklist | [`docs/ARCHITECTURE.md` → "Adding a New Game"](docs/ARCHITECTURE.md#adding-a-new-game) |
