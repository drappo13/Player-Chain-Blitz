// Fetches Arsenal player stats across all 7 Arteta PL seasons (2019/20–2025/26).
// Queries the official PL API per season, aggregates by player ID.
// Usage: node scripts/fetch-arteta-stats.mjs
// Output: client/src/data/arteta-arsenal-stats.json

const ARSENAL_TEAM_ID = 1;

// Arteta joined Dec 2019, so his first full PL season is 2019/20 (id 274).
const ARTETA_SEASONS = [
  { id: 274, label: "2019/20" },
  { id: 363, label: "2020/21" },
  { id: 418, label: "2021/22" },
  { id: 489, label: "2022/23" },
  { id: 578, label: "2023/24" },
  { id: 719, label: "2024/25" },
  { id: 777, label: "2025/26" },
];

const STATS = ["appearances", "goals", "goal_assist"];
const PAGE_SIZE = 100;
const DELAY_MS = 200;

async function fetchStat(stat, seasonId) {
  const results = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    const url =
      `https://footballapi.pulselive.com/football/stats/ranked/players/${stat}` +
      `?page=${page}&pageSize=${PAGE_SIZE}&comps=1&compSeasons=${seasonId}&teams=${ARSENAL_TEAM_ID}&altIds=true`;

    const res = await fetch(url, {
      headers: { Origin: "https://www.premierleague.com" },
    });

    if (!res.ok) {
      console.error(`  FAIL ${stat} season=${seasonId} page=${page}: ${res.status}`);
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
        displayName: o.name?.display || "",
        firstName: o.name?.first || "",
        lastName: o.name?.last || "",
        position: o.info?.positionInfo || o.info?.position || "",
        nationality: o.nationalTeam?.country || "",
        value: entry.value,
      });
    }

    page++;
    if (page < totalPages) await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  return results;
}

async function main() {
  // playerMap: playerId -> { displayName, firstName, lastName, position, nationality, seasons: {}, totals: {} }
  const playerMap = new Map();

  function ensurePlayer(p) {
    if (!playerMap.has(p.playerId)) {
      playerMap.set(p.playerId, {
        displayName: p.displayName,
        firstName: p.firstName,
        lastName: p.lastName,
        position: p.position,
        nationality: p.nationality,
        seasons: {},
        totalAppearances: 0,
        totalGoals: 0,
        totalAssists: 0,
      });
    }
    const existing = playerMap.get(p.playerId);
    // Overwrite bio with non-empty values in case earlier seasons had gaps
    if (!existing.position && p.position) existing.position = p.position;
    if (!existing.nationality && p.nationality) existing.nationality = p.nationality;
    return existing;
  }

  function ensureSeason(player, label) {
    if (!player.seasons[label]) {
      player.seasons[label] = { appearances: 0, goals: 0, assists: 0 };
    }
    return player.seasons[label];
  }

  const statKeyMap = { appearances: "appearances", goals: "goals", goal_assist: "assists" };

  for (const season of ARTETA_SEASONS) {
    console.log(`\n--- ${season.label} (id ${season.id}) ---`);
    for (const stat of STATS) {
      const players = await fetchStat(stat, season.id);
      const key = statKeyMap[stat];
      for (const p of players) {
        const player = ensurePlayer(p);
        const s = ensureSeason(player, season.label);
        s[key] = p.value;
      }
      process.stdout.write(`  ${stat} (${players.length}) `);
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
    console.log();
  }

  // Build totals and final output
  const result = [...playerMap.values()]
    .map((p) => {
      const totals = Object.values(p.seasons).reduce(
        (acc, s) => {
          acc.totalAppearances += s.appearances;
          acc.totalGoals += s.goals;
          acc.totalAssists += s.assists;
          return acc;
        },
        { totalAppearances: 0, totalGoals: 0, totalAssists: 0 }
      );
      return { ...p, ...totals };
    })
    .sort((a, b) => b.totalGoals - a.totalGoals || b.totalAssists - a.totalAssists);

  console.log(`\nTotal unique Arsenal players under Arteta: ${result.length}`);
  console.log(`\nTop 20 by goals:`);
  for (const p of result.slice(0, 20)) {
    console.log(
      `  ${p.displayName.padEnd(28)} ${String(p.totalGoals).padStart(3)}g  ` +
      `${String(p.totalAssists).padStart(3)}a  ${String(p.totalAppearances).padStart(3)}app`
    );
  }

  console.log(`\nTop 20 by assists:`);
  const byAssists = [...result].sort(
    (a, b) => b.totalAssists - a.totalAssists || b.totalGoals - a.totalGoals
  );
  for (const p of byAssists.slice(0, 20)) {
    console.log(
      `  ${p.displayName.padEnd(28)} ${String(p.totalAssists).padStart(3)}a  ` +
      `${String(p.totalGoals).padStart(3)}g  ${String(p.totalAppearances).padStart(3)}app`
    );
  }

  const { writeFileSync } = await import("fs");
  const { fileURLToPath } = await import("url");
  const outPath = fileURLToPath(
    new URL("../client/src/data/arteta-arsenal-stats.json", import.meta.url)
  );
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\nWritten to client/src/data/arteta-arsenal-stats.json`);
}

main().catch(console.error);
