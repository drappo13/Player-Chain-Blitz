# Sports Quiz Games Hub

## Overview
A multi-game sports knowledge app featuring two games:
1. **GoalChain** — Chain Premier League goalscorers by surname letters. Score = total goals.
2. **SlamChain** — Name Grand Slam tennis players from R16+ rounds. One wrong answer ends the game.

## Architecture
- **Frontend-only** — no backend/database needed for game logic
- All data loaded client-side from TypeScript data files
- High scores stored in sessionStorage (separate keys per game)
- Routing via `wouter`: `/` (home), `/goalchain`, `/slamchain`

## Key Files
- `client/src/App.tsx` — Router with 3 routes + NotFound
- `client/src/pages/home.tsx` — Landing page / game selector
- `client/src/pages/game.tsx` — GoalChain game (3 states: idle, playing, finished)
- `client/src/pages/slam-chain.tsx` — SlamChain game (3 states: idle, playing, finished)
- `client/src/data/players.ts` — 2858 PL goalscorers (surname, first name, display name, goals)
- `client/src/data/slams.ts` — 100 Grand Slam tournaments (2000–2024) with R16+ player lists

## GoalChain Mechanics
- 90-second timer
- Score = total PL goals of all correctly guessed players
- Each surname must start with the last letter of the previous one
- 1 pass per game (new random letter)
- Names normalized (accents stripped, hyphens/spaces removed) for matching
- Duplicate guesses rejected
- Streak badges at 5/10/15 correct with floating emojis
- End screen: goal contribution chart (bars colored by goal count)

## SlamChain Mechanics
- Random Grand Slam shown (e.g. "Wimbledon 2004")
- 15 seconds per question
- Name any player from R16 or later
- No player can be named twice across the whole game
- One wrong answer or timeout = game over
- 3 skips per game
- Score = total correct answers
- Court-surface-themed visuals (green/clay/blue)

## Tech Stack
- React + TypeScript + Vite
- Tailwind CSS (dark mode forced)
- Framer Motion for animations
- wouter for routing
- Space Grotesk + JetBrains Mono fonts
- shadcn/ui components (Button)

## Design
- Dark mode: bg hsl(220 20% 6%), primary emerald hsl(150 80% 50%)
- SlamChain uses surface-themed accents (green/orange/blue)
- Ambient glow blobs, screen flash on correct/wrong
- Streak system with progressive background changes and floating emojis
