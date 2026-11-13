# Growth & retention build (v1)

Goal: more visitors become players, more players come back, and players bring friends —
without making the site feel complicated. Mobile first; home stays one screen.

Data we have (13 Nov 2026):
- 57–63% of each day's **new accounts** finish no daily game that day (post-sign-up drop-off).
- Pre-sign-up drop-off is unknown until `signup_prompt_view` → `sign_up` builds up in GA (shipped today).
- Day-1 return ~16% for one cohort; ~43 returning players by midday.
- CentreCircle submitted results (last 8 days, n=151): median 10 names, p25 = 4, p10 = 2. Avg board = 106 names.
- Griddle submitted (n=249): median 19 players, p25 = 10, p10 = 4.
- Invites: 4 so far, one second-generation chain.

## Changes after product review (these override the sections below)

1. **Save as you go instead of next-day auto-submit.** Once CentreCircle/Griddle counts (5 names/players),
   the score is written to the leaderboard and kept up to date as it rises (doc id = key, field `open: true`).
   "Submit" becomes **Finish**, which locks the game and shows the answers (`open: false`). No
   `pcb-autosubmit`, no "submits at midnight" copy. Needs a rules change so a score can only go up.
2. **One ask per session, in a fixed order.** Day 0: only the name ask. Day 2+: install *or* notifications, never both.
3. **Install only offered to named users** (the iPhone home-screen app doesn't share Safari's storage, so a
   guest would lose their progress). Offered day 2+, combined with the notifications ask on iPhone.
4. **Newcomers start with Career Path:** "Start here" on its tile until you've finished a daily game.
5. **Friends, slimmer:** automatic via invites, add by username on Me (kept — Freddy asked for it), best friend
   score in the tile footer, "connor got 780" on end screens, Everyone/Friends toggle (defaults to Friends when
   you have some). No avatar stack, no per-friend squares.
6. **Claiming a name:** today's games go on today's boards; earlier days are sent as `late` (kept for your
   streak, not put on old boards).
7. **Guests are just "Guest"** (no animal names). Name ask: once at the first finish, once at the next visit's
   finish, then only the quiet entry points (chip, Leaders, Me). On Me, guests don't see badges/notifications at all.
8. **Notifications:** asked at a finish on your 2nd+ day (named users). Default is one evening streak reminder
   (streak ≥ 3, not played today); the morning one is opt-in. MVP sends are manual ("go"); a GitHub Action
   on a schedule is the next step.
9. **Copy:** no "counted" wording — tile shows "✓ 640 · keep going"; toast "That's today done ✓ Keep going for
   more points". Name ask: "Pick a name to put 780 on the leaderboard". No "Can you beat 780?".
10b. **Yesterday's set (after testing):** day-0 players only, after their first finished game, and just for fun
   (device only — no leaderboards, no streak). Everyone else comes back tomorrow; no streak repair.
10. **Rules tightened:** nobody can delete push subscriptions or other people's scores.

Order of build (each is shippable on its own):
1. Play first, name later (guest play)
2. "Counts for today" thresholds + auto-submit (CentreCircle, Griddle)
3. Yesterday's set
4. Friends
5. Add to Home Screen, done properly
6. Notifications MVP (opt-in + stored subscriptions + manual send), with the full plan for automating
7. Small share tweaks
8. Brand name shortlist (names only, no change yet)

---

## 1. Play first, name later (guest play)

**Why:** the username box is the front door. Someone landing from Reddit or a friend's share should be
playing within one tap. Low regret: if the pre-sign-up funnel turns out fine, guests just sign up later.

**How it feels**
- First visit: no modal. You land on Today and play. You're a guest, shown as an animal
  (e.g. "🐧 Penguin") in the corner chip.
- Everything works locally: progress, set tracker, streak, Next up, end screens, results sharing.
- Ranks still show ("#14 of 212") — computed with count queries, the guest isn't on the board.
- **The ask** comes at the moment of value, never on arrival:
  - After the first finished daily game: a sheet on the end screen — "Nice — 780 pts. Pick a name to
    save it, get on the leaderboard and start your streak." [Pick a name] [Later].
    Shown once per day at most; "Later" hides it until the next finish.
  - Persistent but quiet entry points: the corner chip ("Save progress"), the Me tab, the leaderboards
    ("You'd be #14 — add your name"), Friends, Invite.
- Me tab for guests: streak / days / full sets tiles and the calendar (from local data), plus a big
  "Claim your name" card. Badges, Friends, Invite and Notifications are shown locked behind it.
- Sign-up from a guest = the existing username + emoji picker, retitled "Save your progress".
  "Already have a name? Log in" stays.

**Under the hood**
- Guest identity in `localStorage["pcb-guest"]`: `{ username: "guest-penguin-4821", avatar: "🐧", guest: true }`.
  Hyphen is not allowed in real usernames, so guest names can never collide with accounts.
- `useUser()` returns `user` (real or guest) plus `isGuest`. Pages keep working unchanged because all local
  keys are already per-username (`pcb-day-{u}-…`, `centrecircle-{u}-…`, etc.).
- `submitDailyScore` / `saveScore` for a guest: no leaderboard write. The call is queued in
  `localStorage["pcb-pending"]` instead. (So games don't need guest special cases.)
- Each guest finish also writes one tiny doc to a new **`guest-plays`** collection
  (`{ guest, game, dateKey, score, at }`) so /stats can still count guest players and their retention.
  Needs a Firestore rule (create + read).
- History for guests is built from local progress (`pcb-day-{guest}-*`) instead of Firestore, so
  multi-day guest streaks work on that device.
- **Claiming a name:** create the users doc (as today, with `referredBy`), then
  1. rename every local key containing the guest name to the new username,
  2. flush the pending queue under the new name (today's and any recent days' finished games land on the
     real leaderboards; `hasDailySubmission` prevents duplicates),
  3. auto-friend the inviter if they came from an invite (see Friends).
  Logging into an existing account from a guest does the same, but never overwrites keys that already exist.
- `hasDailySubmission`, `fetchHistory`, avatars: skipped for guests (no wasted reads).
- Analytics: `guest_start` (first visit), `claim_prompt_view` / `claim_prompt_click` (source),
  `sign_up` gains `from_guest` + `guest_games` (games finished before signing up). GA user property
  `account = guest | named`.
- /stats: "Players" counts gain guests (from `guest-plays`), shown as "+N guests"; sign-up conversion
  of guests = guests who later signed up (same device → `from_guest`).

**Edge cases**
- A guest who clears storage loses progress — same as any website; the claim prompt says so.
- Arcade as guest: playable; scores are queued and saved on claim.
- The Arsenal quiz keeps its own optional sign-up.

## 2. "Counts for today" — CentreCircle & Griddle

**Problem:** these two have no natural end. People find 12 names, leave, never press Submit — no score,
no streak, no full set. They did play.

**Rule:** a game **counts for today** once you've made a real effort, even if you haven't submitted:
- CentreCircle: **5 names** (roughly the bottom quarter of people who do submit).
- Griddle: **5 players**.
- Career Path and Photo Finish end naturally — unchanged.

**How it looks**
- The tile gets a ✓ and "Counts for today · keep going" under the progress bar; the square in the set
  tracker fills in. A small toast in-game when you cross it: "That counts for today ✓ — keep going or submit".
- The game stays open: keep finding names, the score keeps rising, Submit when you want.
- Streak, set count, "full set" confetti and badges treat counted = done.

**Leaderboard / auto-submit**
- Scores can't be changed after submitting, so we don't submit early. Instead, if the day ends with
  a counted-but-unsubmitted game, it's **submitted automatically the next time you open drapk.in**
  (with whatever you'd reached). Copy on the tile: "Submits automatically at midnight" (honest enough —
  it's submitted with your midnight score, on your next visit).
- Implementation: when a game is counted and not submitted, it stages its submit arguments in
  `localStorage["pcb-autosubmit"]` (overwritten on every change). On app load, any staged entry for a
  past day is submitted and cleared. A normal Submit clears it.
- Analytics: `game_counted` (game, count, seconds), and `auto_submit` (game, score).

## 3. Yesterday's set

**Why:** more to play on day one for newcomers, and a way to save a streak.

- Today page, below the tiles (only once you've finished or counted at least one of today's games):
  a slim link "Missed yesterday? Play yesterday's set ›" → a sheet listing yesterday's four games with your status.
- Game pages accept `?day=<yesterday>` in production (only yesterday; localhost keeps any day).
  A banner says "Yesterday's set · {date}"; Next-up chains through yesterday's games.
- Yesterday plays **count for your streak** (streak repair): if you missed yesterday, playing yesterday's
  set today fills the gap. They're submitted with `late: true` and **don't appear on leaderboards**
  (filtered out when reading). End screen shows "You'd have been #14 of 212".
- Only one day back for now (archive can come later).

## 4. Friends

**Model:** follow anyone by username (one-way, no approval — scores are already public). Called "Friends".

**Where it shows (all from one cached fetch):**
- **Today:** each game tile's footer shows the best friend score for that game ("connor 780") when you
  have friends who've played it — a ready-made challenge. The greeting line gets a small avatar stack
  "3 friends played" (tap → Friends). No extra height: home stays one screen.
- **End screens and Leaders tab:** an **Everyone / Friends** switch on the daily leaderboards
  (friends board = friends + you).
- **Me → Friends section:** add by username (one read to check it exists), list with each friend's
  today squares (4-square mark) and remove. Empty state: "Add a friend by username, or send your invite
  link — anyone who joins through it is added automatically."

**Automatic friends:** joining through someone's invite link makes you friends both ways.
New user: their friends doc starts with the inviter. Inviter: on Me/Today load, invitees
(`users where referredBy == me`) are merged in once.

**Data:** new collection **`friends/{username}`** = `{ list: string[], updatedAt }` (rule: read, create, update).
Friends' today scores: `daily-scores where key in [game_date_friend …]` in chunks of 30 —
reads = scores that exist (10 friends who all played = 40 reads), cached 5 min.
Cap 50 friends.

Guests: Friends is locked behind claiming a name.

## 5. Add to Home Screen, done properly

- **iPhone guide** becomes a bottom sheet with a big animated arrow pointing at the right button for
  the browser, and a drawn mock of the menu row to tap:
  - iOS 26 Safari: ••• (bottom right) → Share → Add to Home Screen
  - Older iOS Safari: Share (bottom middle) → Add to Home Screen
  - Chrome on iPhone: Share (top right) → Add to Home Screen
  - In-app browsers (Reddit, Instagram, etc.): "Open in Safari first" with the steps for that.
- **Android/Chrome:** native install prompt (as now).
- **When to offer** (soft ask, once each, never on first visit):
  - after the first full set: "Play tomorrow in one tap — add drapk.in to your Home Screen"
  - as part of the notifications ask on iPhone (you need the home-screen app for reminders)
  - the Me card stays.
- After installing on iPhone the home-screen app has its own storage, so its first launch shows a
  "Welcome back — log in with your name" sheet (with "New here? Play as a guest" underneath).

## 6. Notifications

**MVP (this build)**
- **Opt-in:** a "Daily reminder" switch on Me, plus a soft ask after the full set / second-day finish:
  "Want a nudge when tomorrow's set is out?" [Yes please] [No thanks]. "Yes" triggers the browser
  permission (must be from a tap). On iPhone outside the home-screen app, the ask becomes the install guide.
- **Stored:** new collection **`push-subs/{username}`** = `{ endpoint, keys, tz, morning: true, streak: true, createdAt }`.
- **Sending:** a script (kept outside the repo with the private key) that I run when you say "go":
  `morning` (everyone subscribed) or `streak` (subscribed, streak ≥ 2, not played today — checked with
  `key in [...]` queries). Prints who it sent to; deletes subscriptions Apple/Google say are gone (404/410).
- **New permanent keys:** generate a new VAPID pair; private key lives in `~/.drapkin/vapid.json`
  (not in the repo). Your test subscription will need re-enabling once.

**Automating it (next step, not this build)**
- A scheduled **GitHub Action** (free) runs the same script: 08:00 UK "Today's set is ready",
  19:30 UK "Your 6-day streak ends at midnight 🔥" (only for people with a streak who haven't played).
  Private key stored as a repository secret. Timezone buckets later (we store `tz`).
- Rules of thumb: max 2 a day, never to people who've already played, easy off-switch, track
  `push_open` (notification tap → `?src=push`) to see if it brings people back.

## 7. Share tweaks (small)

- Single-game share text adds a challenge line: "Can you beat 780?" (the link already carries your invite ref).
- After the full-set celebration, the share button is primary (it's the peak moment).
- When someone lands on a game from a share link while a guest, the game opens directly (no modal) — which
  guest play already gives us.

## 8. Brand names (shortlist only)

Short, football-y, daily-habit sounding; to check domains (.com / .co.uk / .app / .io / .football):
see the list at the end of the build summary.

---

## New Firestore rules needed (Firebase Console)

```
match /daily-scores/{docId} {
  allow read, create: if true;
  // in-progress scores (open: true) can only go up, and can't change whose/which game they are
  allow update: if resource.data.open == true
    && request.resource.data.score >= resource.data.score
    && request.resource.data.key == resource.data.key
    && request.resource.data.username == resource.data.username;
  allow delete: if false;
}
match /friends/{u}      { allow read, create, update: if true; allow delete: if false; }
match /guest-plays/{id} { allow read, create: if true; allow update, delete: if false; }
match /push-subs/{u}    { allow read, create, update: if true; allow delete: if false; }
```

## Testing

Built by GitHub Actions and served at http://localhost:4173. On localhost the daily games don't write
to the real leaderboards (existing behaviour; Griddle will be aligned), and `?day=` works for any day.
