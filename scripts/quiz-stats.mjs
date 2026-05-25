// Arsenal PL Champions 2026 — stats snapshot
//
// Setup (one-time):
//   1) From the repo root: npm install
//   2) Authenticate so firebase-admin can read Firestore:
//        gcloud auth application-default login
//      (Install gcloud first if needed: https://cloud.google.com/sdk/docs/install)
//      OR — if you don't want gcloud — download a service-account JSON key
//      from Firebase Console → Project Settings → Service Accounts → Generate
//      new private key, save as scripts/service-account.json (gitignored).
//
// Run:
//   node scripts/quiz-stats.mjs
//
// What it shows (Firestore only):
//   - Total plays of the Arsenal quiz (signed-in + anonymous)
//   - Plays today / last 7d
//   - Anon vs username split
//   - Score histogram + average
//   - Top 20 leaderboard scores
//
// NOT shown (these live in Google Analytics, not Firestore):
//   - Page views per route          → GA Console → Reports → Engagement → Pages
//   - Round-by-round drop-off       → GA Console → Reports → Engagement → Events
//                                     filter to event = arsenal_round_started,
//                                     break down by round_number param

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Try a local service-account key first; fall back to application-default creds.
const localKey = path.join(__dirname, "service-account.json");
if (fs.existsSync(localKey)) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(localKey, "utf8"))),
    projectId: "drapk-in",
  });
} else {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: "drapk-in",
  });
}

const db = admin.firestore();
const ARSENAL = "arsenal-champions-2026";

const dim = (s) => `\x1b[2m${s}\x1b[22m`;
const bold = (s) => `\x1b[1m${s}\x1b[22m`;
const gold = (s) => `\x1b[33m${s}\x1b[39m`;
const red = (s) => `\x1b[31m${s}\x1b[39m`;
const green = (s) => `\x1b[32m${s}\x1b[39m`;

function fmtPct(n, total) {
  if (!total) return "0%";
  return `${Math.round((n / total) * 1000) / 10}%`;
}

function bar(n, max, width = 30) {
  if (!max) return "";
  const filled = Math.round((n / max) * width);
  return "█".repeat(filled) + dim("·".repeat(width - filled));
}

async function main() {
  console.log("");
  console.log(bold(gold("Arsenal PL Champions 2026 — stats")));
  console.log(dim(`Snapshot · ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`));
  console.log("");

  // ── Plays (quiz_plays collection) ────────────────────────────────────────────
  const playsSnap = await db.collection("quiz_plays")
    .where("gameId", "==", ARSENAL)
    .get();

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  let total = 0, last24h = 0, last7d = 0;
  let withUsername = 0, anon = 0;
  const scoreCounts = new Array(11).fill(0); // 0/10, 1/10, …, 10/10 per ROUND? actually 0..100
  const scoreBuckets = { "0-19": 0, "20-39": 0, "40-59": 0, "60-79": 0, "80-99": 0, "100": 0 };
  let scoreSum = 0;
  const usernameSet = new Set();

  for (const doc of playsSnap.docs) {
    const d = doc.data();
    total++;
    scoreSum += d.score || 0;
    const ts = d.completedAt?.toMillis?.() ?? 0;
    if (ts >= oneDayAgo) last24h++;
    if (ts >= sevenDaysAgo) last7d++;
    if (d.username) { withUsername++; usernameSet.add(d.username); } else { anon++; }
    const s = d.score || 0;
    if (s === 100) scoreBuckets["100"]++;
    else if (s >= 80) scoreBuckets["80-99"]++;
    else if (s >= 60) scoreBuckets["60-79"]++;
    else if (s >= 40) scoreBuckets["40-59"]++;
    else if (s >= 20) scoreBuckets["20-39"]++;
    else scoreBuckets["0-19"]++;
    scoreCounts[Math.min(10, Math.floor(s / 10))]++;
  }

  console.log(bold("Plays"));
  console.log(`  Total           ${bold(String(total))}`);
  console.log(`  Last 24h        ${last24h}  ${dim(`(${fmtPct(last24h, total)})`)}`);
  console.log(`  Last 7 days     ${last7d}  ${dim(`(${fmtPct(last7d, total)})`)}`);
  console.log("");

  console.log(bold("Anon vs profile"));
  console.log(`  Signed-in plays ${green(String(withUsername))}  ${dim(`(${fmtPct(withUsername, total)}, ${usernameSet.size} unique users)`)}`);
  console.log(`  Anonymous plays ${red(String(anon))}  ${dim(`(${fmtPct(anon, total)})`)}`);
  console.log("");

  if (total > 0) {
    const avg = scoreSum / total;
    console.log(bold("Score distribution"));
    const maxBucket = Math.max(...Object.values(scoreBuckets));
    for (const [bucket, n] of Object.entries(scoreBuckets)) {
      console.log(`  ${bucket.padEnd(6)} ${String(n).padStart(4)}  ${bar(n, maxBucket)}`);
    }
    console.log(`  ${dim(`avg score ${avg.toFixed(1)}/100`)}`);
    console.log("");
  }

  // ── Top scores (scores collection) ──────────────────────────────────────────
  const scoresSnap = await db.collection("scores")
    .where("game", "==", ARSENAL)
    .get();

  const bestByUser = new Map();
  for (const doc of scoresSnap.docs) {
    const d = doc.data();
    const prev = bestByUser.get(d.username) ?? -Infinity;
    if (d.score > prev) bestByUser.set(d.username, d.score);
  }
  const top = [...bestByUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);

  console.log(bold("Top scores (leaderboard, best score per user)"));
  if (top.length === 0) {
    console.log(dim("  No leaderboard scores yet."));
  } else {
    for (let i = 0; i < top.length; i++) {
      const [name, score] = top[i];
      const rank = String(i + 1).padStart(2, " ");
      console.log(`  ${rank}.  @${name.padEnd(20)} ${gold(String(score).padStart(3))}/100`);
    }
    console.log(dim(`  (${bestByUser.size} unique users on the leaderboard)`));
  }
  console.log("");

  console.log(dim("Page views and round drop-off live in Google Analytics:"));
  console.log(dim("  https://console.firebase.google.com/project/drapk-in/analytics"));
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
