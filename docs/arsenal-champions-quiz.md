# Arsenal PL Champions 2026 — Quiz Master Plan

**Route:** `/arsenal-pl-champions-2026`  
**File:** `client/src/pages/arsenal-champions.tsx`  
**Data:** `client/src/data/arteta-arsenal-stats.json` (Arteta-era PL stats, from official PL API)  
**Status:** Core shell building/deploying

---

## Concept

A 10-round commemorative quiz celebrating Arsenal's 2025-26 Premier League title win — the end of a 22-year wait. Players relive the full Arteta era (Dec 2019–May 2026): the dark times, the near-misses, the doubters, and the triumph. Celebratory in tone, but knowledge-testing in substance.

**Audience:** Arsenal fans  
**Vibe:** Arsenal red + gold, dark background, premium and celebratory  
**Format:** 10 sequential rounds, 10 questions each, 100 points per round, 1000 total  
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

## The 10 Rounds

### Round 1 — Trust the Process
**Subtitle:** "How bad did it get?"  
**Format:** 10 games from Arsenal's 2020/21 horror run (image provided by user). For each game show: opponent, date, home/away. Player selects the correct final score from 4 options.  
**Points:** 10 per correct score  
**Status:** ⏳ Data ready (from image), needs building

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
**Status:** ⏳ Quotes verified, needs building. User to verify all source URLs personally.

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
**Status:** 🔴 Content needed — requires sourcing 10 Arteta quotes about specific players  
**Suggested players to target:** Saka, Ødegaard, Saliba, Rice, Martinelli, Havertz, Gabriel, Timber, Raya, White  
**TODO:** Research 10 quotes from Arteta press conferences attributing specific qualities to specific players. Each should be identifiable but not trivially obvious.

---

### Round 4 — The Season That Won It
**Subtitle:** "2025/26 — the numbers behind the title"  
**Format:** 10 multiple-choice stats questions about the 2025-26 PL season specifically  
**Points:** 10 per correct answer  
**Status:** 🔴 Content needed — needs building. Numbers need verification before going live.

| # | Question | Answer | Options | Reveal context |
|---|----------|--------|---------|----------------|
| 1 | How many PL clean sheets did Arsenal keep in 2025-26? | **19** | 17, 18, 19, 20 | David Raya: 19 clean sheets, 3 Golden Gloves in a row. The wall. |
| 2 | How many goals did Spurs score against Man City across both PL fixtures? | **4** | 2, 3, 4, 5 | Four goals against City across the two fixtures. Spurs couldn't win a trophy all season — but they did win us the league. |
| 3 | How many PL goals did top scorer Viktor Gyökeres score? | **14** | 12, 13, 14, 15 | 14 goals in his debut Arsenal season. Not bad for a flop. |
| 4 | Which two Arsenal players shared the most yellow cards (5 each)? | **Calafiori & Timber** | Calafiori & Timber / Zubimendi & Gabriel / Mosquera & Gabriel / Rice & Zubimendi | Calafiori and Timber — 5 yellows each. Some things never change. |
| 5 | How many Arsenal players made more PL assists than Trossard? | **0** | 0, 1, 2, 3 | Trossard finished joint-top with Ødegaard on 6 assists. Zero players made more. Still underrated. |
| 6 | What was Arsenal's longest unbeaten run in the league this season? | **11** | 7, 9, 11, 13 | 11 games unbeaten — the run that put the title beyond doubt. |
| 7 | How many times did Arsenal score 5+ goals in a PL game this season? | **1** | 0, 1, 2, 3 | Once — 5-1 vs Man City at the Emirates, February 2025. They only needed to do it once. |
| 8 | How many times did Arsenal concede more than 2 goals in a PL game? | **1** | 0, 1, 2, 3 | Just once all season. The defence was almost flawless. |
| 9 | Which outfield player logged the most PL minutes for Arsenal? | **Declan Rice** *(3,094)* | Rice, Zubimendi, Gabriel, Saliba | Declan Rice: 3,094 minutes — 4 goals, 5 assists, and barely off the pitch all season. |
| 10 | How many Arsenal players scored a PL penalty this season? | **2** | 1, 2, 3, 4 | Gyökeres and Saka. Two penalties, both scored, both mattered. |

**⚠️ All numbers need verification from official sources before building**

---

### Round 5 — Corner Kings
**Subtitle:** "Arsenal broke records scoring from corners. Who got on the end of this one?"  
**Format:** Show a photo of an Arsenal corner goal. Player picks the goalscorer from 4 options.  
**Points:** 10 per correct answer  
**Status:** 🔴 Corner goal list pending (research agent running) — user to source 10 photos  
**Photos:** Stored in `public/arsenal-quiz/corners/` in the repo  
**Key context:** Set-piece coach Nicolas Jover designed Arsenal's famous corner routines. Arsenal broke PL records for corner goals under Arteta. Gabriel Magalhães is the primary beneficiary but many others scored.

### Corner Goals Research (from research agent, May 2026)

Arsenal set a new all-time PL record in 2025-26 with **17 corner goals**. Since 2022-23 they've scored 50+ from corners — at least 11 more than any other team. Nicolas Jover (set-piece coach, from Man City) reportedly gets a bonus per Arsenal corner goal.

**10 best photo moments for the quiz (pick these 10):**

| # | Scorer | Opponent | Date | Key detail | Source |
|---|--------|----------|------|-----------|--------|
| 1 | Gabriel | Chelsea (Stamford Bridge) | 6 Nov 2022 | Saka inswinger, Gabriel poked through crowd; 1-0 win in title race | Sky Sports |
| 2 | Trossard | Everton | 17 Sep 2023 | Short corner switch — Saka to Trossard, first-time shot off post. Most viral corner moment | [Sky Sports](https://www.skysports.com/football/news/11095/12961166/) |
| 3 | Zinchenko | Burnley | 11 Nov 2023 | Acrobatic scissor volley after corner hit bar. Won Arsenal Goal of Month | various |
| 4 | Havertz | Tottenham | 28 Apr 2024 | Ben White barged Vicario; Rice delivery; part of 3-2 NLD win (Arteta's 100th PL win) | [Arsenal.com](https://www.arsenal.com/fixture/arsenal/2024-Apr-28/tottenham-hotspur-2-3-arsenal-match-report) |
| 5 | Gabriel | Man City (Etihad) | 22 Sep 2024 | Header while Arsenal down to 10 men; Nicolas Jover's ecstatic celebration widely shared | [Tribuna](https://tribuna.com/en/news/arsenal-2024-09-22-spotted-nicolas-jovers-reaction-to-gabriel-scoring-from-corner/) |
| 6 | Gabriel | Tottenham | 15 Sep 2024 | 64th min header; sole goal in 1-0 NLD win | [Sky Sports](https://www.skysports.com/football/news/12309/13213070/) |
| 7 | Timber | Man Utd | 4 Dec 2024 | Near-post flick from Rice corner; 2-0 win | [Sky Sports](https://www.skysports.com/football/news/11661/13265256/) |
| 8 | Gabriel | Newcastle | 28 Sep 2025 | 96th-minute winner header; comeback from 1 down | [Sky Sports](https://www.skysports.com/football/news/12040/13438480/) |
| 9 | Saliba + Timber | Chelsea | 1 Mar 2026 | Both scored from corners in same match as Arsenal equalled then broke record | [Sky Sports](https://www.skysports.com/football/news/11095/13512600/) |
| 10 | Eze | Newcastle | ~Apr 2026 | Short corner routine; record-breaking 17th corner goal of the season | PL.com |

**Records:**
- 2023-24: 16 corner goals = joint PL record (matched Oldham 1992-93, WBA 2016-17)
- 2025-26: **17 corner goals = new all-time PL record**
- Ødegaard used a subtle hand signal to indicate which routine
- Gabriel's technique: always starts outside box, sprints late; almost all delivered by Saka

**TODO:** User to source and compress photos for each of the 10 above → `public/arsenal-quiz/corners/`

---

### Round 6 — Top Scorers
**Subtitle:** "From the full list of Arsenal players under Arteta — select the top 10 PL goalscorers"  
**Format:** Show all ~68 Arsenal PL players under Arteta. Player taps/clicks to select exactly 10. Submit when done.  
**Points:** 10 per correct player in the top 10 (100 max), 0 per wrong selection  
**Status:** ✅ Data ready (`arteta-arsenal-stats.json`)

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

**Pool shown to player:** All 68 players from arteta-arsenal-stats.json, sorted alphabetically or randomly  
**Tricky traps:** Pépé (16g), Emile Smith Rowe (12g), Rice (15g) — close but outside top 10  
**UX note:** Show a "selected X/10" counter; disable further selection once 10 chosen

---

### Round 7 — The Assist Masters
**Subtitle:** "From the full list — select the top 10 PL assisters under Arteta"  
**Format:** Same mechanic as Round 6 but for assists  
**Points:** 10 per correct player in the top 10  
**Status:** ✅ Data ready (`arteta-arsenal-stats.json`)

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

**Tricky traps:** Xhaka (13a) — many fans forget how many assists he had; Ben White (12a) as right-back surprises people

---

### Round 8 — Memory Lane
**Subtitle:** "When did this happen? Guess the month and year."  
**Format:** Show a photo of an Arsenal moment from the Arteta era. Player picks from 4 date options (month + year).  
**Points:** 10 per correct date  
**Status:** 🔴 User to source 10 photos — moment, date, and photo needed  
**Photos:** Stored in `public/arsenal-quiz/memory-lane/` in the repo

**Suggested moments to cover (spread across the full era):**
1. FA Cup final win — August 2020
2. First PL win under Arteta — January 2020 (vs Man Utd)
3. First Champions League qualification — May 2023
4. First PL win over Man City (Martinelli goal) — October 2023
5. Ødegaard lifting the PL trophy — May 2026
6. A famous NLD win
7. Arteta's first match in charge (Bournemouth away, Dec 2019)
8. A key Saka moment
9. A famous Gabriel header
10. Another significant 2025-26 moment

**Date option format:** e.g. "October 2023" vs "March 2024" vs "January 2023" vs "May 2022" — close enough to need knowledge but distinct enough to be fair

---

### Round 9 — Build the XI
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
**Status:** ⏳ 10 games confirmed and researched — needs building  
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
- `corners/` — 10 corner goal photos (Round 5)
- `memory-lane/` — 10 historical moment photos (Round 8)

**Photo specs:** Compress to <200KB each. JPEG preferred. Repo size impact: ~4MB total, fine for GitHub Pages.

---

## Data Files

| File | Purpose | Status |
|------|---------|--------|
| `client/src/data/arteta-arsenal-stats.json` | All Arsenal PL players under Arteta, goals/assists/apps per season + totals | ✅ Live |
| `client/src/data/pl-players.json` | All PL players all-time, per club | ✅ Updated May 2026 |
| `scripts/fetch-arteta-stats.mjs` | Re-fetch Arsenal Arteta-era stats from PL API | ✅ Available |

---

## Session State (as of May 23 2026)

### What's built and live
- ✅ Full shell: intro, between-rounds, results
- ✅ **Round 1** — Trust the Process: ▲▼ number pickers (same as Round 10), home/away format, Arsenal highlighted red. "Leicester" label fix applied.
- ✅ **Round 2** — Who Doubted Us?: 10 quotes, 4-option MC, options shuffle on mount, reveal context. Q7 = John Obi Mikel (talkSPORT, 11 Mar 2026), Q8 = Gabriel Agbonlahor (talkSPORT, May 2025).
- ✅ **Round 3** — Arteta Speaks: 10 Arteta press conference quotes, 4-option MC, options shuffle on mount. ⚠️ Quotes need user verification before going live.
- ✅ **Round 4** — The Season That Won It: 10 MC stats questions. ⚠️ All numbers need user verification before going live.
- ✅ **Round 5** — Corner Kings: 10 corner goal questions with photo slots. CornerPhotoSlot component shows placeholder until real images added. ⚠️ User to source photos → `public/arsenal-quiz/corners/`.
- ✅ **Round 6** — Top Scorers: full player pool from arteta-arsenal-stats.json, select-10 mechanic, gold/red/faded reveal.
- ✅ **Round 7** — Assist Masters: same mechanic as Round 6, assist data.
- ✅ **Round 8** — Memory Lane: placeholder (needs photos).
- ✅ **Round 9** — Build the XI: **Arteta's debut XI, Boxing Day 2019 vs Bournemouth** (changed from Burnley title-clincher). 3 screens: Defenders → Midfield → Attackers. Pool = 2019/20 squad, recent signings excluded.
- ✅ **Round 10** — Guess the Score: ▲▼ number pickers, "Show Starting XIs" toggle, lock-in + reveal.

### Round 9 — Arteta Debut XI (confirmed)
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

### Round build status
1. ✅ Round 1 — Trust the Process
2. ✅ Round 2 — Who Doubted Us?
3. ✅ Round 3 — Arteta Speaks ⚠️ verify quotes
4. ✅ Round 4 — The Season That Won It ⚠️ verify stats
5. ✅ Round 5 — Corner Kings ⚠️ needs photos
6. ✅ Round 6 — Top Scorers
7. ✅ Round 7 — Assist Masters
8. 🔴 Round 8 — Memory Lane (needs photos)
9. ✅ Round 9 — Build the XI (Arteta debut)
10. ✅ Round 10 — Guess the Score

### Corrections (important)
- Sep 2024 Man City game was **2-2**, not 2-1 (Stones 98th min equaliser)
- Mar 2026 Chelsea goalkeeper was **Robert Sanchez**, not Schmeichel (Schmeichel was pundit on TV)
- Title confirmed when **Man City drew 1-1 at Bournemouth** the night AFTER the Burnley win

## Open Questions / TODOs

- [ ] **Scoring format confirmed:** No timer. +10 per correct, 0 wrong. 1000 total.
- [ ] **Round 3 (Arteta Speaks):** Source 10 press conference quotes — user or research agent
- [ ] **Round 4 (Season stats):** Verify all numbers, add 2-3 more questions
- [ ] **Round 5 (Corner Kings):** Await corner goal research; user to source photos
- [ ] **Round 8 (Memory Lane):** User to source 10 photos + confirm dates
- [ ] **Round 9 (Build the XI):** Confirm title-clinching starting XI vs Burnley
- [ ] **Round 10 (Transfer Window):** Verify all fees; confirm Eze and any other 2025 additions
- [ ] **Firebase leaderboard:** Add `arsenal-champions-2026` game to Firebase rules + leaderboard page
- [ ] **Home page card:** Add to drapk.in home page with Arsenal red/gold branding
- [ ] **Quotes verification:** User to check all source URLs in Round 2 before going live

---

## Tech Notes

- **File:** `client/src/pages/arsenal-champions.tsx` (one file, self-contained)
- **Route:** Added to `App.tsx` as `/arsenal-pl-champions-2026`
- **No new Firebase collections** until rules are updated in Firebase Console
- **Builds:** Commit + push only (Kandji blocks local npm). GitHub Actions → live in ~1 min.
- **No lockfile** — `npm install` not `npm ci`
