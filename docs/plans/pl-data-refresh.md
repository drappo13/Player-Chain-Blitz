# Refreshing the PL player data safely (not done yet)

Status (13 Nov 2026): **don't run `scripts/fetch-players.mjs` on its own.** Last refresh was 4 Nov 2026
(includes 2026/27 so far: 459 players). Parked until the board schedules are frozen.

## Why a plain refresh is risky

`client/src/data/pl-players.json` feeds the daily games, and two of them *pick their boards* from it:

- **CentreCircle** — `boardOrder()` in `pages/centre-circle.tsx` builds the whole board calendar from
  the surname groups (answer counts, `KNOWN_APPS`, legends). New/changed players reshuffle it, so
  **today's board changes mid-day**: saved progress resets (`boardHash` mismatch), today's leaderboard
  mixes two boards, and every past/future day changes too.
- **Griddle** — `generateBoard()` tries seeded shuffles until a board has ≥ 25 valid answers. More
  players can make an earlier attempt pass, changing the board on some days (possibly today).
- **Career Path** — uses `career-path.json` (built separately by `scripts/career-path/`), so a
  pl-players refresh doesn't change its puzzles. Rebuilding career-path.json is a separate job with
  the same risk (puzzles are dealt from its order; `PINNED_DAYS` exists for pinning days).
- Answers/lookups (CentreCircle answers, Griddle valid players, Overlap, Ladder Up) just gain new
  players — that part is fine.

## The routine (≈1 hour the first time, minutes after)

1. **Freeze the schedules** from the *current* data, before touching it:
   - generate CentreCircle boards (letters + centre) and Griddle boards (9 clubs) for every day from
     ~30 days back to ~2 years ahead → `client/src/data/daily-boards.json`
   - `boardFor()` / `generateBoard()` read that file first and only fall back to generating for days
     beyond it. Generate it in CI (needs the app's modules: e.g. `npx vite-node` with the vite aliases),
     and check today's boards match what the live site shows before committing.
2. **Refresh**: `node scripts/fetch-players.mjs` (keeps hand-corrected names and `wikiViews` by
   playerId; `--seasons-only` just updates `lastSeason`). Then `node scripts/build-players-ts.mjs` if
   the goalscorer list should follow.
3. **Review the diff**: new players, appearance changes, any renamed/unmatched players the script
   prints (fix names by hand if the API renamed someone).
4. **Test**: emulator e2e (runs on any non-main branch push) + localhost preview; check today's
   CentreCircle/Griddle boards are unchanged and in-progress games keep their progress.
5. Release (ff-merge to main), then a read-only live check.

After step 1 exists, a weekly refresh is steps 2–5 only.
