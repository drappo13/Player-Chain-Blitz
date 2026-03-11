// Fetches every PL player with per-club appearances, goals, assists + bio data.
// Usage: node scripts/fetch-players.mjs
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

async function main() {
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

  // Build final output (drop playerId, sort by total appearances)
  const result = [...playerMap.values()]
    .map(({ playerId, ...rest }) => ({
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
  const { writeFileSync } = await import("fs");
  const { fileURLToPath } = await import("url");
  const outPath = fileURLToPath(new URL("../client/src/data/pl-players.json", import.meta.url));
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\nWritten to client/src/data/pl-players.json`);
}

main().catch(console.error);
