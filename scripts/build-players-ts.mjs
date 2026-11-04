// Regenerates client/src/data/players.ts (the goalchain scorer list) from pl-players.json.
// Usage: node scripts/build-players-ts.mjs
//
// players.ts carries hand-corrected name forms the PL API doesn't use — mononyms like
// "Geremi", "Tugay" and "Emre", where the API returns the full formal name and surname
// extraction would pick the wrong word. So existing entries keep their name fields
// verbatim and only `goals` is refreshed; new scorers come in with API names.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "client/src/data/pl-players.json");
const OUT = path.join(root, "client/src/data/players.ts");

const norm = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/['\-\s.]/g, "");

// Exact keys for linking an old entry to a fresh one. Surname alone is deliberately
// not a key here — three Fofanas share one, and a bare-surname match hands an old
// entry whichever of them is seen first.
function keysFor({ firstName, lastName, displayName }) {
  const k = new Set();
  if (displayName) k.add("d:" + norm(displayName));
  if (firstName && lastName) k.add("n:" + norm(firstName + lastName));
  return [...k];
}

const fresh = JSON.parse(readFileSync(SRC, "utf8")).filter((p) => p.totalGoals > 0);

const byKey = new Map();
for (const p of fresh) {
  for (const k of keysFor(p)) if (!byKey.has(k)) byKey.set(k, p);
}

// Parse the existing players.ts so its name forms survive the rebuild.
const existing = [...readFileSync(OUT, "utf8").matchAll(
  /\{\s*lastName:\s*"((?:[^"\\]|\\.)*)",\s*firstName:\s*"((?:[^"\\]|\\.)*)",\s*displayName:\s*"((?:[^"\\]|\\.)*)",\s*goals:\s*(\d+)\s*\}/g
)].map((m) => ({ lastName: m[1], firstName: m[2], displayName: m[3], goals: +m[4] }));

const claimed = new Set();
const linked = new Map(); // existing entry -> fresh player

for (const old of existing) {
  const hit = keysFor(old).map((k) => byKey.get(k)).find((p) => p && !claimed.has(p));
  if (hit) {
    claimed.add(hit);
    linked.set(old, hit);
  }
}

// Second pass for spelling drift the exact keys miss (Kerimoglu/Kerimoglou, and the
// renames the API makes between pulls). Surname is only trusted to identify a player
// when exactly one unresolved entry on each side carries it.
const bySurname = (list, pick) => {
  const m = new Map();
  for (const item of list) {
    const k = norm(pick(item));
    if (!k) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
};
const loose = bySurname(existing.filter((e) => !linked.has(e)), (e) => e.lastName);
const freeBySurname = bySurname(fresh.filter((p) => !claimed.has(p)), (p) => p.lastName);

for (const [surname, olds] of loose) {
  const cands = freeBySurname.get(surname);
  if (olds.length === 1 && cands && cands.length === 1) {
    claimed.add(cands[0]);
    linked.set(olds[0], cands[0]);
  }
}

const out = [];
let updated = 0;
let stale = 0;

for (const old of existing) {
  const hit = linked.get(old);
  if (hit) {
    if (hit.totalGoals !== old.goals) updated++;
    out.push({ ...old, goals: hit.totalGoals });
  } else {
    // No match in the fresh pull — keep the entry untouched rather than drop a
    // player the game already accepts.
    stale++;
    out.push(old);
  }
}

const added = fresh.filter((p) => !claimed.has(p));
for (const p of added) {
  out.push({
    lastName: p.lastName,
    firstName: p.firstName,
    displayName: p.displayName,
    goals: p.totalGoals,
  });
}

out.sort((a, b) => b.goals - a.goals || a.displayName.localeCompare(b.displayName));

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const body = out
  .map(
    (p) =>
      `  { lastName: "${esc(p.lastName)}", firstName: "${esc(p.firstName)}", displayName: "${esc(
        p.displayName
      )}", goals: ${p.goals} }`
  )
  .join(",\n");

writeFileSync(
  OUT,
  `export interface Player {
  lastName: string;
  firstName: string;
  displayName: string;
  goals: number;
}

export const players: Player[] = [
${body}
];
`
);

console.log(`existing kept: ${existing.length}  (goals updated: ${updated}, no fresh match: ${stale})`);
console.log(`new scorers added: ${added.length}`);
console.log(`total written: ${out.length} -> ${path.relative(root, OUT)}`);
