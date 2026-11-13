# Backlog — follow-ups and ideas (as of 13 Nov 2026)

Short on purpose; the code and `docs/ARCHITECTURE.md` explain the details.

## Built but switched off
- **Add to Home Screen + reminders.** Code is live but hidden (`SHOW_HOME_SCREEN` in `pages/me.tsx`,
  `SHOW_REMINDER_ASK` in `components/daily-next.tsx`). Freddy held it back because the iPhone journey is
  untested: the home-screen app has its own storage, so people must log in again there (and guests would
  lose progress — install is meant for named players only). Test that journey properly before switching on.
  Sending: `scripts/push/send.mjs` (manual "go" for now; VAPID private key in `~/.drapkin/vapid.json`,
  not in the repo); next step a scheduled GitHub Action. Evening streak reminder by default, morning opt-in.

## Parked, with a plan
- **PL data refresh** — must freeze the daily board schedules first. See `pl-data-refresh.md`.
- **Challenge shares** ("Can you beat me?" landing from a share link, emoji result grids for every game).
  Freddy said keep for later. Keep copy human — no "Can you beat 780?"-style lines.

## Ideas mentioned, not decided
- Automated daily social posts (X/Bluesky/Threads) with a game teaser image — not Reddit.
- Streak freeze (earn one per full set). Note: Freddy prefers people having to come back daily, so
  yesterday's set is day-0-only and doesn't repair streaks — weigh against that.
- Proper sign-in (email code + optional Face ID/passkeys) if leaderboard integrity ever matters —
  today anyone can log in as anyone (username only). Accepted for now.
- Brand name (not changing yet): Set Piece, Back Four, Footle, Teamsheet, Kickabout, Dugout,
  Stoppage Time, Four Four, Matchday, Daily Prem — Freddy to check domains.

## Decided against (don't redo)
- Mini-leagues (Friends covers it). Guest "you'd be #14" rows on leaderboards. Per-friend squares /
  avatar stacks. Auto-reload on stale chunks after deploys.

## Watch / revisit with data
- GA funnel: `guest_start` → `claim_prompt_view` → `sign_up` (`from_guest`); `tip_view`/`tip_done`/`tips_skip`.
- /stats Guests card (picked a name %, staying guest %), Players cohort table.
- Complete-today targets (CentreCircle 6, Griddle 10) — sanity-check against how many people now reach them.
- Test accounts in production from 13 Nov testing: argo, kellogg, cali (delete in the Firebase console if wanted).
