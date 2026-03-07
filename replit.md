# Chain Goal - Premier League Word Chain Game

## Overview
A single-page game where players name Premier League goalscorers in a word chain. Each surname must start with the last letter of the previous surname. Score is based on total goals scored by all correctly named players.

## Architecture
- **Frontend-only game** - no backend/database needed
- All player data loaded client-side from `client/src/data/players.ts`
- High score stored in sessionStorage (session-only persistence)

## Key Files
- `client/src/pages/game.tsx` - Main game component with 3 states: idle, playing, finished
- `client/src/data/players.ts` - 2858 Premier League goalscorers with surname, first name, display name, and goals
- `client/src/App.tsx` - Simple app shell, renders Game component directly

## Game Mechanics
- 90-second timer
- Score = total PL goals of all correctly guessed players
- Names normalized (accents stripped) for matching
- Duplicate guesses rejected
- Wrong guesses shake input, correct ones flash green
- End screen shows animated goal contribution chart

## Tech Stack
- React + TypeScript + Vite
- Tailwind CSS for styling
- Framer Motion for animations
- Space Grotesk font for sporty feel
- shadcn/ui components (Button)
