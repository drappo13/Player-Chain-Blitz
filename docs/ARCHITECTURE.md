# Architecture

## Table of Contents

- [File Structure](#file-structure)
- [Firebase](#firebase)
- [Arcade Game Pattern](#arcade-game-pattern)
- [Daily Game Pattern (Griddle)](#daily-game-pattern-griddle)
- [Player Name Normalization](#player-name-normalization)
- [Themes & Sounds](#themes--sounds)
- [Leaderboards](#leaderboards)
- [Data Sources](#data-sources)
- [Deployment](#deployment)
- [Adding a New Game](#adding-a-new-game)

---

## File Structure

```
client/src/
├── App.tsx                      # Router — ALL routes defined here
├── pages/
│   ├── home.tsx                 # Game picker (cards with Daily/Arcade tags)
│   ├── griddle.tsx              # Griddle (daily)
│   ├── target-man.tsx           # TargetMan (arcade)
│   ├── overlap.tsx              # Overlap (arcade)
│   ├── club-ladder.tsx          # ClubLadder (arcade)
│   ├── game.tsx                 # GoalChain (arcade)
│   ├── slam-chain.tsx           # Slam16 (arcade)
│   ├── grid-lock.tsx            # GridLock (arcade)
│   ├── leaderboard.tsx          # Leaderboard page (Daily/Arcade tabs)
│   └── not-found.tsx
├── data/
│   ├── players.ts               # 2,859 PL goalscorers (GoalChain, TargetMan)
│   ├── pl-players.json          # 5,107 PL players with per-club stats (Overlap, Griddle, ClubLadder)
│   ├── pl-player-types.ts       # PLPlayer interface
│   ├── slams.ts                 # Grand Slam data (Slam16)
│   └── f1seasons.ts             # F1 data (GridLock)
├── lib/
│   ├── normalize.ts             # Name normalization, mononyms, alternates
│   ├── game-themes.ts           # Color themes (emerald, warm, racing, overlap, ladder)
│   ├── game-types.ts            # Shared GameState type
│   ├── sounds.ts                # Web Audio API sounds
│   ├── firebase.ts              # Firebase init (API key is public by design)
│   ├── save-score.ts            # Arcade score saving + GameSlug type
│   ├── daily-score.ts           # Daily score submission + leaderboard fetch
│   ├── use-leaderboard.ts       # useGameLeaderboard, useGlobalLeaderboard hooks
│   ├── use-daily-leaderboard.ts # useDailyLeaderboard hook
│   ├── use-user-stats.ts        # useUserStats hook (per-game high scores)
│   ├── user-context.tsx         # UserProvider + useUser (auth via Firestore)
│   ├── queryClient.ts           # TanStack React Query client
│   └── utils.ts                 # cn() helper
├── components/
│   ├── ui/                      # shadcn/ui (DO NOT edit)
│   ├── screen-flash.tsx         # Full-screen flash on correct/wrong
│   ├── leaderboard-table.tsx    # LeaderboardTable + MiniLeaderboard
│   ├── end-screen-actions.tsx   # End screen button layout
│   ├── new-high-score-badge.tsx # High score badge
│   ├── username-picker.tsx      # Login/signup modal
│   └── user-badge.tsx           # User display
└── hooks/
    ├── use-high-score.ts        # Local + Firebase high score
    ├── use-share.ts             # Web Share API / clipboard
    ├── use-end-screen-effects.ts # End screen sound + save
    ├── use-lock-scroll.ts       # Prevent scroll on focus
    ├── use-toast.ts             # Toast notifications
    └── use-mobile.tsx           # Mobile detection

scripts/
└── fetch-players.mjs            # Fetches PL data from official API

Config (root):
├── vite.config.ts               # Root: client/, output: dist/
├── tailwind.config.ts           # Custom theme + animations
├── tsconfig.json                # Strict, @/ → client/src/
├── package.json                 # dev, build, check, preview
└── .github/workflows/deploy.yml # Build + deploy to Pages
```

---

## Firebase

### Collections

**`users`** — doc ID = lowercase username
```json
{ "username": "fred", "avatar": "⚽", "createdAt": "<serverTimestamp>" }
```

**`scores`** — arcade game scores, auto-generated IDs
```json
{ "username": "fred", "game": "targetman", "score": 450, "timestamp": "<serverTimestamp>" }
```
- `GameSlug`: `goalchain | slamchain | targetman | gridlock | overlap | clubladder | griddle`
- Note: `griddle` is in GameSlug for stats compatibility but Griddle scores go to `daily-scores`
- One doc per play. Leaderboard dedup is client-side.

**`daily-scores`** — daily game submissions, auto-generated IDs
```json
{
  "username": "fred", "game": "griddle", "dateKey": "2026-03-21",
  "score": 147, "found": 23, "total": 260,
  "key": "griddle_2026-03-21_fred",
  "timestamp": "<serverTimestamp>"
}
```
- `key` field = composite key for single-field lookups (avoids composite indexes)
- One per user/game/day, enforced client-side via `where("key", "==", ...)`

### Security Rules (Firebase Console)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}        { allow read, create: if true; allow update, delete: if false; }
    match /scores/{scoreId}      { allow read, create: if true; allow update, delete: if false; }
    match /daily-scores/{docId}  { allow read, create: if true; allow update, delete: if false; }
  }
}
```

**Key constraints:**
- New collections MUST be added to rules or all access silently fails
- No composite indexes configured — always use single-field `where` clauses
- Multi-field lookups use composite `key` fields instead

---

## Arcade Game Pattern

Lifecycle: `"idle"` → `"playing"` → `"finished"` (defined in `lib/game-types.ts`)

### Idle Screen
Title, rules, high score display, "Start Game" button.

### Playing Screen
- Header: Home button + Info button (returns to idle) + timer/question counter
- Input field with theme-colored focus ring
- `ScreenFlash` on correct/wrong + `playCorrect()`/`playWrong()` sounds
- Score display with combo/multiplier indicators

### Finished Screen
- Final score, `NewHighScoreBadge` (if applicable)
- `MiniLeaderboard` (self-contained, fetches its own data)
- `EndScreenActions` (Home, Play Again, Share)
- `useEndScreenEffects` fires sound + `saveScore()` on mount

### Key hooks
```
useHighScore(sessionKey, gameSlug, username) → { effectiveHighScore, checkAndUpdate }
useEndScreenEffects({ isNewHighScore, gameSlug, score, username })
useShare() → { share, copied }
```

---

## Daily Game Pattern (Griddle)

Lifecycle: Rules screen → Playing → Submitted (locked) → End screen

### Rules Screen
Shown on first visit (skipped if localStorage has progress). Rules + "Play" button.

### Playing Screen
- No timer. Input + flag button (submits score).
- 3×3 grid with hit counters + progressive dot colors
- Score (centred), found count, tier badge, coverage bar
- `playComboCorrect()` for 3+ club answers

### Submitted State
Input replaced with "View Results & Leaderboard" button. Board visible but locked.

### End Screen
Score + tier → Leaderboard (today/yesterday) → Top 20 missed players → "Come back tomorrow"

### Board Generation
```
dateStr + BOARD_VERSION → hash → mulberry32 PRNG → shuffle 25 eligible clubs → take 9
Validates: ≥2 big six clubs AND ≥25 valid answers. Retries up to 100 seeds.
```
`BOARD_VERSION` constant — bump to regenerate all boards and reset localStorage.

### Scoring
| Clubs matched | Base pts |
|---|---|
| 2 | 5 |
| 3 | 12 |
| 4 | 22 |
| 5 | 35 |
| 6+ | 50 |

- **Adjacent 2×**: all matched clubs form connected group on grid
- **Line 5×**: complete row, column, or diagonal (highest multiplier wins)
- **All-covered +25**: one-time bonus when all 9 clubs touched
- **Wrong answer -1**: unknown players or 0 clubs on board. 1 club = neutral (no penalty)

### Progress Tiers (% of valid answers)
Kickoff (1%) → Squad Player (2%) → Sub (4%) → First Team (8%) → Key Player (15%) → Captain (25%) → Legend (35%) → Encyclopaedia (50%)

### Persistence
- `localStorage` key: `griddle-{dateKey}`, includes `boardHash` for invalidation
- Firebase: single write via `submitDailyScore()` on "I'm Done"
- Cross-device: `hasDailySubmission()` checks Firebase on load

---

## Player Name Normalization

File: `client/src/lib/normalize.ts`

### Functions
- `normalizeName(name)` — strips accents, lowercase, removes hyphens/spaces/quotes, handles ß→ss, ø→o, etc.
- `getCommonSurname(p)` — last word of displayName

### Lookup Maps
Each game builds its own in `buildPlayerLookup()`:
- **Array lookups** (`Map<string, PLPlayer[]>`): Overlap, Griddle, ClubLadder — handles ambiguity, shows "be more specific"
- **Single-value lookups** (`Map<string, Player>`): TargetMan, GoalChain — takes first/priority match

### Special Mappings

**`PL_MONONYMS`** — single names mapped to normalized keys:
```
gilberto → gilbertosilva, gabriel → gabrielmagalhaes, eduardo → eduardodasilva, kepa → arrizabalaga
```

**`PL_PRIORITY_MONONYMS`** — when a key has multiple matches, prefer this displayName:
```
anderson → "Anderson" (Man Utd), cisse → "Djibril Cissé"
```
For array lookups: sorts preferred player first. For single-value lookups: replaces with preferred player.

**`PL_ALTERNATES`** — alternate spellings:
```
kuyt → kuijt, dirkkuyt → dirkkuijt, vannistelrooij → vannistelrooy
```

### Adding a player name override
Edit `normalize.ts` — changes propagate to all games automatically. No per-game changes needed.

---

## Themes & Sounds

### Themes (`lib/game-themes.ts`)
Each theme provides: `primaryBtn`, `outlineBtn`, `inputFocus`, `timerBar`, `timerIcon`, `accent`, `glowA`, `glowB`, `shareBtn`

| Theme | Used by | Colors |
|---|---|---|
| `emerald` | GoalChain*, SlamChain* | Green/primary |
| `warm` | TargetMan | Orange/amber |
| `racing` | GridLock* | Red/orange |
| `overlap` | Overlap, Griddle | Blue/cyan |
| `ladder` | ClubLadder | Purple/indigo |

*GoalChain, SlamChain, GridLock use inline colors, not the theme import.

### Sounds (`lib/sounds.ts`)
All Web Audio API oscillators — no audio files.

| Function | Use |
|---|---|
| `playCorrect()` | Standard correct answer |
| `playWrong()` | Wrong answer |
| `playNeutral()` | Neutral feedback (duplicate, 1-club match) |
| `playComboCorrect(streak)` | Ascending pitch, used for multi-club in Griddle |
| `playHighScore()` | Celebration arpeggio |
| `playGameEnd()` | Descending end chord |
| `playBoostHit()` | Shimmer effect (tier upgrades) |
| `playTick()` | Timer countdown |
| `playScoreSound(opts)` | TargetMan's layered scoring sound |

---

## Leaderboards

### Arcade (`lib/use-leaderboard.ts`)
- `useGameLeaderboard(game, period, max, delay)` — per-game, today/alltime
- `useGlobalLeaderboard(mode, period, max)` — cross-game points or plays
- Queries `scores` collection with `where("game", "==", slug)`, dedup client-side

### Daily (`lib/use-daily-leaderboard.ts`)
- `useDailyLeaderboard(game, period, max, delay)` — today/yesterday
- Queries `daily-scores` with `where("dateKey", "==", date)`, filters game client-side

### Leaderboard Page (`/leaderboard`)
Top toggle: **Daily** | **Arcade**
- Daily: today/yesterday, per-game tabs
- Arcade: All Games + per-game tabs, today/alltime

---

## Data Sources

### PL Player Data
API: `footballapi.pulselive.com` (public, unauthenticated)
```
GET /football/stats/ranked/players/{STAT}?page={PAGE}&pageSize=100&comps=1&teams={TEAM_ID}&altIds=true
Header: Origin: https://www.premierleague.com
```
Script: `node scripts/fetch-players.mjs` → outputs `client/src/data/pl-players.json`

**`pl-players.json`** (5,107 players):
```json
{ "displayName": "...", "firstName": "...", "lastName": "...",
  "position": "...", "nationality": "...", "dob": "...",
  "clubs": { "Man Utd": { "appearances": 632, "goals": 109, "assists": 162 } },
  "totalAppearances": 632, "totalGoals": 109, "totalAssists": 162 }
```

**`players.ts`** (2,859 goalscorers): `{ lastName, firstName, displayName, goals }`

Known data gaps exist (e.g., short stints missing). Accepted — game rules state "only PL apps count."

---

## Deployment

Push to `main` → GitHub Actions → live at **drapk.in** in ~1 min.

Workflow (`.github/workflows/deploy.yml`):
1. `npm install` (no lockfile)
2. `npm run build`
3. Copy `dist/index.html` → `dist/404.html` (SPA fallback)
4. Deploy `dist/` to GitHub Pages

**Common issues:**
- All pages black? → Check Actions log. SPA bundle crash kills every route.
- Dep broke? → Pin exact version in `package.json` (e.g., `@tanstack/react-query` pinned to `5.60.5`)

---

## Adding a New Game

Checklist:
1. Create page file in `client/src/pages/`
2. Add route in `App.tsx`
3. Add card in `home.tsx` (with `mode: "daily" | "arcade"`)
4. Add slug to `GameSlug` in `lib/save-score.ts`
5. Add slug to `ALL_GAMES` in `lib/use-user-stats.ts`
6. If daily game:
   - Add `DailyGameSlug` type in `lib/daily-score.ts`
   - Add Firestore rules for collection (Firebase Console)
   - Add tab in `leaderboard.tsx` `DAILY_TABS`
7. If arcade game:
   - Add tab in `leaderboard.tsx` `ARCADE_TABS`
