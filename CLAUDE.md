# Player Chain Blitz

Sports trivia game site hosted at **drapk.in** via GitHub Pages.

## Tech Stack

- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS + shadcn/ui (Radix primitives)
- **Routing:** Wouter (client-side SPA)
- **Animation:** Framer Motion
- **Sound:** Web Audio API (oscillators, no audio files)
- **State:** React hooks (no global store), TanStack React Query for async
- **Icons:** Lucide React

## Project Structure

```
client/src/
├── App.tsx              # Router setup (wouter Switch/Route)
├── main.tsx             # Entry point
├── index.css            # Tailwind base + custom styles
├── pages/
│   ├── home.tsx         # Game picker landing page
│   ├── game.tsx         # GoalChain (PL goalscorer chain game)
│   ├── slam-chain.tsx   # Slam16 (Grand Slam tennis players)
│   ├── target-man.tsx   # TargetMan (match target goal numbers)
│   ├── grid-lock.tsx    # GridLock (F1 points scorers)
│   └── not-found.tsx
├── data/
│   ├── players.ts       # 2,859 PL goalscorers {lastName, firstName, displayName, goals}
│   ├── slams.ts         # Grand Slam tournament data
│   └── f1seasons.ts     # F1 season/driver data
├── lib/
│   ├── game-themes.ts   # Reusable color theme system (emerald, warm, racing)
│   ├── sounds.ts        # All game sounds via Web Audio API
│   ├── utils.ts         # cn() helper (clsx + tailwind-merge)
│   └── queryClient.ts
├── components/ui/       # 48 shadcn/ui components (do not edit manually)
└── hooks/
    ├── use-mobile.tsx
    └── use-toast.ts
```

Config files at repo root:
- `vite.config.ts` — root is `client/`, output is `dist/`
- `tailwind.config.ts` — custom theme, animations
- `tsconfig.json` — strict mode, `@/` alias → `client/src/`
- `package.json` — scripts: `dev`, `build`, `check`, `preview`

## Routes

| Path | Component | Game |
|------|-----------|------|
| `/` | Home | Game picker |
| `/goalchain` | Game | Chain PL scorers by last letter of surname |
| `/slamchain` | SlamChain | Name Grand Slam tennis players |
| `/targetman` | TargetMan | Match target goal numbers with PL scorers |
| `/gridlock` | GridLock | Name F1 drivers who scored points |

## Game Themes

Defined in `lib/game-themes.ts`. Each game uses a theme for consistent colors:
- **emerald** — GoalChain, SlamChain (green/primary)
- **warm** — TargetMan (orange/amber)
- **racing** — GridLock (red/orange)

When adding UI to a game page, use its theme colors. Don't introduce unrelated colors (e.g., no violet in TargetMan's orange theme).

## Sound System

All sounds in `lib/sounds.ts` use Web Audio API oscillators. Key exports:
- `playCorrect/Wrong/Tick/GameEnd` — shared across games
- `playScoreSound(opts)` — TargetMan's unified sound (scales layers by score)
- `playComboCorrect(streak)` — ascending pitch with combo
- `playHighScore()` — celebration arpeggio
- Helper layers: `playBassThump`, `playShimmer`, `playChord`

## Deployment

**Auto-deploys on push to `main`** via GitHub Actions (`.github/workflows/deploy.yml`).

### To deploy changes:
1. `git add <files>` — stage changed files
2. `git commit -m "message"` — commit
3. `git push` — push to main; GitHub Actions builds and deploys automatically
4. Live at **drapk.in** within ~1 minute

### What the workflow does:
1. `npm install` (no lockfile, so `npm ci` won't work)
2. `npm run build`
3. Copies `dist/index.html` → `dist/404.html` (SPA fallback routing)
4. Deploys `dist/` to GitHub Pages

### DNS
Domain **drapk.in** configured via GoDaddy:
- 4 A records pointing to GitHub Pages IPs (185.199.108–111.153)
- CNAME configured in GitHub Pages settings

## Development

```bash
npm install    # install deps
npm run dev    # start dev server
npm run build  # production build
npm run check  # TypeScript type checking
```

## Conventions

- Each game is a single self-contained page file (game logic + UI together)
- Player name normalization and lookup (`normalizeName`, `buildPlayerLookup`) is duplicated per game page — not shared
- No backend/API — all data is bundled client-side in `data/` files
- No lockfile in repo — use `npm install` not `npm ci`
- Buttons use shadcn Button component with theme-specific className overrides
- Always commit and push after making changes — the user expects to see updates live on drapk.in
