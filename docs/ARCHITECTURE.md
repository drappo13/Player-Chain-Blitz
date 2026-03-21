# Architecture & Technical Context

## Project Structure

```
client/src/
├── App.tsx                    # Router (wouter Switch/Route) — ALL routes defined here
├── main.tsx                   # Entry point
├── index.css                  # Tailwind base + custom styles
├── pages/
│   ├── home.tsx               # Game picker landing page
│   ├── griddle.tsx            # Griddle (daily 3×3 PL club grid)
│   ├── target-man.tsx         # TargetMan (match target goal numbers)
│   ├── overlap.tsx            # Overlap (shared PL club appearances)
│   ├── club-ladder.tsx        # ClubLadder (climb goal thresholds)
│   ├── game.tsx               # GoalChain (chain PL scorers by surname)
│   ├── slam-chain.tsx         # Slam16 (Grand Slam tennis players)
│   ├── grid-lock.tsx          # GridLock (F1 points scorers)
│   ├── leaderboard.tsx        # Leaderboard page (Daily / Arcade tabs)
│   └── not-found.tsx
├── data/
│   ├── players.ts             # 2,859 PL goalscorers (GoalChain + TargetMan)
│   ├── pl-players.json        # 5,107 PL players with per-club stats (Overlap, Griddle, ClubLadder)
│   ├── pl-player-types.ts     # PLPlayer TypeScript interface
│   ├── slams.ts               # Grand Slam tournament data (Slam16)
│   └── f1seasons.ts           # F1 season/driver data (GridLock)
├── lib/
│   ├── normalize.ts           # Player name normalization, mononyms, alternates
│   ├── game-themes.ts         # Color theme system (emerald, warm, racing, overlap, ladder)
│   ├── sounds.ts              # All sounds via Web Audio API oscillators
│   ├── game-types.ts          # Shared GameState type ("idle" | "playing" | "finished")
│   ├── firebase.ts            # Firebase app init + Firestore instance (API key is public by design)
│   ├── save-score.ts          # Arcade game score saving (GameSlug type defined here)
│   ├── daily-score.ts         # Daily game score submission + leaderboard fetching
│   ├── use-leaderboard.ts     # Hooks: useGameLeaderboard, useGlobalLeaderboard
│   ├── use-daily-leaderboard.ts # Hook: useDailyLeaderboard (today/yesterday)
│   ├── use-user-stats.ts      # Hook: useUserStats (per-game high scores + play counts)
│   ├── user-context.tsx        # UserProvider + useUser hook (auth via Firestore)
│   ├── queryClient.ts         # TanStack React Query client
│   └── utils.ts               # cn() helper (clsx + tailwind-merge)
├── components/
│   ├── ui/                    # ~48 shadcn/ui components (DO NOT edit manually)
│   ├── screen-flash.tsx       # Full-screen color flash on correct/wrong
│   ├── leaderboard-table.tsx  # LeaderboardTable + MiniLeaderboard components
│   ├── end-screen-actions.tsx # Shared end screen button layout
│   ├── new-high-score-badge.tsx # Animated high score badge
│   ├── floating-emojis.tsx    # Animated floating emojis (used by GoalChain, SlamChain, etc.)
│   ├── username-picker.tsx    # Login/signup modal
│   └── user-badge.tsx         # Logged-in user display
└── hooks/
    ├── use-high-score.ts      # Local + Firebase high score tracking
    ├── use-share.ts           # Web Share API / clipboard fallback
    ├── use-end-screen-effects.ts # End screen sound + score save
    ├── use-lock-scroll.ts     # Prevent scroll during input focus
    ├── use-toast.ts           # Toast notification hook
    └── use-mobile.tsx         # Mobile detection

scripts/
├── fetch-players.mjs          # Fetches PL player data from official API

Config (repo root):
├── vite.config.ts             # Root: client/, output: dist/
├── tailwind.config.ts         # Custom theme + animations
├── tsconfig.json              # Strict mode, @/ alias → client/src/
├── package.json               # Scripts: dev, build, check, preview
└── .github/workflows/deploy.yml  # GitHub Actions: build + deploy to Pages
```

## Firebase Setup

### Collections

**`users`** — One doc per user, doc ID = lowercase username
```
{ username: "fred", avatar: "⚽", createdAt: serverTimestamp() }
```

**`scores`** — Arcade game scores, auto-generated doc IDs
```
{ username: "fred", game: "targetman", score: 450, timestamp: serverTimestamp() }
```
- GameSlug type: `"goalchain" | "slamchain" | "targetman" | "gridlock" | "overlap" | "clubladder" | "griddle"`
- Note: GameSlug includes "griddle" but Griddle scores go to `daily-scores`, not `scores`. The slug is shared for stats/homepage compatibility
- One doc per play (not deduplicated — leaderboard deduplication is client-side)

**`daily-scores`** — Daily game submissions, auto-generated doc IDs
```
{
  username: "fred", game: "griddle", dateKey: "2026-03-21",
  score: 147, found: 23, total: 260,
  key: "griddle_2026-03-21_fred",   // composite key for single-field lookups
  timestamp: serverTimestamp()
}
```
- One submission per user per game per day (enforced client-side via `key` field query)
- The `key` field avoids needing Firestore composite indexes

### Firestore Security Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if false;
    }
    match /scores/{scoreId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if false;
    }
    match /daily-scores/{docId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if false;
    }
  }
}
```
- All collections: public read, public create, no update/delete
- New collections MUST be added to rules or all access is blocked
- Rules are managed in Firebase Console (not in repo)

### Firestore Index Requirements
- No composite indexes are configured — all queries use single-field `where` clauses
- Multi-field lookups use composite `key` fields (e.g., `daily-scores.key`)
- If you add a query with multiple `where` clauses on different fields, it WILL fail silently

## Game Architecture Patterns

### Arcade Games (TargetMan, Overlap, GoalChain, etc.)

All arcade games follow the same lifecycle:

```
GameState: "idle" → "playing" → "finished"
```

1. **Idle/Start screen** — title, rules, high score, "Start Game" button
2. **Playing** — timer, input, score, feedback. Header has Home + Info buttons
3. **Finished** — final score, high score badge, mini leaderboard, share, play again

Key patterns:
- `const [gameState, setGameState] = useState<GameState>("idle")`
- `useHighScore(sessionKey, gameSlug, username)` for high score tracking
- `useEndScreenEffects({ isNewHighScore, gameSlug, score, username })` fires sound + saves score on mount
- `MiniLeaderboard` component for end screen (self-contained, owns its own data fetch)
- `ScreenFlash` component for visual feedback on correct/wrong
- `playCorrect()` / `playWrong()` / `playNeutral()` for audio feedback

### Daily Games (Griddle)

Different lifecycle — no game-over, persistent state:

```
States: rules screen → playing → submitted (locked) → end screen
```

1. **Rules screen** — shown on first visit (skipped if progress exists)
2. **Playing** — no timer, input + flag button, score + tier badge, coverage bar
3. **Submitted** — input replaced with "View Results & Leaderboard" button
4. **End screen** — final score, tier, top missed players, daily leaderboard

Key patterns:
- State persisted to `localStorage` keyed by `griddle-{dateKey}`
- Board generated deterministically from date via seeded PRNG (mulberry32)
- `BOARD_VERSION` constant — bump to regenerate all boards (resets localStorage)
- `submitDailyScore()` writes to `daily-scores` collection (one per user per day)
- `hasDailySubmission()` checks for existing submission on load (cross-device support)
- Progress tiers: Kickoff → Squad Player → Sub → First Team → Key Player → Captain → Legend → Encyclopaedia

### Griddle-Specific: Board Generation

```
1. Hash date string + board version → seed
2. Seeded PRNG (mulberry32) → Fisher-Yates shuffle of 25 eligible clubs
3. Take first 9 clubs
4. Validate: ≥2 big six clubs AND ≥25 valid answers
5. If invalid, try next seed (up to 100 attempts)
```

Eligible clubs: top 25 PL clubs by total appearances (hardcoded list).

### Griddle-Specific: Scoring

- Base: 5 pts (2 clubs), 12 (3), 22 (4), 35 (5), 50 (6+)
- Adjacent bonus: 2× if all matched clubs form a connected group on the grid
- Line bonus: 5× for completing a row, column, or diagonal (highest multiplier wins)
- All-covered bonus: +25 one-time when all 9 clubs are touched
- Wrong answer: -1 for unknown players or players with 0 clubs on the board. Players with exactly 1 club on the board get a neutral response (no penalty)

## Player Name Normalization

Defined in `client/src/lib/normalize.ts`, used by all PL games:

- `normalizeName(name)` — strips accents, lowercase, removes hyphens/spaces/quotes
- `getCommonSurname(p)` — extracts last word of displayName
- `PL_MONONYMS` — single-name players mapped to normalized keys (e.g., "gilberto" → "gilbertosilva")
- `PL_PRIORITY_MONONYMS` — when a key matches multiple players, sort preferred player first (e.g., "cisse" → Djibril Cissé, "anderson" → Man Utd's Anderson)
- `PL_ALTERNATES` — alternate spellings (e.g., "kuyt" → "kuijt")

Each game builds its own lookup Map in `buildPlayerLookup()`:
- Overlap, Griddle, ClubLadder use `Map<string, PLPlayer[]>` (array — handles ambiguity)
- TargetMan, GoalChain use `Map<string, Player>` (single value — priority mononyms use `.set()` replacement)

**When adding a new player name override**, update `normalize.ts` — it propagates to all games automatically. But the lookup builder in each game must handle the type correctly (array vs single value).

## Leaderboard System

### Arcade Leaderboards
- Stored in `scores` collection
- Queried per-game with single `where("game", "==", slug)`
- Client-side: dedup by best score per user, filter by period (today/alltime)
- `useGameLeaderboard(game, period, max, delay)` hook
- `useGlobalLeaderboard(mode, period, max)` for cross-game aggregation

### Daily Leaderboards
- Stored in `daily-scores` collection
- Queried by `where("dateKey", "==", date)`, filtered by game client-side
- Periods: "today" and "yesterday" (not alltime)
- `useDailyLeaderboard(game, period, max, delay)` hook

### Leaderboard Page (`/leaderboard`)
Top-level toggle: **Daily** | **Arcade**
- Daily: today/yesterday toggle, per-game tabs (currently just Griddle)
- Arcade: All Games + per-game tabs, today/alltime toggle

## Deployment

**Auto-deploys on push to `main`** via GitHub Actions.

1. `npm install` (no lockfile)
2. `npm run build` (Vite)
3. Copies `dist/index.html` → `dist/404.html` (SPA fallback)
4. Deploys `dist/` to GitHub Pages
5. Live at **drapk.in** within ~1 minute

### DNS
Domain **drapk.in** configured via GoDaddy:
- 4 A records → GitHub Pages IPs (185.199.108–111.153)
- CNAME in GitHub Pages settings

### Common Build Issues
- **Dependency resolution** — no lockfile means `^` ranges can pull breaking versions. Pin exact if needed (e.g., `@tanstack/react-query` pinned to 5.60.5, vite pinned to ^6.3.5)
- **SPA crash = all pages black** — since all routes share one bundle, a crash in any module (even one not rendered) kills every page. Always check GitHub Actions log if all pages go black

## Data Sources

### Premier League API (PulseVive)
Public, unauthenticated API at `footballapi.pulselive.com`.

```
GET /football/stats/ranked/players/{STAT}?page={PAGE}&pageSize=100&comps=1&teams={TEAM_ID}&altIds=true
Header: Origin: https://www.premierleague.com
```

`scripts/fetch-players.mjs` fetches appearances, goals, assists across 51 teams → `pl-players.json`

### Data Gaps
The PL API data has known gaps (e.g., short stints may be missing). This is accepted — the game rules screen states "only PL apps count" and the data is what it is.

## Homepage

`client/src/pages/home.tsx` — Game picker with cards grouped by sport (Football, Tennis, F1).

Each card has:
- `mode: "daily" | "arcade"` — shown as a badge on the card
- `slug: GameSlug` — used for stats lookup
- Theme-colored icon, title gradient, play button

When adding a new game:
1. Add route in `App.tsx`
2. Add card in `home.tsx` (in the appropriate sport array)
3. Add slug to `GameSlug` in `save-score.ts`
4. Add slug to `ALL_GAMES` in `use-user-stats.ts`
5. If daily: add Firestore rules for collection, add to leaderboard page
