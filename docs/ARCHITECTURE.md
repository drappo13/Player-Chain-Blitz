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
├── App.tsx                      # Router + lazy loading + error boundary
├── pages/
│   ├── home.tsx                 # Today: daily set tracker + a tile per daily game (progress, score, rank)
│   ├── arcade.tsx               # Arcade games, Champions quiz, tennis, F1
│   ├── me.tsx                   # Your stats: streaks, days played, calendar, per-game bests
│   ├── griddle.tsx              # Griddle (daily)
│   ├── centre-circle.tsx        # CentreCircle (daily surname spelling)
│   ├── photo-finish.tsx         # Photo Finish (daily guess-the-season photos)
│   ├── career-path.tsx          # Career Path (daily name-the-player from season stats)
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
│   ├── daily.ts                 # Daily set: game list/order, today's progress, history, streaks, ranks, share text
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
│   ├── app-nav.tsx              # Hub nav (Today/Arcade/Leaders/Me): top bar on desktop, bottom tabs on phones; HubPage wrapper
│   ├── daily-next.tsx           # End-screen "Next up" / set complete block + SetSegments
│   ├── game-icons.tsx           # Custom SVG icons for the daily games
│   └── user-badge.tsx           # Floating streak + name chip on game pages (links to /me)
└── hooks/
    ├── use-high-score.ts        # Local + Firebase high score
    ├── use-share.ts             # Web Share API / clipboard
    ├── use-end-screen-effects.ts # End screen sound + save
    ├── use-lock-scroll.ts       # Prevent scroll on focus
    ├── use-toast.ts             # Toast notifications
    └── use-mobile.tsx           # Mobile detection

scripts/
└── fetch-players.mjs            # Fetches PL data from official API

client/public/
└── sw.js                        # Service worker — clears caches, no fetch interception

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
- `GameSlug`: `goalchain | slamchain | targetman | gridlock | overlap | clubladder | griddle | centrecircle | photofinish | careerpath`
- Note: `griddle`, `centrecircle`, `photofinish` and `careerpath` are in GameSlug for stats compatibility but their scores go to `daily-scores`
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
- Header: Home button + Info button (`(i)` icon, returns to start/rules screen) + timer/question counter
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
Shown only the first time someone plays that game (skipped if there's progress today, the game was ever played on this device (`hasPlayedBefore` in `lib/daily.ts`), or it's already submitted). Rules + "Play" button; the info button reopens it.

### Playing Screen
- No timer. Input + flag button (submits score).
- 3×3 grid with hit counters + progressive dot colors
- Score (centred), found count, tier badge, coverage bar
- `playComboCorrect()` for 3+ club answers

### Submitted State
Input replaced with "View Results & Leaderboard" button. Board visible but locked.

### End Screen
Score + tier → Leaderboard (today/yesterday) → Top 20 missed players → `<DailyNext>` (today's set progress and a "Next up" button to the next unfinished daily game, or "Daily set complete" with streak and Share my day)

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
- **Wrong answer -1**: unknown players or 0 clubs on board. 1 club = neutral (no penalty)

### Multi-Level Board Coverage
Coverage bar tracks hitting all 9 clubs at each level (1×, 2×, 3×...). When all 9 clubs reach the current level, a bonus is awarded and the bar resets to track the next level.

| Level | Bonus |
|---|---|
| 1× | +5 |
| 2× | +7 |
| 3× | +10 |
| 4× | +12 |
| 5× | +15 |
| 6× | +20 |
| 7×+ | +25, +30, ... (+5 per level) |

Can complete multiple levels at once if a player's clubs span several levels. Celebration overlay appears on the grid on completion.

### Progress Tiers (% of valid answers)
Beginner (1%) → Amateur (3%) → Acceptable (5%) → Decent (9%) → Knowledgeable (13%) → Expert (18%) → Masterful (27%) → Legendary (38%) → Encyclopaedic (50%)

### Persistence
- `localStorage` key: `griddle-{username}-{dateKey}` (scoped per user), includes `boardHash` for invalidation
- CentreCircle follows the same pattern (`centrecircle-{username}-{dateKey}`). Its boards are dealt from a fixed rotation starting at `HIVE_EPOCH`. Each board is the 8–10 letters of one surname (the pangram), which must be the only surname using every letter and belong to a player people know (50+ apps in the last 10 seasons, 100+ in the last 20, or 100+ goals; uses `lastSeason` in pl-players.json). A board needs 40–250 answers, 15+ by 100+ app players and 5+ legends; the centre is any letter 15+ answers use. A set only repeats (with a new centre) after every other set has been used. Any surname from the letters counts; score is 1 point per letter (+ board size for the pangram), ×2 for using the centre letter, ×2 for a legend (250+ apps or 75+ goals). Wrong guesses are free
- Photo Finish follows the same pattern (`photofinish-{username}-{dateKey}`). Photos are the lead images of BBC Sport PL match reports, hotlinked (not stored): `client/src/data/photo-finish.json` holds 551 (20 per season from 2000/01, 11 from 1999/00, built by `scripts/build-photo-finish.py`) and `photo-finish-classics.json` 24 iconic moments from the BBC's "30 years of the Premier League in pictures". The pool is cut by date into 10 era bands; each day takes one photo per band, dealt from a seeded shuffle starting at `PF_EPOCH`, so 50 days pass before any repeat and later cycles reshuffle. The day's classic replaces the photo from its own era. Score: 100 for the exact season, then 80/60/45/30/15/5 by seasons out (max 1,000). The `entries` field stores the number of exact guesses.
- Career Path follows the same pattern (`careerpath-{username}-{dateKey}`). `client/src/data/career-path.json` holds every PL player's season-by-season apps/goals/assists per club (from the PL stats API, filtered by season and team) and five answer tiers. Each answer is a player plus five straight PL seasons; tiers rank players (4k+ monthly Wikipedia views, `wikiViews` in pl-players.json) by a recency quintile of the five seasons plus a views quintile, cut into fifths (spells ending before 2008 only for the most viewed fifth, so hard rounds are recent squad players rather than old names); about 1 in 5 answers is a single-club spell (`scripts/career-path/`: `fetch-careers.py`, then `build-career-path.py`; the per-season final tables come from the PL standings endpoint, see the note in `fetch-careers.py`). Round k (multiplier 1, 1.5, 2, 2.5, 3) draws from tier k, dealt from a seeded shuffle from `CP_EPOCH`. Five guesses per player; each miss unlocks a clue (clubs for seasons 1–2, seasons 3–5, position & nation, whole PL career). Points 10/8/6/4/2 by guess × multiplier, max 100. `entries` stores players solved.
- Today's progress: every daily game calls `recordDaily()` (`lib/daily.ts`) whenever its state changes, writing a small summary (status, score, detail, level, progress 0–1) to `pcb-day-{username}-{dateKey}`. The home tiles, set tracker and Next-up read this. Games finished on another device come from the user's `daily-scores` docs instead.
- Streaks: `useStreak()` reads all the user's `daily-scores` (cached in `pcb-dailyhist-{username}`) plus today's local progress. A streak is consecutive days with at least one finished daily game, alive until the end of the day after the last play. Days played = distinct dates.
- Adding a daily game to the set: add it to `DAILY_GAMES` in `lib/daily.ts` (order = home tile order and Next-up chain), an icon in `components/game-icons.tsx`, and a `recordDaily()` call in its persist effect plus `<DailyNext current=… />` on its end screen.
- Firebase: single write via `submitDailyScore()` on "I'm Done"
- Cross-device: `hasDailySubmission()` checks Firebase on load. Also detects failed writes (local says submitted but Firebase empty → resets to allow retry)

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
  "totalAppearances": 632, "totalGoals": 109, "totalAssists": 162,
  "lastSeason": 2013, "wikiViews": 160000 }
```

`wikiViews` is the player's average monthly English Wikipedia views (fetched Nov 2026 by `scripts/career-path/fetch-wiki-views.py`, matched by name with "(footballer)" fallbacks), a fame measure; ~150 players have none. A few may be matched to the wrong article and read low, which only matters for a game that would pick low-view players. `fetch-players.mjs` carries it over by playerId on refresh.

**`players.ts`** (2,859 goalscorers): `{ lastName, firstName, displayName, goals }`

Known data gaps exist (e.g., short stints missing). Accepted — game rules state "only PL apps count."

---

## Analytics (GA4 via Firebase Analytics)

Events go to Google Analytics, not Firestore (free, no read/write cost). `trackEvent()` and `identify()` in `lib/firebase.ts` queue calls until GA has loaded. Names are shared across games; params include `game` (slug) and `mode` (`daily` | `arcade` | `special`) where relevant. Ad blockers drop a share of events, so Firestore stays the source of truth for counts; GA is for behaviour and funnels.

| Event | Fired from | Key params |
|---|---|---|
| `page_view` | route changes (`App.tsx`) | path |
| `game_start` / `game_finish` | daily: `recordDaily` transitions in `lib/daily.ts` (restored results fire nothing); arcade: `saveScore`; quiz: its own | score, level, seconds, set_position |
| `set_complete` | `lib/daily.ts` | last_game |
| `guess` | each daily game (Griddle/CentreCircle via their feedback fn) | result / seasons_off / clue_stage, round |
| `clue_reveal`, `hints_open`, `rules_open` | daily games | game, round, clue_stage |
| `round_start` / `round_finish` | Champions quiz | round, score |
| `tile_open` | home tiles | game, status, position |
| `next_up_click` | `DailyNext` | from, to, done_today |
| `share` | `shareLink()` (every share message) | path, source (`game` / `day` / `invite`) |
| `invite_landing` | `?ref=` on load (`user-context`) | ref, path, signed_in |
| `sign_up` / `login` | `user-context` | invited, ref |
| `badge_unlock` | `BadgeGrid` (first view after unlocking) | badge |

User ID = lowercase username (so retention counts people, not devices). User properties: `acquisition` (invite/organic), `referred_by`, `signup_month` (set at sign-up), `current_streak`, `best_streak`, `days_played`, `days_played_band`, `daily_done_today` (refreshed by `AnalyticsIdentity` in `App.tsx`).

---

## Deployment

Push to `main` → GitHub Actions → live at **drapk.in** in ~1 min.

Workflow (`.github/workflows/deploy.yml`):
1. `npm install` (no lockfile)
2. `npm run build`
3. Copy `dist/index.html` → `dist/404.html` (SPA fallback)
4. Deploy `dist/` to GitHub Pages

**Resilience layers:**
- **Lazy loading** — all pages use `React.lazy()` in `App.tsx`. A crash in one page's chunk can't kill others.
- **Error boundary** — wraps entire app. Shows "Refresh" button instead of blank screen on unhandled errors.
- **Stats cache merging** — `readCache` in `use-user-stats.ts` merges cached data with `makeEmpty()` defaults, so newly added game slugs don't crash the homepage.
- **Defensive guards** — `GameCardComponent` in `arcade.tsx` falls back to `{ highScore: 0, plays: 0 }` if stats are undefined.

**Common issues:**
- Dep broke? → Pin exact version in `package.json` (e.g., `@tanstack/react-query` pinned to `5.60.5`)
- Page crash? → Only that route is affected (lazy loading). Check console for the specific error.
- Old users seeing blank? → Likely stale localStorage. The stats cache merge should handle this automatically.

---

## Adding a New Game

Checklist:
1. Create page file in `client/src/pages/`
2. Add lazy import + route in `App.tsx`
3. Daily: add to `DAILY_GAMES` in `lib/daily.ts` (see Daily Game Pattern → Persistence). Arcade: add a card in `arcade.tsx`
4. Add slug to `GameSlug` in `lib/save-score.ts`
5. **Add slug to `ALL_GAMES` in `lib/use-user-stats.ts`** — CRITICAL: missing this crashes the homepage for all users (stats cache returns undefined for the new game)
6. If daily game:
   - Add `DailyGameSlug` type in `lib/daily-score.ts`
   - Add Firestore rules for collection (Firebase Console)
   - Add tab in `leaderboard.tsx` `DAILY_TABS`
7. If arcade game:
   - Add tab in `leaderboard.tsx` `ARCADE_TABS`
