// Fetches every PL player with per-club appearances, goals, assists + bio data, and
// the last season they played (lastSeason: start year, e.g. 2025 for 2025/26).
// Usage: node scripts/fetch-players.mjs
//        node scripts/fetch-players.mjs --seasons-only   (just refresh lastSeason)
// Output: client/src/data/pl-players.json

const TEAMS = [
  { id: 1, name: "Arsenal" },
  { id: 2, name: "Aston Villa" },
  { id: 30, name: "Barnsley" },
  { id: 35, name: "Birmingham" },
  { id: 3, name: "Blackburn" },
  { id: 44, name: "Blackpool" },
  { id: 27, name: "Bolton" },
  { id: 127, name: "Bournemouth" },
  { id: 32, name: "Bradford" },
  { id: 130, name: "Brentford" },
  { id: 131, name: "Brighton" },
  { id: 43, name: "Burnley" },
  { id: 46, name: "Cardiff" },
  { id: 31, name: "Charlton" },
  { id: 4, name: "Chelsea" },
  { id: 5, name: "Coventry" },
  { id: 6, name: "Crystal Palace" },
  { id: 28, name: "Derby" },
  { id: 7, name: "Everton" },
  { id: 34, name: "Fulham" },
  { id: 159, name: "Huddersfield" },
  { id: 41, name: "Hull" },
  { id: 8, name: "Ipswich" },
  { id: 9, name: "Leeds" },
  { id: 26, name: "Leicester" },
  { id: 10, name: "Liverpool" },
  { id: 163, name: "Luton" },
  { id: 11, name: "Man City" },
  { id: 12, name: "Man Utd" },
  { id: 13, name: "Middlesbrough" },
  { id: 23, name: "Newcastle" },
  { id: 14, name: "Norwich" },
  { id: 15, name: "Nottingham Forest" },
  { id: 16, name: "Oldham" },
  { id: 37, name: "Portsmouth" },
  { id: 17, name: "QPR" },
  { id: 40, name: "Reading" },
  { id: 18, name: "Sheffield Utd" },
  { id: 19, name: "Sheffield Wed" },
  { id: 20, name: "Southampton" },
  { id: 42, name: "Stoke" },
  { id: 29, name: "Sunderland" },
  { id: 45, name: "Swansea" },
  { id: 24, name: "Swindon" },
  { id: 21, name: "Tottenham" },
  { id: 33, name: "Watford" },
  { id: 36, name: "West Brom" },
  { id: 25, name: "West Ham" },
  { id: 39, name: "Wigan" },
  { id: 22, name: "Wimbledon" },
  { id: 38, name: "Wolves" },
];

const STATS = ["appearances", "goals", "goal_assist"];
const PAGE_SIZE = 100;
const DELAY_MS = 150;

async function fetchStatForTeam(stat, teamId) {
  const results = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    const url = `https://footballapi.pulselive.com/football/stats/ranked/players/${stat}?page=${page}&pageSize=${PAGE_SIZE}&comps=1&teams=${teamId}&altIds=true`;
    const res = await fetch(url, {
      headers: { Origin: "https://www.premierleague.com" },
    });

    if (!res.ok) {
      console.error(`  FAIL ${stat} team=${teamId} page=${page}: ${res.status}`);
      break;
    }

    const data = await res.json();
    if (page === 0) {
      totalPages = Math.ceil((data.stats?.pageInfo?.numEntries || 0) / PAGE_SIZE);
    }

    for (const entry of data.stats?.content || []) {
      const o = entry.owner;
      results.push({
        playerId: o.playerId || o.id,
        firstName: o.name?.first || "",
        lastName: o.name?.last || "",
        displayName: o.name?.display || "",
        position: o.info?.positionInfo || o.info?.position || "",
        nationality: o.nationalTeam?.country || "",
        dob: o.birth?.date?.label || "",
        value: entry.value,
      });
    }

    page++;
    if (page < totalPages) await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  return results;
}

// Each player's most recent PL season with an appearance, by playerId.
async function fetchLastSeasons() {
  const res = await fetch("https://footballapi.pulselive.com/football/competitions/1/compseasons?page=0&pageSize=100", {
    headers: { Origin: "https://www.premierleague.com" },
  });
  const seasons = (await res.json()).content
    .map((s) => ({ id: Math.round(s.id), year: Number((s.label.match(/(\d{4})\/\d{2}/) || [])[1]) }))
    .filter((s) => s.year);
  const last = new Map();
  for (const { id, year } of seasons) {
    let page = 0;
    let totalPages = 1;
    let count = 0;
    while (page < totalPages) {
      const url = `https://footballapi.pulselive.com/football/stats/ranked/players/appearances?page=${page}&pageSize=${PAGE_SIZE}&comps=1&compSeasons=${id}&altIds=true`;
      const r = await fetch(url, { headers: { Origin: "https://www.premierleague.com" } });
      if (!r.ok) { console.error(`  FAIL season ${year} page ${page}: ${r.status}`); break; }
      const data = await r.json();
      if (page === 0) totalPages = Math.ceil((data.stats?.pageInfo?.numEntries || 0) / PAGE_SIZE);
      for (const entry of data.stats?.content || []) {
        if (!(entry.value > 0)) continue;
        const pid = entry.owner.playerId || entry.owner.id;
        if (!(last.get(pid) >= year)) last.set(pid, year);
        count++;
      }
      page++;
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
    process.stdout.write(`  ${year}/${String(year + 1).slice(2)} (${count}) `);
  }
  console.log();
  return last;
}

// Pair each fetched player with their record in the previous file and keep its name
// fields. By playerId when the previous file has one; otherwise by birthday plus clubs
// (every old club still present with at least as many apps), using shared name words
// to separate two players born the same day.
function carryOverNames(fresh, previous) {
  const words = (p) => new Set(`${p.displayName} ${p.firstName} ${p.lastName}`
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .split(/[^a-z]+/).filter((w) => w.length > 1));
  const byId = new Map(previous.filter((p) => p.playerId != null).map((p) => [p.playerId, p]));
  const byDob = new Map();
  for (const p of previous) {
    if (!byDob.has(p.dob)) byDob.set(p.dob, []);
    byDob.get(p.dob).push(p);
  }
  const used = new Set();
  let matched = 0;
  let renamed = 0;
  for (const f of fresh) {
    let old = byId.get(f.playerId);
    if (!old) {
      const fw = words(f);
      const cands = (byDob.get(f.dob) || [])
        .filter((o) => !used.has(o) && Object.entries(o.clubs)
          .every(([c, s]) => f.clubs[c] && f.clubs[c].appearances >= s.appearances))
        .map((o) => ({ o, shared: [...words(o)].filter((w) => fw.has(w)).length }))
        .sort((a, b) => b.shared - a.shared);
      if (cands.length === 1 || (cands.length > 1 && cands[0].shared > cands[1].shared)) old = cands[0].o;
    }
    if (!old || used.has(old)) continue;
    used.add(old);
    matched++;
    if (old.displayName !== f.displayName || old.firstName !== f.firstName || old.lastName !== f.lastName) renamed++;
    f.displayName = old.displayName;
    f.firstName = old.firstName;
    f.lastName = old.lastName;
    if (old.wikiViews != null) f.wikiViews = old.wikiViews; // from scripts/fetch-wiki-views.py, not the PL API
  }
  const unmatched = previous.filter((p) => !used.has(p)).map((p) => p.displayName);
  return { matched, renamed, unmatched };
}

async function main() {
  const { readFileSync, existsSync, writeFileSync } = await import("fs");
  const { fileURLToPath } = await import("url");
  const outPath = fileURLToPath(new URL("../client/src/data/pl-players.json", import.meta.url));

  if (process.argv.includes("--seasons-only")) {
    console.log("Fetching last seasons...");
    const last = await fetchLastSeasons();
    const players = JSON.parse(readFileSync(outPath, "utf8"));
    let set = 0;
    for (const p of players) {
      p.lastSeason = last.get(p.playerId) ?? null;
      if (p.lastSeason) set++;
    }
    writeFileSync(outPath, JSON.stringify(players, null, 2));
    console.log(`lastSeason set for ${set} of ${players.length} players`);
    return;
  }

  // playerMap: playerId -> full player object
  const playerMap = new Map();

  function ensurePlayer(p) {
    if (!playerMap.has(p.playerId)) {
      playerMap.set(p.playerId, {
        playerId: p.playerId,
        displayName: p.displayName,
        firstName: p.firstName,
        lastName: p.lastName,
        position: p.position,
        nationality: p.nationality,
        dob: p.dob,
        clubs: {}, // clubName -> { appearances, goals, assists }
      });
    }
    // Update bio if we got better data (non-empty overwrites empty)
    const existing = playerMap.get(p.playerId);
    if (!existing.position && p.position) existing.position = p.position;
    if (!existing.nationality && p.nationality) existing.nationality = p.nationality;
    if (!existing.dob && p.dob) existing.dob = p.dob;
    return existing;
  }

  function ensureClub(player, clubName) {
    if (!player.clubs[clubName]) {
      player.clubs[clubName] = { appearances: 0, goals: 0, assists: 0 };
    }
    return player.clubs[clubName];
  }

  const statKeyMap = { appearances: "appearances", goals: "goals", goal_assist: "assists" };

  let requestCount = 0;

  for (const stat of STATS) {
    console.log(`\nFetching ${stat} for ${TEAMS.length} teams...`);

    for (const team of TEAMS) {
      const players = await fetchStatForTeam(stat, team.id);
      requestCount++;

      for (const p of players) {
        const player = ensurePlayer(p);
        const club = ensureClub(player, team.name);
        club[statKeyMap[stat]] = p.value;
      }

      process.stdout.write(`  ${team.name} (${players.length}) `);
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
    console.log();
  }

  console.log(`\nTotal API pages fetched: ~${requestCount}`);

  console.log("\nFetching last seasons...");
  const last = await fetchLastSeasons();
  for (const p of playerMap.values()) p.lastSeason = last.get(p.playerId) ?? null;

  // Names in the existing file have been corrected by hand ("Savinho", "van Nistelrooy"),
  // and the API renames players between pulls. Carry those names over so a refresh only
  // moves the numbers. --names-from <file> reads them from another copy instead.
  const flag = process.argv.indexOf("--names-from");
  const namesPath = flag > -1 ? process.argv[flag + 1] : outPath;
  const previous = existsSync(namesPath) ? JSON.parse(readFileSync(namesPath, "utf8")) : [];
  const kept = carryOverNames([...playerMap.values()], previous);
  console.log(`\nKept existing names for ${kept.matched} of ${previous.length} players (${kept.renamed} differ from the API)`);
  if (kept.unmatched.length) console.log(`  No match for: ${kept.unmatched.slice(0, 20).join(", ")}${kept.unmatched.length > 20 ? " …" : ""}`);

  // Build final output (sort by total appearances). playerId stays so the next refresh
  // can match players exactly instead of by birthday and clubs.
  const result = [...playerMap.values()]
    .map((rest) => ({
      ...rest,
      totalAppearances: Object.values(rest.clubs).reduce((s, c) => s + c.appearances, 0),
      totalGoals: Object.values(rest.clubs).reduce((s, c) => s + c.goals, 0),
      totalAssists: Object.values(rest.clubs).reduce((s, c) => s + c.assists, 0),
    }))
    .sort((a, b) => b.totalAppearances - a.totalAppearances);

  console.log(`Total unique players: ${result.length}`);
  console.log(`\nTop 10:`);
  for (const p of result.slice(0, 10)) {
    const clubStr = Object.entries(p.clubs)
      .sort(([, a], [, b]) => b.appearances - a.appearances)
      .map(([club, s]) => `${club}: ${s.appearances}app/${s.goals}g/${s.assists}a`)
      .join(", ");
    console.log(`  ${p.displayName} (${p.totalAppearances} apps, ${p.totalGoals}g, ${p.totalAssists}a) — ${clubStr}`);
  }

  // Write output
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\nWritten to client/src/data/pl-players.json`);
}

main().catch(console.error);
