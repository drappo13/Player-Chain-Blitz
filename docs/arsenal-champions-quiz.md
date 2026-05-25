# Arsenal PL Champions 2026 — Quiz Master Plan

**Route:** `/arsenal-pl-champions-2026`  
**File:** `client/src/pages/arsenal-champions.tsx`  
**Data:** `client/src/data/arteta-arsenal-stats.json` (Arteta-era PL stats, from official PL API)  
**Status:** ✅ All 10 rounds built and live — pending photos (Round 7 Corners) and stat/quote verification

---

## Concept

A 10-round commemorative quiz celebrating Arsenal's 2025-26 Premier League title win — the end of a 22-year wait. Players relive the full Arteta era (Dec 2019–May 2026): the dark times, the near-misses, the doubters, and the triumph. Celebratory in tone, but knowledge-testing in substance.

**Audience:** Arsenal fans  
**Vibe:** Arsenal red + gold, dark background, premium and celebratory  
**Format:** 10 sequential rounds, 10 questions each, 10 points per round, 100 total  
**Timer:** No timer — unlimited time per question  
**Scoring:** 1 point per correct answer. 10 questions per round = 10pts/round. 10 rounds = **100 total**. No penalty for wrong answers.  
**Leaderboard:** All-time only (not daily) — use existing Firebase `scores` collection with a new `gameId: "arsenal-champions-2026"` field

---

## Branding

- **Background:** `#0a0a0f` (very dark navy-black)
- **Arsenal red:** `#EF0107` (Tailwind: `red-600`)
- **Gold:** `#FFD700` / Tailwind `amber-400` / `yellow-400`
- **White text** throughout
- **Premier League purple** (`#37003c`) as subtle accent
- Framer Motion animations on all screen transitions
- Mobile-first layout

---

## Game Flow

```
Intro → Round 1 → Between → Round 2 → Between → ... → Round 10 → Results
```

- **Intro screen:** Arsenal branding, trophy animation, "10 Rounds · 100 Questions", START QUIZ
- **Between rounds:** Round complete screen showing points earned, running total, next round preview
- **Results screen:** Total score /1000, celebratory animation, share button, play again

---

## Final Round Order (live game, updated May 2026)

The live `ROUNDS` array in `client/src/pages/arsenal-champions.tsx` ships rounds in this order. The per-round detail sections below preserve original implementation numbering for git history — use this table as the source of truth for the live sequence.

| Live # | Round name | Original # (section below) | Mechanic |
|--------|------------|-----------------------------|----------|
| 1 | Who Doubted Us? | R2 | 4-option MC (quotes → who said it) |
| 2 | Who Has Most? | R8 | 4-option MC (stat → who leads) |
| 3 | Arteta's First XI *(renamed from "Build the XI")* | R9 | Position-by-position XI builder |
| 4 | Top Scorers | R6 | Select top 10 from full pool |
| 5 | Trust the Process | R1 | ▲▼ score guessing (2020/21) |
| 6 | Arteta Speaks | R3 | 4-option MC (Arteta quotes → who about) |
| 7 | Corner Kings | R5 | 4-option MC (corner photos → scorer) |
| 8 | Guess the Score | R10 | ▲▼ score guessing (10 landmark games) |
| 9 | The Assist Masters | R7 | Select top 10 from full pool |
| 10 | The Season That Won It | R4 | 4-option MC (25/26 stats) |

**Ordering rationale:** Opens punchy with pundit doubters (warm-up, instantly fun). Heavier knowledge tests middle (XI builder, top scorers, score-guessing). Ends on celebratory 25/26 stats — the actual title-winning numbers as the closer.

---

## The 10 Rounds *(detail sections, original implementation order)*

### Round 1 — Trust the Process
**Subtitle:** "How bad did it get?"  
**Format:** 10 games from Arsenal's 2020/21 horror run (image provided by user). For each game show: opponent, date, home/away. Player selects the correct final score from 4 options.  
**Points:** 10 per correct score  
**Status:** ✅ Built and live

**The 10 games (from user-provided screenshot):**
| Opponent | Date | H/A | Score | Result |
|----------|------|-----|-------|--------|
| Man City | 17 Oct | A | 0-1 | L |
| Leicester | 25 Oct | H | 0-1 | L |
| Man Utd | 1 Nov | A | 1-0 | W |
| Aston Villa | 8 Nov | H | 0-3 | L |
| Leeds Utd | 22 Nov | A | 0-0 | D |
| Wolves | 29 Nov | H | 1-2 | L |
| Tottenham | 6 Dec | A | 0-2 | L |
| Burnley | 13 Dec | H | 0-1 | L |
| Southampton | 16 Dec | H | 1-1 | D |
| Everton | 19 Dec | A | 1-2 | L |

**Wrong answer options per question:** generate plausible nearby scores (e.g. 0-2, 1-1, 2-1 alongside correct)

---

### Round 2 — Who Doubted Us?
**Subtitle:** "They said it. But who?"  
**Format:** Show a quote on screen. Player picks who said it from 4 options.  
**Points:** 10 per correct attribution  
**Status:** ✅ Built and live. ⚠️ User to verify all source URLs personally.

**The 10 quotes (in display order — spread across the timeline for variety):**

| # | Quote | Person | Year | Source | Options (A/B/C/D) |
|---|-------|--------|------|--------|-------------------|
| 1 | *"That's in some ways as good as it gets [for Arsenal under Arteta]"* + implied he'd leave for a bigger job | Gary Neville | Apr 2022 | [Sky Sports](https://www.skysports.com/football/news/11661/12578763/gary-neville-tells-the-overlap-that-arsenals-premier-league-ambitions-may-be-limited-to-fourth-place) / [GiveMeSport](https://www.givemesport.com/gary-neville-mikel-arteta-comments-2022-resurface-arsenal/) | Neville, Carragher, Merson, Shearer |
| 2 | *"Arsenal have looked a very nervy bunch for a whole month now — in part that stems from Arteta and his antics on the touchline"* | Graeme Souness | Feb 2023 | Football365 | Souness, Keane, Merson, Neville |
| 3 | *"When they came here, I saw them and thought these guys do not want to beat us. They just want to draw. That mentality — we wouldn't do it the same way."* | Rodri | May 2024 | [Sky Sports](https://www.skysports.com/football/news/11095/13139985/rodri-manchester-city-beating-arsenal-to-pl-down-to-mentality-after-pep-guardiolas-side-win-fourth-league-title-in-a-row) | Rodri, Bernardo Silva, De Bruyne, Haaland |
| 4 | *"Watching Arsenal is like watching Netflix. You always have to wait for the next season!"* | Patrice Evra | Oct 2024 | [Tribuna](https://tribuna.com/en/news/arsenal-2024-10-30-evra-watching-arsenal-is-like-watching-netflix-youre-always-waiting-for-the-next-season/) | Neville, Scholes, Simon Jordan, Evra |
| 5 | *"They were just booting it, like a small team with a small mentality."* | Roy Keane | Sep 2024 | Football365 / GiveMeSport | Keane, Souness, Neville, Carragher |
| 6 | *"Stay humble, eh. Stay humble, eh."* [said directly to Arteta pitchside after 98th-min equaliser] | Erling Haaland | Sep 2024 | [Goal.com](https://www.goal.com/en-us/lists/erling-haaland-mikel-arteta-stay-humble-calls-gabriel-jesus-clown-man-city-star-outburst-arsenal-draw/bltaa30b5a42d5c3727) / [ESPN](https://www.espn.com/soccer/story/_/id/43638648/mikel-arteta-unfazed-erling-haalands-stay-humble-jibe) | Haaland, Rodri, De Bruyne, Bernardo Silva |
| 7 | *"The day my friend Mikel Arteta wins the title, it will only be because of what he's spent, not because of his work."* | Pep Guardiola | Sep 2025 | [beIN Sports](https://www.beinsports.com/en-us/soccer/premier-league/articles/guardiola-taunts-arteta-if-arsenal-win-it-will-only-be-because-of-what-they-ve-spent-2025-09-19) | Guardiola, Klopp, Mourinho, Ten Hag |
| 8 | *"He's got to be in the top two by Christmas or they'll go for someone else."* | Paul Merson | May 2025 | [Sky Sports](https://www.skysports.com/football/news/15205/13370710/paul-mersons-warning-for-mikel-arteta-top-two-by-christmas-or-arsenal-will-go-for-someone-else) | Merson, Souness, Shearer, Carragher |
| 9 | *"It's going to come on full blast now, being bottle jobs, melting."* | Paul Merson | Feb 2026 | [Sky Sports](https://www.skysports.com/football/news/11670/13509316/paul-merson-slams-slow-and-lazy-arsenal-after-wolves-draw-and-expects-bottle-jobs-talk-to-ramp-up) | Merson, Keane, Neville, Souness |
| 10 | *"It's only natural that they would man up a little bit and start challenging for titles, even though they haven't still reached that level."* [said 2 games before Arsenal clinched it] | Bernardo Silva | May 2026 | [ESPN](https://www.espn.com/soccer/story/_/id/48776772/bernardo-silva-only-natural-arsenal-man-challenge-titles) | Bernardo Silva, Rodri, Haaland, De Bruyne |

### Confirmed final 10 quotes (in display order) ✅ LIVE

| # | Person | Quote (display text) | When | Options |
|---|--------|----------------------|------|---------|
| 1 | Gary Neville | "That's in some ways as good as it gets" | Apr 2022 | Neville / Merson / Tim Sherwood / Carragher |
| 2 | Graeme Souness | "Arsenal have looked a very nervy bunch — in part that stems from Arteta and his antics on the touchline." | Feb 2023 | Souness / Keane / Redknapp / Jermaine Jenas |
| 3 | Rodri | "When they came here I thought: these guys do not want to beat us. They just want to draw." | May 2024 | Rodri / Bernardo Silva / De Bruyne / Haaland |
| 4 | Roy Keane | "They were just booting it, like a small team with a small mentality." | Sep 2024 | Keane / Souness / Alan Shearer / Gabriel Agbonlahor |
| 5 | Patrice Evra | "Watching Arsenal is like watching Netflix. You always have to wait for the next season!" | Oct 2024 | Evra / Gary Neville / Joe Hart / Jermaine Jenas |
| 6 | Erling Haaland | "Stay humble, eh. Stay humble, eh." [said directly to Arteta pitchside] | Sep 2024 | Haaland / Rodri / De Bruyne / Bernardo Silva |
| 7 | John Obi Mikel | "They've cheated their way to winning the Premier League. I wouldn't recognise them as winners — for me, it's illegal the way they win games." | Mar 11 2026 (talkSPORT) | Mikel / Rooney / Schmeichel / Tim Sherwood |
| 8 | Gabriel Agbonlahor | "He has to walk! Mikel Arteta should resign if Arsenal fails to win the league." | May 2025 (talkSPORT) | Agbonlahor / Alan Shearer / Merson / Jermaine Jenas |
| 9 | Paul Merson | "It's going to come on full blast now, being bottle jobs, melting." | Feb 2026 | Merson / Keane / Wayne Rooney / Paul Scholes |
| 10 | Peter Schmeichel | "We can't have all these games and the championship decided on corner kicks. We just can't." | Mar 2026 | Schmeichel / Wayne Rooney / Gary Neville / Souness |

**Options shuffle on mount** — correct answer position is randomised each play.

**After reveal, show for each:** Person, role/club, date/context. E.g. "Peter Schmeichel — Man Utd legend & pundit. Said after Arsenal 2-1 Chelsea (both goals from corners), March 2026. Irony: Schmeichel's own 1999 UCL win ended with two late corners."

**Count: 10 quotes confirmed ✅** (Plus 4 verified alternates: Paul Scholes "boring", Wayne Rooney "celebrate when you win", Troy Deeney "players not turning up", Schmeichel "ugly brand of football")

**⚠️ User to verify all source URLs before going live**  
**⚠️ Neville quote is a paraphrase/compression of 3 sentences from one appearance — verify wording**

### Additional quotes to research / potentially add (replace weaker entries above)

**Paul Scholes — "boring / worst title winners"**  
Scholes branded Arsenal "boring" and said if they won the league they "could be the worst team to win the league" — claiming none of their front four would make a team of the season. He later apologised publicly to Ian Wright on the Stick to Football podcast, saying he meant boring but *effective*. This apology is actually a great story arc. Source: Stick to Football podcast — **needs exact date + URL**.  
Options: Scholes, Neville, Keane, Carragher

**Peter Schmeichel — multiple verified quotes (Viaplay punditry)**  
Four strong options — pick the best 1–2 for the quiz:

| Quote | Context | Source |
|-------|---------|--------|
| *"Arsenal bring an ugly brand of football to our game. Arteta… let your team play football! Let them loose!"* | After Arsenal 0-1 Liverpool, 31 Aug 2025 | [Goal.com](https://www.goal.com/en-us/lists/arsenal-ugly-brand-of-football-slammed-peter-schmeichel-man-utd-legend-urges-mikel-arteta-let-players-loose/blt703d32b0cd138a7c) / [Sport Bible](https://www.sportbible.com/football/football-news/arsenal/arsenal-liverpool-peter-schmeichel-mikel-arteta-102468-20250831) |
| *"Arteta is a control freak. He wants his players to play how he wants… that would confuse the hell out of me as a football player."* | After Liverpool 2-2 Arsenal, 12 May 2025 | [Goal.com](https://www.goal.com/en/lists/mikel-arteta-control-freak-man-utd-legend-peter-schmeichel-arsenal-boss-confusing-making-worse/blte962a9d896fc479c) / [GiveMeSport](https://www.givemesport.com/peter-schmeichel-bizarre-rant-mikel-arteta-liverpool-arsenal/) |
| *"Arsenal would never be top of the league if that's a free-kick… I just don't understand why all of a sudden that's a free-kick."* | After Arsenal 1-0 West Ham (VAR controversy), 10 May 2026 | [ESPN](https://www.espn.com/soccer/story/_/id/48739301/peter-schmeichel-arsenal-free-kick-decision-wrong-levels-west-ham) / [Goal.com](https://www.goal.com/en/lists/arsenal-would-never-be-top-if-that-s-a-free-kick-furious-peter-schmeichel-blasts-officials-over-so-wrong-decision-disallow-west-ham-equaliser/bltadaf4464bebb7809) |
| *"We can't have all these games and the championship decided on corner kicks. We just can't."* | After Arsenal 2-1 Chelsea (both goals from set pieces), 2 Mar 2026 — Arsenal fans noted Man Utd's 1999 UCL win was settled by two late corners | [GiveMeSport](https://www.givemesport.com/peter-schmeichel-slammed-arsenal-fans-laughable-comments-win-chelsea/) / [Sportskeeda](https://www.sportskeeda.com/football/news-we-championship-decided-corner-kicks-manchester-united-legend-reacts-arsenal-win-vs-chelsea) |

**⭐ Recommended for quiz:** The corner kicks quote (Mar 2026) — perfect cross-reference with the Corner Kings round. The "ugly brand of football" (Aug 2025) is also very quotable.  
Options for both: Schmeichel, Neville, Souness, Keane

**Wayne Rooney — "Celebrate when you win"**  
*"The celebrations are a little bit too much. Celebrate when you win."* — said after Arsenal reached the CL final. Arteta laughed it off. Source: [Goal.com](https://www.goal.com/en-us/lists/laughing-mikel-arteta-responds-wayne-rooney-arsenal-celebrations/bltfaed964bda17b129). Could replace a weaker entry.  
Options: Rooney, Shearer, Neville, Keane

### Media narrative context (for "Who Doubted Us?" round framing)

Four recurring anti-Arsenal narratives to weave into question framing:
1. **"Celebration Police"** — Pundits criticised Arsenal for celebrating wins "too much" before winning anything
2. **"Boring / set-piece reliant"** — Scholes, others called them anti-football for corner routines
3. **"Bottle jobs"** — Merson, others used this phrase repeatedly as Arsenal repeatedly finished 2nd
4. **"Double standards"** — Fan media (AFTV etc.) accused Sky/talkSPORT of praising rival pragmatism but labelling Arsenal "anti-football" for identical tactics

These narratives make the round more resonant — each quote can be prefaced with a one-line context chip on screen (e.g. "Said after Arsenal drew 2-2 from 2 up, February 2026").

---

### Round 3 — Arteta Speaks
**Subtitle:** "He talks about his players every week. But who is he talking about?"  
**Format:** Show an Arteta press conference quote about a player (name redacted). Player picks from 4 options.  
**Points:** 10 per correct answer  
**Status:** ✅ Complete — 10 questions live

| # | Player | Context shown to user | Options |
|---|--------|-----------------------|---------|
| 1 | William Saliba | August 2022 | Saliba, Gabriel, Ben White, Timber |
| 2 | Martin Ødegaard | August 2025 — on one of his players' leadership | Ødegaard, Rice, Saliba, Saka |
| 3 | Declan Rice | April 2025 — on ignoring their set piece coach in a Champions League match | Rice, Saka, Ødegaard, Martinelli |
| 4 | Kai Havertz | November 2024 — on a player returning from injury | Havertz, Timber, Gyökeres, Rice |
| 5 | Jurrien Timber | July 2024 — pre-season, on a player returning to fitness | Timber, Calafiori, Havertz, Ben White |
| 6 | Alexandre Lacazette | 2021 — on a striker's role in the team | Lacazette, Aubameyang, Martinelli, Ødegaard |
| 7 | Viktor Gyökeres | November 2025 — after a Champions League match | Gyökeres, Havertz, Lacazette, Martinelli |
| 8 | Eberechi Eze | May 2026 — on a player's impact during the title-winning season | Eze, Ødegaard, Havertz, Martinelli |
| 9 | Pierre-Emerick Aubameyang | December 2021 — after a difficult decision involving a senior player | Aubameyang, Lacazette, Xhaka, Pépé |
| 10 | Bukayo Saka | March 2025 — after a player returned from a long injury | Saka, Martinelli, Timber, Havertz |

---

### Round 4 — The Season That Won It
**Subtitle:** "2025/26 — the numbers behind the title"  
**Format:** 10 multiple-choice stats questions about the 2025-26 PL season specifically  
**Points:** 10 per correct answer  
**Status:** ✅ Built and live. ⚠️ The table below shows a revised set of questions that have NOT yet been coded — the live version still uses the original questions (clean sheets, points, Raya Golden Glove, goals conceded, top scorer, clinching result, games to spare, captain, CL quarter-final, corner goals). The table below is the target — needs to be swapped in and verified before going live.

| # | Question | Answer | Options | Reveal context |
|---|----------|--------|---------|----------------|
| 1 | How many PL clean sheets did Arsenal keep in 2025-26? | **19** | 17, 18, 19, 20 | David Raya: 19 clean sheets, 3 Golden Gloves in a row. The wall. |
| 2 | How many goals did Spurs score against Man City across both PL fixtures? | **4** | 2, 3, 4, 5 | Four goals against City across the two fixtures. Spurs couldn't win a trophy all season — but they did win us the league. |
| 3 | How many PL goals did top scorer Viktor Gyökeres score? | **14** | 12, 13, 14, 15 | 14 goals in his debut Arsenal season. Not bad for a flop. |
| 4 | Which two Arsenal players shared the most yellow cards (5 each)? | **Calafiori & Timber** | Calafiori & Timber / Zubimendi & Gabriel / Mosquera & Gabriel / Rice & Zubimendi | Calafiori and Timber — 5 yellows each. Some things never change. |
| 5 | How many Arsenal players made more PL assists than Trossard? | **0** | 0, 1, 2, 3 | Trossard finished joint-top with Ødegaard on 6 assists. Zero players made more. Still underrated. |
| 6 | What was Arsenal's longest unbeaten run in the league this season? | **11** | 7, 9, 11, 13 | 11 games unbeaten — the run that put the title beyond doubt. |
| 7 | How many times did Arsenal score 5+ goals in a PL game this season? | **1** | 0, 1, 2, 3 | Once — 5-0 vs Leeds at the Emirates, August 2025. Timber scored twice, Gyökeres got his first goals for the club. |
| 8 | How many times did Arsenal concede more than 2 goals in a PL game? | **1** | 0, 1, 2, 3 | Just once all season — and the only time Arsenal conceded more than 2 in a league game since 2023. |
| 9 | Which outfield player logged the most PL minutes for Arsenal? | **Declan Rice** *(3,094)* | Rice, Zubimendi, Gabriel, Saliba | Declan Rice: 3,094 minutes — 4 goals, 5 assists, and barely off the pitch all season. |
| 10 | How many Arsenal players scored a PL penalty this season? | **2** | 1, 2, 3, 4 | Gyökeres and Saka — Gyökeres scored 3, Saka 1. All four converted. |

**⚠️ Remaining unverified: Q1 (clean sheets), Q2 (Spurs vs City goals), Q4 (yellows), Q5 (Trossard assists), Q6 (unbeaten run), Q9 (Rice minutes). Q7 (5-0 Leeds), Q8 (conceded 2+), Q10 (penalties: Gyök 3, Saka 1) confirmed.**

---

### Round 5 — Corner Kings
**Subtitle:** "Arsenal broke records scoring from corners. Who got on the end of this one?"  
**Format:** Show a photo of an Arsenal corner goal. Player picks the goalscorer from 4 options.  
**Points:** 10 per correct answer  
**Status:** ✅ Built and live — 5 of 10 photos in place, 5 placeholders remaining  
**Photos:** `client/public/arsenal-quiz/corners/` (⚠️ must be in `client/public/`, not `public/`)

**Current question list (live in code):**

| Q | Scorer | Opponent | Date | Photo |
|---|--------|----------|------|-------|
| 1 | Martín Zubimendi | Nottingham Forest | 13 Sep 2025 | ✅ `01-zubimendi-forest-2025.jpg` |
| 2 | Kai Havertz | Burnley | 18 May 2026 | ✅ `02-havertz-burnley-2024.jpg` |
| 3 | Gabriel Magalhães | Newcastle (away) | 28 Sep 2025 | ✅ `03-gabriel-newcastle-2025.jpg` |
| 4 | Oleksandr Zinchenko | Burnley | 11 Nov 2023 | ✅ `04-zinchenko-burnley-2023.jpg` |
| 5 | Jurrien Timber | Chelsea | 1 Mar 2026 | ✅ `05-timber-chelsea-2026.jpg` |
| 6 | TBD | — | — | ❌ placeholder |
| 7 | TBD | — | — | ❌ placeholder |
| 8 | TBD | — | — | ❌ placeholder |
| 9 | TBD | — | — | ❌ placeholder |
| 10 | Eberechi Eze | Newcastle | Apr 2026 | ✅ `10-eze-newcastle-2026.jpg` |

**Remaining candidates for Q6–Q9:**
- Gabriel vs Chelsea (away) — Nov 2022
- Trossard vs Everton — Sep 2023 (short corner, most viral)
- Havertz vs Tottenham (away) — Apr 2024 (NLD, Arteta's 100th PL win)
- Gabriel vs Man City (away) — Sep 2024 (10 men, Jover celebration)
- Gabriel vs Tottenham (home) — Sep 2024 (1-0 NLD winner)
- Timber vs Man Utd (home) — Dec 2024 (near-post flick)
- Saliba vs Chelsea (home) — Mar 2026 (record-equalling 15th)

**Key context:** Nicolas Jover (set-piece coach, from Man City) designed the routines. Arsenal broke the all-time PL record with 17 corner goals in 2025-26 (previous record: 16, shared by Oldham 1992-93, WBA 2016-17, Arsenal 2023-24).

---

### Round 6 — Top Scorers
**Subtitle:** "From the full list of Arsenal players under Arteta — select the top 10 PL goalscorers"  
**Format:** Show all ~68 Arsenal PL players under Arteta. Player taps/clicks to select exactly 10. Submit when done.  
**Points:** 10 per correct player in the top 10 (100 max), 0 per wrong selection  
**Status:** ✅ Built and live

**The correct answer (from official PL API, all 7 Arteta seasons):**
| Rank | Player | PL Goals |
|------|--------|----------|
| 1 | Bukayo Saka | 60 |
| 2 | Gabriel Martinelli | 41 |
| 3 | Pierre-Emerick Aubameyang | 36 |
| 4 | Martin Ødegaard | 35 |
| 5 | Leandro Trossard | 27 |
| 6 | Alexandre Lacazette | 27 |
| 7 | Kai Havertz | 24 |
| 8 | Gabriel Jesus | 20 |
| 9 | Gabriel Magalhães | 20 |
| 10 | Eddie Nketiah | 18 |

**Pool shown to player:** All players from arteta-arsenal-stats.json, grouped by position (Defenders → Midfielders → Attackers), sorted A–Z by surname within each group. GKs fall under Defenders.  
**Tricky traps:** Pépé (16g), Emile Smith Rowe (12g), Rice (15g) — close but outside top 10  
**UX note:** Selected X/10 counter top-right; submit button appears once 10 chosen

---

### Round 7 — The Assist Masters
**Subtitle:** "From the full list — select the top 10 PL assisters under Arteta"  
**Format:** Same mechanic as Round 6 but for assists  
**Points:** 10 per correct player in the top 10  
**Status:** ✅ Built and live

**The correct answer:**
| Rank | Player | PL Assists |
|------|--------|------------|
| 1 | Bukayo Saka | 50 |
| 2 | Martin Ødegaard | 37 |
| 3 | Leandro Trossard | 24 |
| 4 | Gabriel Martinelli | 23 |
| 5 | Declan Rice | 20 |
| 6 | Alexandre Lacazette | 13 |
| 7 | Granit Xhaka | 13 |
| 8 | Kai Havertz | 12 |
| 9 | Ben White | 12 |
| 10 | Gabriel Jesus | 11 |

**Pool shown to player:** Same mechanic as Round 6 — grouped by position, A–Z by surname  
**Tricky traps:** Xhaka (13a) — many fans forget how many assists he had; Ben White (12a) as right-back surprises people

---

### Round 8 — Who Has Most?
**Subtitle:** "Four Arteta-era Gunners. One stat. Who leads?"  
**Format:** Each question shows a single stat ("PL appearances under Arteta") plus 4 player options. Player picks whichever of the 4 has the highest value. Stats are aggregated across all 7 Arteta PL seasons (2019/20 → 2025/26).  
**Points:** 1 per correct = 10 per round  
**Status:** ✅ Built and live. All 10 questions confirmed with official PL API data.  
**Data source:** [`scripts/fetch-arteta-stats.mjs`](../scripts/fetch-arteta-stats.mjs) pattern, official PL API at `footballapi.pulselive.com`. Stats endpoints confirmed working: `appearances`, `goals`, `goal_assist`, `yellow_card`, `red_card`, `mins_played`, `own_goals`, `att_pen_goal`, `att_hd_goal`, `att_obox_goal`, `big_chance_missed`, `fouls`.

**The 10 questions (Q1–Q8 confirmed, Q9–Q10 placeholders):**

| # | Stat | Options (value) | Answer |
|---|------|-----------------|--------|
| 1 | PL appearances under Arteta | Fábio Vieira (33), Eberechi Eze (31), Lucas Torreira (29), Sead Kolasinac (29) | **Vieira** |
| 2 | PL goals in a single season under Arteta | Saka (16, 23/24), Martinelli (15, 22/23), Ødegaard (15, 22/23), Gyökeres (14, 25/26) | **Saka** |
| 3 | PL yellow cards under Arteta | Saka (28), Gabriel Magalhães (25), Partey (22), Ben White (18) | **Saka** *(Xhaka is the era-wide leader on 32 — excluded so Saka is the surprise answer)* |
| 4 | PL goals under Arteta | Havertz (24), Jesus (20), Gabriel Magalhães (20), Nketiah (18) | **Havertz** |
| 5 | PL assists under Arteta | ESR (9), Tierney (8), Timber (8), Zinchenko (5) | **ESR** *(Pépé also on 9 — excluded to avoid tie at top)* |
| 6 | PL penalty goals scored under Arteta | Pépé (2), Jesus (1), Havertz (1), Vieira (1) | **Pépé** *(Saka excluded — he'd run away with 12)* |
| 7 | PL goals from outside the box under Arteta | ESR (4), Martinelli (3), Trossard (2), Xhaka (2) | **ESR** *(Ødegaard is era leader on 8 — excluded)* |
| 8 | PL headed goals under Arteta | Merino (7), Havertz (5), Saliba (4), Lacazette (3) | **Merino** *(Gabriel Magalhães is era leader on 13 — excluded)* |
| 9 | PL red cards under Arteta | David Luiz (3), Gabriel Magalhães (2), Xhaka (2), Lewis-Skelly (2) | **David Luiz** |
| 10 | PL minutes played under Arteta (cameo edition) | Balogun (70), Kepa (90), Nørgaard (101), Mkhitaryan (111) | **Mkhitaryan** *(all four under 2 hours — the cult cameos round)* |

**Q9 / Q10 ideas to consider (some need extra data fetching):**
- Most career hat-tricks for Arsenal (manual research)
- Most clubs in senior career (Wikipedia — Jorginho / Willian / Merino / Trossard)
- Tallest in current squad (Havertz 1.93 / Saliba / Gabriel / Mosquera)
- Most managers played under at Arsenal (Wenger + Emery + Ljungberg + Arteta crowd — David Luiz, Auba, Bellerín, Xhaka)
- Most fouls committed (Saka 221 runaway leader)
- Most big chances missed (Saka 42 / Martinelli 37 / Havertz 34 / Jesus 32)
- Most goals vs Tottenham / Man City (needs match-by-match API scraping)
- Most stoppage-time goals (needs per-event timing scrape)

**UX notes:**
- Options shuffle on mount so position is randomised per play
- After selection, all 4 values are revealed inline on the buttons (not just the correct one) — supports the "see how close it was" payoff
- TBD placeholder questions show a "Placeholder — TBD" gold tag under the stat
- Data lives inline in `ROUND8_QUESTIONS` array (no separate JSON) — easy to swap candidates

---

### Round 8 — DEPRECATED: Memory Lane *(replaced May 2026)*
~~Date-the-photo round. Replaced because sourcing 10 photos with verified dates was a bottleneck and the round didn't tie into Arteta-era stats the way other rounds do. "Who Has Most?" uses live PL API data so no asset sourcing is needed.~~

---

### Round 9 — Arteta's First XI *(originally "Build the XI")*
**Subtitle:** "Arteta's very first Arsenal starting XI. Boxing Day, Bournemouth, 2019. Name all ten outfield starters."  
**Format:** Pool of ~25 players (from 2019/20 squad). Player taps to assign across 3 screens: Defenders (4) → Midfield (3) → Attackers (3). GK (Leno) excluded. Players committed on a previous screen are dimmed.  
**Points:** 10 per correctly placed player  
**Status:** ✅ Built and live

**Correct answer:**
- Defenders: Maitland-Niles, Sokratis, David Luiz, Saka (LB — aged 18, the twist)
- Midfield: Torreira, Xhaka, Özil
- Attack: Nelson, Aubameyang, Lacazette

**Pool:** Above 10 + Kolašinac, Pépé, Mustafi, Bellerín, Holding, Guendouzi, Ceballos, Mkhitaryan, Martinelli, Nketiah, Chambers, Tierney, Willock, Elneny (no recent signings like Gyökeres, Eze, Zubimendi, Madueke)

---

### Round 10 — Guess the Score
**Subtitle:** "How well do you know the Arteta era?"  
**Format:** Show match date, venue, context, and starting XIs for both teams. Player picks the correct final score from 4 options.  
**Points:** 10 per correct score  
**Status:** ✅ Built and live  
**Tone:** Pro-Arsenal throughout. Celebratory context. Careful not to say "running away with it" in seasons Arsenal didn't win.

**⚠️ Correction:** The Man City game in Sep 2024 was **2-2** (not 2-1 as previously noted in this doc). Arsenal led 2-1 with 10 men before Stones equalized in the 98th minute.  
**⚠️ Correction:** Chelsea's goalkeeper in the Mar 2026 game was Robert Sanchez, not Schmeichel (who was on TV being furious). Doesn't affect any round content.

---

**The 10 confirmed games (in display order):**

#### Game 1 — Arsenal 2-0 Manchester United
**Date:** 1 January 2020 | **Venue:** Emirates Stadium
**Context:** Arteta's first Premier League win as manager. New Year's Day. Arsenal were transformed.
**Arsenal XI:** Leno; Maitland-Niles, Sokratis, David Luiz, Kolasinac; Torreira, Xhaka; Pepe, Özil, Aubameyang; Lacazette
**Man Utd XI:** De Gea; Wan-Bissaka, Lindelöf, Maguire, Shaw; Fred, Matic; James, Lingard, Rashford; Martial
**Plausible wrong scores:** 1-0, 1-1, 3-0

---

#### Game 2 — Arsenal 3-2 Liverpool
**Date:** 9 October 2022 | **Venue:** Emirates Stadium
**Context:** Martinelli opened after 58 seconds — Arsenal's quickest-ever PL goal against Liverpool. Arsenal came from 1-1 and 2-2 to win. Arsenal were top of the league.
**Arsenal XI:** Ramsdale; White, Saliba, Gabriel, Tomiyasu; Partey, Xhaka; Saka, Ødegaard, Martinelli; Jesus
**Liverpool XI:** Alisson; Alexander-Arnold, Matip, Van Dijk, Tsimikas; Henderson, Thiago; Salah, Jota, Díaz; Núñez
**Plausible wrong scores:** 2-1, 1-0, 2-2

---

#### Game 3 — Arsenal 1-0 Manchester City
**Date:** 8 October 2023 | **Venue:** Emirates Stadium
**Context:** Ended a run of 12 consecutive PL defeats to City. Martinelli 86th min. Saka absent. A statement win.
**Arsenal XI:** Raya; White, Saliba, Gabriel, Zinchenko; Rice, Jorginho, Ødegaard; Jesus, Nketiah, Trossard
**Man City XI:** Ederson; Walker, Dias, Aké, Gvardiol; Kovačić, Bernardo Silva, Rico Lewis; Álvarez, Haaland, Foden
**Plausible wrong scores:** 0-0, 2-0, 2-1

---

#### Game 4 — Arsenal 3-1 Liverpool
**Date:** 4 February 2024 | **Venue:** Emirates Stadium
**Context:** Arsenal sliced the gap to 2 points at the top. Trossard 90+2'. Konaté red card. Alisson errors influential.
**Arsenal XI:** Raya; White, Saliba, Gabriel, Zinchenko; Ødegaard, Rice, Jorginho; Saka, Havertz, Martinelli
**Liverpool XI:** Alisson; Alexander-Arnold, Konaté, Van Dijk, Gomez; Gravenberch, Mac Allister, Curtis Jones; Gakpo, Jota, Díaz
**Plausible wrong scores:** 2-0, 2-1, 1-1

---

#### Game 5 — Arsenal 5-0 Chelsea
**Date:** 23 April 2024 | **Venue:** Emirates Stadium
**Context:** Chelsea's heaviest ever defeat by Arsenal. Ben White and Havertz each scored twice in a 20-minute spell. Arsenal went three points clear at the top.
**Arsenal XI:** Raya; Tomiyasu, Saliba, Gabriel, White; Partey, Rice, Ødegaard; Trossard, Havertz, Saka
**Chelsea XI:** Petrovic; Disasi, Badiashile, Cucurella, Gilchrist; Caicedo, Enzo Fernández; Mudryk, Gallagher, Madueke; Jackson
**Plausible wrong scores:** 3-0, 4-0, 3-1

---

#### Game 6 — Manchester City 2-2 Arsenal
**Date:** 22 September 2024 | **Venue:** Etihad Stadium
**Context:** Trossard off for kicking ball away (10 men from HT). Arsenal still led 2-1 heading into injury time. Stones equalized in the 98th minute. Haaland walked over to Arteta: "Stay humble, eh." Rodri went off injured.
**Man City XI:** Ederson; Walker, Dias, Akanji, Gvardiol; Rodri, Gündogan; Savinho, Bernardo Silva, Doku; Haaland
**Arsenal XI:** Raya; Timber, Saliba, Gabriel, Calafiori; Partey, Rice; Saka, Trossard, Martinelli; Havertz
**Plausible wrong scores:** 1-1, 2-1 Arsenal, 3-2 City

---

#### Game 7 — Arsenal 5-1 Manchester City
**Date:** 2 February 2025 | **Venue:** Emirates Stadium
**Context:** Ødegaard scored after 2 minutes. City briefly equalized through Haaland, then Arsenal scored four more. Nwaneri came off the bench for the fifth. A statement result in a tight title race.
**Arsenal XI:** Raya; Timber, Saliba, Gabriel, Lewis-Skelly; Ødegaard, Partey, Rice; Trossard, Havertz, Martinelli
**Man City XI:** Ortega; Nunes, Akanji, Stones, Gvardiol; Bernardo Silva, Kovačić; Savinho, Foden, Marmoush; Haaland
**Plausible wrong scores:** 3-1, 4-1, 2-0

---

#### Game 8 — Bournemouth 2-3 Arsenal (comeback)
**Date:** 3 January 2026 | **Venue:** Vitality Stadium
**Context:** Arsenal went behind early, levelled quickly through Gabriel, then Rice's brace turned it around. Bournemouth pulled one back late. Arsenal held on — six-point lead at the top.
**Bournemouth XI:** Petrovic; Jiménez, Hill, Senesi, Truffert; Scott, Tavernier, Brooks; Semenyo, Evanilson, Kluivert
**Arsenal XI:** Raya; Timber, Saliba, Gabriel, Hincapié; Ødegaard, Zubimendi, Rice; Madueke, Gyökeres, Martinelli
**Plausible wrong scores:** 1-2, 1-1, 2-2

---

#### Game 9 — Arsenal 4-1 Tottenham
**Date:** 23 November 2025 | **Venue:** Emirates Stadium
**Context:** Eze — who had snubbed Spurs to join Arsenal that summer — scored a hat-trick against his former club. Only the fourth player in history to score an NLD hat-trick. Arsenal went six points clear at the top.
**Arsenal XI:** Raya; Timber, Saliba, Hincapié, Calafiori; Zubimendi, Rice; Saka, Eze, Trossard; Merino
**Tottenham XI:** Vicario; Danso, Romero, van de Ven; Udogie, Bentancur, Palhinha, Spence; Simons, Kudus; Richarlison
**Plausible wrong scores:** 3-1, 2-0, 3-0

---

#### Game 10 — Arsenal 1-0 Burnley
**Date:** 18 May 2026 | **Venue:** Emirates Stadium
**Context:** Havertz headed in from a corner. Saka's 50th PL assist. Man City drew 1-1 at Bournemouth the following night — Arsenal were champions. The title was 22 years in the making.
**Arsenal XI:** Raya; Saliba, Mosquera, Gabriel, Calafiori; Rice, Eze; Ødegaard, Trossard, Saka; Havertz
**Burnley XI:** Weiss; Walker, Estève, Tuanzebe, Pires; Ugochukwu, Florentino; Anthony, Mejbri, Tchaouna; Flemming
**Plausible wrong scores:** 2-0, 1-1, 0-0

---

## Assets Needed (Photos)

All photos go in `public/arsenal-quiz/` with subfolders:
- `corners/` — 10 corner goal photos (live Round 7 — Corner Kings)

**Photo specs:** Compress to <200KB each. JPEG preferred. Repo size impact: ~4MB total, fine for GitHub Pages.

---

## Data Files

| File | Purpose | Status |
|------|---------|--------|
| `client/src/data/arteta-arsenal-stats.json` | All Arsenal PL players under Arteta, goals/assists/apps per season + totals | ✅ Live |
| `client/src/data/pl-players.json` | All PL players all-time, per club | ✅ Updated May 2026 |
| `scripts/fetch-arteta-stats.mjs` | Re-fetch Arsenal Arteta-era stats from PL API | ✅ Available |

---

## Session State (as of May 24 2026)

### What's built and live
- ✅ Full shell: intro, between-rounds, results
- ✅ **Round 1** — Trust the Process: ▲▼ number pickers (same as Round 10), home/away format, Arsenal highlighted red. "Leicester" label fix applied.
- ✅ **Round 2** — Who Doubted Us?: 10 quotes, 4-option MC, options shuffle on mount, reveal context. Q7 = John Obi Mikel (talkSPORT, 11 Mar 2026), Q8 = Gabriel Agbonlahor (talkSPORT, May 2025).
- ✅ **Round 3** — Arteta Speaks: 10 Arteta press conference quotes, 4-option MC, options shuffle on mount. ⚠️ Quotes need user verification before going live.
- ✅ **Round 4** — The Season That Won It: 10 MC stats questions. Q7 (5-0 Leeds), Q8 (conceded 2+), Q10 (penalties: Gyök 3, Saka 1) verified. Remaining Qs need user verification.
- ✅ **Round 5** — Corner Kings: 10 corner goal questions with photo slots. CornerPhotoSlot component shows placeholder until real images added. ⚠️ User to source photos → `public/arsenal-quiz/corners/`.
- ✅ **Round 6** — Top Scorers: full player pool from arteta-arsenal-stats.json, select-10 mechanic, gold/red/faded reveal.
- ✅ **Round 7** — Assist Masters: same mechanic as Round 6, assist data.
- ✅ **Round 8** — Who Has Most?: 4-option MC, 10 stat-comparison questions across the Arteta era. All 10 confirmed PL API data. Q10 is a cult "cameo edition" twist — Balogun/Kepa/Nørgaard/Mkhitaryan, all four players ever to register Arsenal PL minutes under Arteta yet finish sub-2 hours. Options shuffle on mount; all 4 values revealed inline after selection.
- ✅ **Round 9** — Arteta's First XI *(renamed from "Build the XI")*: **Arteta's debut XI, Boxing Day 2019 vs Bournemouth**. 3 screens: Defenders → Midfield → Attackers. Pool = 2019/20 squad, recent signings excluded. Results header fixed (was incorrectly showing "Burnley 2026").
- ✅ **Round 10** — Guess the Score: ▲▼ number pickers, "Show Starting XIs" toggle, lock-in + reveal.

### Round 9 (originally) — Arteta's First XI — debut XI data (confirmed)
**Match:** Bournemouth 1-1 Arsenal, Boxing Day 26 Dec 2019  
**Formation:** 4-3-3 (GK Leno excluded from quiz)  
- **Defenders (4):** Maitland-Niles, Sokratis, David Luiz, Saka (at LB, aged 18)  
- **Midfield (3):** Torreira, Xhaka, Özil  
- **Attack (3):** Nelson, Aubameyang, Lacazette  
**Pool also includes:** Kolašinac, Pépé, Mustafi, Bellerín, Holding, Guendouzi, Ceballos, Mkhitaryan, Martinelli, Nketiah, Chambers, Tierney, Willock, Elneny

### Key implementation notes
- All buttons are plain `<button>` (no shadcn) — avoids global green focus ring
- Bebas Neue loaded via Google Fonts in index.html
- Commit + push = live in ~1 min (GitHub Actions). No local npm builds (Kandji MDM blocks)
- Round 1 uses `homeTeam/awayTeam/homeScore/awayScore` — ▲▼ pickers, correct on submit
- Rounds 2 + 3: `useState(() => quotes.map(q => ({...q, options: shuffle})))` for stable per-session shuffle

### Round build status *(in live game order)*
1. ✅ Who Doubted Us?
2. ✅ Who Has Most?
3. ✅ Arteta's First XI *(renamed from Build the XI)*
4. ✅ Top Scorers
5. ✅ Trust the Process
6. ✅ Arteta Speaks ⚠️ verify quotes
7. ✅ Corner Kings ⚠️ needs photos
8. ✅ Guess the Score
9. ✅ The Assist Masters
10. ✅ The Season That Won It ⚠️ verify stats

### Corrections (important)
- Sep 2024 Man City game was **2-2**, not 2-1 (Stones 98th min equaliser)
- Mar 2026 Chelsea goalkeeper was **Robert Sanchez**, not Schmeichel (Schmeichel was pundit on TV)
- Title confirmed when **Man City drew 1-1 at Bournemouth** the night AFTER the Burnley win

## Open Questions / TODOs

*(Round numbers below = live game order, per the Final Round Order table at top.)*

- [x] **Scoring format:** No timer. +1 per correct, 0 wrong. 100 total (10 per round).
- [x] **Full data verification pass (all 10 rounds)** — completed May 2026 against official PL API + web search. 9 errors caught and fixed in one commit. See **Verification Log** section below.
- [ ] **Live R7 — Corner Kings:** User to source 5 remaining photos → `public/arsenal-quiz/corners/` (Q6–Q9)
- [ ] **Firebase leaderboard:** Add `arsenal-champions-2026` game to Firebase rules + leaderboard page
- [ ] **Home page card:** Add to drapk.in home page with Arsenal red/gold branding

---

## Verification Log (May 2026)

Every fact, score, lineup and stat across all 10 rounds was checked against `footballapi.pulselive.com` (the official PL API). Quote attributions checked via web search.

| Round (live) | What was checked | Result |
|--------------|------------------|--------|
| R1 Who Doubted Us? | 10 quote attributions | 8 ✅, 2 fixed (Q8 Agbonlahor date, Q9 Merson context) |
| R2 Who Has Most? | 10 stat-comparison numbers | ✅ All 10 verified against PL API |
| R3 Arteta's First XI | Bournemouth Boxing Day 2019 starting XI | ✅ Matches PL API exactly |
| R4 Top Scorers | Top 10 PL goalscorers under Arteta | ✅ Set matches PL API totals |
| R5 Trust the Process | 10 game scores from 2020/21 | ✅ All 10 match |
| R6 Arteta Speaks | 10 Arteta quote attributions | 9 ✅, 1 fixed (Q4 Havertz date) |
| R7 Corner Kings | 5 confirmed corner scorers + match results | ✅ All 5 scorers + match results verified. Q5 reveal corrected: 16 corner goals *tied* the PL record, didn't break it. |
| R8 Guess the Score | 10 game scores + starting XIs | Scores ✅. Lineups: 8 ✅, 2 fixed (Game 2 Bournemouth — 4 wrong players; Game 5 West Ham — Jesus→Trossard). |
| R9 The Assist Masters | Top 10 PL assisters under Arteta | ✅ Set matches PL API totals |
| R10 The Season That Won It | 10 stats from 2025/26 | 8 ✅, 2 fixed (Q4 yellows premise broken — 3 players tied not 2; Q9 Rice minutes 3,094→3,099). Q8 reveal also tweaked — Luton 4-3 (Dec 2023) had been overlooked. |

**Total fixes applied:** 9 errors corrected in one commit.

---

## Second audit pass — Arteta cutoff correction (May 2026)

Discovered that the original `fetch-arteta-stats.mjs` script aggregated the full 2019/20 PL season as "Arteta era" — but Arteta's first game was Boxing Day 2019 (26 Dec). Arsenal played 18 PL games before that under Emery + Ljungberg. Those minutes/goals/cards were silently inflating the Arteta-era totals.

**Most exposed case:** Round 8 "Who Has Most? — cameo edition" had Henrikh Mkhitaryan as the answer with 111 PL minutes — but every single one of those minutes was *pre-Arteta* (he loaned to Roma in Sept 2019, two months before Arteta took over). Same story for Nacho Monreal, who'd left for Real Sociedad in July 2019.

**Refetched all stats with proper cutoff** (Dec 26 2019). Source: official PL API match events for the 20 post-Arteta 19/20 fixtures, combined with full-season stats for 20/21–25/26.

### Changes applied

| Round / Q | Issue | Fix |
|-----------|-------|-----|
| R2 Q1 (apps) | Torreira (29→14) and Kolasinac (29→15) cratered — most apps were pre-Arteta | New candidates: Vieira (33) / Eze (32) / Maitland-Niles (30) / Willian (25) — Vieira still wins |
| R2 Q3 (yellows) | Saka 28→26, Xhaka era leader 32→28 | Updated reveal numbers |
| R2 Q4 (goals) | Jesus 20→21 (recent goal), Gabriel still 20 — tie broken | Updated value + reveal |
| R2 Q8 (headed) | Lacazette 3→2 (one was pre-Arteta) | Updated value |
| R2 Q10 (cameo) | Mkhitaryan and Monreal both had 0 post-Arteta minutes | Replaced with Marquinhos (1) / Balogun (70) / Kepa (90) / Nørgaard (101) — Nørgaard wins |
| Player pool (R4/R9) | Mkhitaryan + Monreal incorrectly listed as Arteta-era | Removed from `arteta-arsenal-stats.json` (pool now 66, was 68) |

### Verified unchanged after cutoff

- R2 Q2 (single-season goals), Q5 (assists), Q6 (pens), Q7 (outside box), Q9 (reds) — winners and tallies all still correct
- R4 Top Scorers and R9 Assist Masters — same 10 players in each top-10 set (order shifts but the round mechanic doesn't care about order)
- R10 (25/26 stats), R5 (2020/21 scores), R8 (10 landmark games), R3 (Boxing Day XI), R1/R6/R7 — none affected by 19/20 cutoff

### Known approximation

For derived/Opta-coded stats (`att_hd_goal`, `att_obox_goal`, `att_pen_goal`) the PL API doesn't expose per-match values. The 19/20 portion of these uses event-based counting where possible (penalty goals manually corrected: Aubameyang and Pépé each had one post-Arteta pen in 19/20). For headed goals and outside-box goals the 19/20 contribution is taken as ~0 (small approximation, doesn't change any answer).

---

## R3 Arteta's First XI — formation results + position-blind scoring (May 2026)

Old behaviour: each pick was credited only if placed in the right category (defender / midfielder / attacker). So picking Özil as an attacker, when he started in midfield, gave 0 points even though the user had correctly identified him as a starter.

New behaviour:
- Score = how many of the user's 10 picks appear in the actual XI, regardless of category. Özil-in-the-wrong-row now scores.
- Results screen redesigned as a 4-3-3 formation board. GK (Leno) sits greyed out and dashed-bordered at the top (he was excluded from the picking phase).
- Each missed starter shows the user's wrong pick from that category below it (e.g. *missed: David Luiz, you picked: Mustafi*).
- Wrong picks that don't pair to a missed slot in their category go into an "Other wrong picks" footer chip row.
- Stale "Burnley 2026" subtitle fixed to "Bournemouth vs Arsenal · 26 Dec 2019".

---

## Anonymous play + opt-in leaderboard (May 2026)

The Arsenal quiz is the first game on drapk.in that does **not** force account creation. App-level change: `/arsenal-pl-champions-2026` is in an `ANON_ALLOWED_ROUTES` list in `App.tsx`, so the global `UsernamePicker` overlay is skipped on that route.

| Behaviour | Logged-in user | Anonymous user |
|-----------|----------------|----------------|
| Plays the quiz | ✅ Same as other games | ✅ No signup required |
| Every play recorded | ✅ Written to `quiz_plays` with `username` set | ✅ Written to `quiz_plays` with `username: null` and a localStorage `anonId` |
| Leaderboard submission | Auto-submitted to the existing `scores` collection on results screen mount | Hidden behind a "See Where You Rank" CTA. Tapping it opens the standard `UsernamePicker` overlay. After signup the `useEffect` picks up the new user and auto-submits the score, then expands the leaderboard inline. |

New files:
- `client/src/lib/quiz-plays.ts` — anonymous play tracker, generates a per-browser `pcb-anon-id` in localStorage.
- `firestore.rules` — repo-tracked rules file.
- `firebase.json` / `.firebaserc` — config so `firebase deploy --only firestore:rules` works without re-running `firebase init`.

Firestore rules deployed via CLI on 25 May 2026. New `quiz_plays` collection added with `allow read: false` (server-only analytics) and `allow create: true` (anyone can write). Existing rules for `users` / `scores` / `daily-scores` left untouched in their permissive style — `arsenal-champions-2026` works under the existing `scores` rule because game is unconstrained.

`GameSlug` type in `client/src/lib/save-score.ts` gained the new `"arsenal-champions-2026"` member so it ties into the existing leaderboard hook (`useGameLeaderboard`).

---

## Celebratory flair pass (May 2026)

The quiz now feels less like a quiz and more like a celebration. Visual layer added across the journey:

| Surface | What changed |
|---------|--------------|
| Intro screen | Static trophy emoji replaced with a **hero photo** (Arteta + trophy from the post-Burnley title-clincher), framed in a pulsing gold glow. Below the existing title block, a shimmering **"22 Years In The Making"** sub-banner using a CSS gradient + `ac-shimmer` keyframe in `index.css`. |
| Between-rounds screens | Each of the 10 rounds gets a **thematic celebration photo** (`client/public/arsenal-quiz/gallery/01-doubters.jpg` → `10-season.jpg`). The descriptions are also rewritten as punchier one-liner taglines (e.g. R1: "No team had more doubters. Pundits, rivals, neutrals. Put a face to each take."). |
| Results screen | When the final score exceeds 60 the user gets **falling confetti** (gold + red + white + light-gold) across the viewport. Lighter scores get no confetti by design — fair signal that they didn't quite earn it. |
| End-of-game closer | After Round 10 completes, before transitioning to the results screen, a **full-screen red CHAMPIONS overlay** holds for ~4 seconds: bouncing trophy, shimmering CHAMPIONS wordmark, "22 Years Later", "2025-26 Premier League", confetti throughout. |

Photo mapping (live round order → file):
1. Who Doubted Us? → `01-doubters.jpg` (Ødegaard trophy + red confetti)
2. Who Has Most? → `02-most.jpg` (Saka holding trophy)
3. Arteta's First XI → `03-xi.jpg` (Arteta thrown in the air by squad)
4. Top Scorers → `04-scorers.jpg` (Havertz with trophy)
5. Trust the Process → `05-process.jpg` (squad photo, packed stadium)
6. Arteta Speaks → `06-arteta.jpg` (full team + Arteta + staff group shot)
7. Corner Kings → `07-corners.jpg` (Gabriel with trophy, Brazil flag)
8. Guess the Score → `08-scores.jpg` (Rice lifting trophy, confetti)
9. The Assist Masters → `09-assists.jpg` (Trossard with trophy held high)
10. The Season That Won It → `10-season.jpg` (Eze kissing the trophy)

`RoundDef` gained an optional `photo` field. If a future round has no photo, the between-rounds screen falls back to the existing emoji-only design.

---

## Tech Notes

- **File:** `client/src/pages/arsenal-champions.tsx` (one file, self-contained)
- **Route:** Added to `App.tsx` as `/arsenal-pl-champions-2026`
- **No new Firebase collections** until rules are updated in Firebase Console
- **Builds:** Commit + push only (Kandji blocks local npm). GitHub Actions → live in ~1 min.
- **No lockfile** — `npm install` not `npm ci`
