# Sports Quiz Games Hub

## Overview
A multi-game sports knowledge app featuring three games:
1. **GoalChain** — Chain Premier League goalscorers by surname letters. Score = total goals.
2. **Slam16** — Name Grand Slam tennis players from R16+ rounds. One wrong answer ends the game.
3. **GridLock** — Name F1 drivers who scored points in a given season. Score = championship points.

## Architecture
- **Frontend-only** — no backend/database needed for game logic
- All data loaded client-side from TypeScript data files
- High scores stored in sessionStorage (separate keys per game)
- Routing via `wouter`: `/` (home), `/goalchain`, `/slamchain`, `/gridlock`
- Sound effects via Web Audio API (`client/src/lib/sounds.ts`)

## Key Files
- `client/src/App.tsx` — Router with 4 routes + NotFound
- `client/src/pages/home.tsx` — Landing page / game selector (3-column grid with sport emoji icons)
- `client/src/pages/game.tsx` — GoalChain game (3 states: idle, playing, finished)
- `client/src/pages/slam-chain.tsx` — Slam16 game (3 states: idle, playing, finished)
- `client/src/pages/grid-lock.tsx` — GridLock game (3 states: idle, playing, finished)
- `client/src/data/players.ts` — 2858 PL goalscorers (surname, first name, display name, goals)
- `client/src/data/slams.ts` — 100 Grand Slam tournaments (2000–2024) with R16+ player lists
- `client/src/data/f1seasons.ts` — F1 season data (year, drivers with team and points) — placeholder data, awaiting real CSV
- `client/src/lib/sounds.ts` — Web Audio API sound effects (correct, wrong, tick, game end, high score)

## GoalChain Mechanics
- 90-second timer
- Score = total PL goals of all correctly guessed players
- Each surname must start with the last letter of the previous one
- 1 pass per game (new random letter)
- Names normalized (accents stripped, hyphens/spaces removed) for matching
- Duplicate guesses rejected
- Streak badges at 5/10/15 correct with floating emojis
- End screen: goal contribution chart (bars colored by goal count)

## Slam16 Mechanics
- Random Grand Slam shown (e.g. "Wimbledon 2004")
- 30 seconds per question
- Name any player from R16 or later
- No player can be named twice across the whole game
- One wrong answer or timeout = game over
- 3 skips per game
- Score = total correct answers
- Court-surface-themed visuals (green/clay/blue)

## GridLock Mechanics
- Random F1 season year shown (2000–2024)
- 30 seconds per question
- Name any driver who scored championship points that year
- Score = cumulative championship points of named drivers
- No driver can be named twice across the whole game
- One wrong answer = game over
- 3 skips per game
- F1-themed red/orange accent colors
- End screen: driver bars sorted by points with team color tags
- Session key: "gridlock-highscore"

## Tech Stack
- React + TypeScript + Vite
- Tailwind CSS (dark mode forced)
- Framer Motion for animations
- wouter for routing
- Space Grotesk + JetBrains Mono fonts
- shadcn/ui components (Button)

## Design
- Dark mode: bg hsl(220 20% 6%), primary emerald hsl(150 80% 50%)
- GoalChain: emerald green accent
- Slam16: surface-themed accents (green/orange/blue for grass/clay/hard)
- GridLock: red/orange F1 accent with racing-themed glows
- Home screen: sport emoji icons (⚽ 🎾 🏎️)
- Ambient glow blobs, screen flash on correct/wrong
- Streak system with progressive background changes and floating emojis

## Sound Effects
- Correct answer: ascending sine chime
- Wrong answer: descending sawtooth buzz
- Timer tick: subtle click in last 10 seconds
- Game end: descending four-note melody
- High score: ascending four-note celebration
