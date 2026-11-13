// End-to-end test of guest play against a local Firestore emulator (never production).
// Run inside `firebase emulators:exec` with a build made with VITE_EMULATOR=1. See .github/workflows/e2e.yml.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const DIST = path.resolve("dist");
const PORT = 4173;
const FS = "http://127.0.0.1:8080/v1/projects/drapk-in/databases/(default)/documents";
const ADMIN = { Authorization: "Bearer owner" }; // emulator admin: bypasses rules (for setup + checks)
const TZ = "Europe/London";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
fs.mkdirSync("shots", { recursive: true });

const results = [];
const pass = (m) => { results.push(`PASS  ${m}`); console.log(`PASS  ${m}`); };
const fail = (m) => { results.push(`FAIL  ${m}`); console.log(`FAIL  ${m}`); };
const check = (cond, m) => (cond ? pass(m) : fail(m));

// --- static server for the build (SPA fallback) ---
const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(DIST) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIST, "index.html");
  res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(PORT);

// --- emulator helpers ---
const enc = (v) => typeof v === "string" ? { stringValue: v } : typeof v === "boolean" ? { booleanValue: v } : Number.isInteger(v) ? { integerValue: String(v) } : v instanceof Date ? { timestampValue: v.toISOString() } : { doubleValue: v };
const dec = (f) => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, v.stringValue ?? v.booleanValue ?? (v.integerValue != null ? Number(v.integerValue) : v.doubleValue ?? v.timestampValue ?? null)]));
async function put(col, id, data) {
  const r = await fetch(`${FS}/${col}?documentId=${encodeURIComponent(id)}`, { method: "POST", headers: ADMIN, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)])) }) });
  if (!r.ok) throw new Error(`seed ${col}/${id}: ${r.status} ${await r.text()}`);
}
async function all(col) {
  const r = await fetch(`${FS}/${col}?pageSize=500`, { headers: ADMIN });
  const j = await r.json();
  return (j.documents || []).map((d) => ({ id: d.name.split("/").pop(), ...dec(d.fields) }));
}
async function get(col, id) {
  const r = await fetch(`${FS}/${col}/${encodeURIComponent(id)}`, { headers: ADMIN });
  return r.ok ? { id, ...dec((await r.json()).fields) } : null;
}
// As a normal client (rules apply): PATCH only the given fields
async function clientPatch(col, id, fields) {
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join("&");
  const r = await fetch(`${FS}/${col}/${encodeURIComponent(id)}?${mask}`, { method: "PATCH", body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, enc(v)])) }) });
  return r.status;
}

// --- seed: an admin account, a named rival on today's Photo Finish board, a guest doc for rules tests ---
await put("users", "tiger", { username: "tiger", avatar: "🐯", createdAt: new Date() });
await put("users", "rival", { username: "rival", avatar: "⚽", createdAt: new Date() });
await put("daily-scores", `photofinish_${today}_rival`, { username: "rival", game: "photofinish", dateKey: today, score: 500, found: 2, total: 10, key: `photofinish_${today}_rival`, timestamp: new Date() });
await put("daily-scores", "rulesguest", { username: "guest-rules001", game: "griddle", dateKey: today, score: 40, found: 6, total: 200, key: `griddle_${today}_guest-rules001`, guest: true, timestamp: new Date() });
await put("daily-scores", "rulesnamed", { username: "rival", game: "griddle", dateKey: today, score: 90, found: 9, total: 200, key: `griddle_${today}_rival`, timestamp: new Date() });

const browser = await chromium.launch();
const newCtx = async (storage) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: TZ, isMobile: true, hasTouch: true });
  // Belt and braces: production Firebase is unreachable from these tests
  await ctx.route(/googleapis\.com|google-analytics|googletagmanager|gc\.zgo\.at/, (r) => r.abort());
  if (storage) await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem("seeded", "1"); } }, storage);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fail(`page error: ${e.message}`));
  return { ctx, page };
};
const go = async (page, p) => { await page.goto(`http://localhost:${PORT}${p}`, { waitUntil: "load" }); await page.waitForTimeout(1500); };
const clickText = (page, re) => page.evaluate((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll("button")].find((x) => r.test(x.textContent.trim())); if (b) { b.click(); return true; } return false; }, re.source);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  // ===== 1. Brand-new visitor plays Photo Finish as a guest =====
  const { ctx: gctx, page } = await newCtx();
  await go(page, "/");
  const guest = JSON.parse(await page.evaluate(() => localStorage.getItem("pcb-guest")) || "null")?.username;
  check(guest && guest.startsWith("guest-"), `guest created (${guest})`);
  check(!(await page.locator("text=Pick a username").count()), "no sign-up wall");

  await go(page, "/photofinish");
  for (let i = 0; i < 40; i++) { if (await clickText(page, /^See your score/)) break; await clickText(page, /^(Play today|Lock in|Next photo)/); await wait(500); }
  await wait(2500);
  // the name sheet opens by itself after the first finish: close it
  await clickText(page, /^Not now$/);
  await page.screenshot({ path: "shots/1-guest-photofinish-end.png", fullPage: true });
  let docs = await all("daily-scores");
  const gPF = docs.find((d) => d.username === guest && d.game === "photofinish");
  check(gPF && gPF.guest === true && gPF.dateKey === today, "guest Photo Finish written to daily-scores with guest: true");
  const boardText = await page.evaluate(() => document.body.innerText);
  check(/rival/.test(boardText) && !/guest-/.test(boardText), "Everyone board shows named players, not guests");

  // ===== 2. Guest plays CentreCircle past the target: saved as you go =====
  await go(page, "/centrecircle");
  await clickText(page, /^Play today/);
  await wait(600);
  const letters = (await page.evaluate(() => [...document.querySelectorAll("button")].map((b) => b.textContent.trim()).filter((t) => /^[A-Z]$/.test(t)))).map((l) => l.toLowerCase());
  const target = Number((await page.evaluate(() => document.body.innerText.match(/(\d+)\/(\d+)\s*\n?\s*to complete today/)?.[2])) || 6);
  const players = JSON.parse(fs.readFileSync("client/src/data/pl-players.json", "utf8"));
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  const cands = [...new Set(players.map((p) => norm(p.lastName || "")).filter((n) => n.length >= 3 && [...n].every((c) => letters.includes(c))))];
  const press = (k) => page.evaluate((key) => window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })), k);
  const found = () => page.evaluate(() => Number(document.body.innerText.match(/Found (\d+)/)?.[1] ?? 0));
  let sawFlash = false;
  for (const w of cands) {
    for (const c of w) await press(c);
    await press("Enter");
    await wait(250);
    if (/Today complete/.test(await page.evaluate(() => document.body.innerText))) sawFlash = true;
    if ((await found()) >= target + 1) break;
  }
  const nFound = await found();
  check(nFound >= target, `CentreCircle: found ${nFound} (target ${target}, board letters ${letters.join("")})`);
  check(sawFlash, "'Today complete' moment showed when the target was hit");
  await wait(1500);
  docs = await all("daily-scores");
  const gCC = docs.find((d) => d.username === guest && d.game === "centrecircle");
  check(gCC && gCC.open === true && gCC.guest === true && gCC.id === `centrecircle_${today}_${guest}`, "guest CentreCircle saved as you go (open, guest, doc id = key)");
  await page.screenshot({ path: "shots/2-guest-centrecircle.png" });

  // Home tile reflects it
  await go(page, "/");
  const home = await page.evaluate(() => document.body.innerText);
  check(/Keep going/.test(home), "home tile shows CentreCircle complete with Keep going");

  // ===== 3. Rules =====
  check((await clientPatch("daily-scores", "rulesguest", { score: 9999 })) === 403, "rules: a guest score can't be changed");
  check((await clientPatch("daily-scores", "rulesnamed", { claimedBy: "x" })) === 403, "rules: a named score can't be claimed");
  check((await clientPatch("daily-scores", "rulesguest", { claimedBy: "rival" })) === 200, "rules: a guest score can be marked claimedBy");
  check((await clientPatch("daily-scores", "rulesguest", { claimedBy: "other", score: 1 })) === 403, "rules: claiming can't change anything else");

  // ===== 4. Guest picks a name (from Me) =====
  const ccBefore = gCC?.score ?? 0;
  await go(page, "/me");
  await wait(800);
  check(await page.locator("text=Pick a name").count() > 0, "Me opens Pick a name for a guest");
  await page.fill('input[placeholder="Username"]', "e2e_kim");
  await clickText(page, /^Claim/);
  await wait(4000);
  const kimUser = await get("users", "e2e_kim");
  check(kimUser && kimUser.fromGuest === guest, "account created with fromGuest = guest id");
  docs = await all("daily-scores");
  const kPF = docs.find((d) => d.username === "e2e_kim" && d.game === "photofinish");
  const kCC = docs.find((d) => d.username === "e2e_kim" && d.game === "centrecircle");
  check(kPF && kPF.fromGuest === guest && !kPF.guest && kPF.score === gPF?.score, "Photo Finish copied to the account");
  check(kCC && kCC.open === true && kCC.id === `centrecircle_${today}_e2e_kim`, "open CentreCircle copied and still open (doc id = account key)");
  const gDocs = docs.filter((d) => d.username === guest);
  check(gDocs.length >= 2 && gDocs.every((d) => d.claimedBy === "e2e_kim"), "guest copies marked claimedBy e2e_kim");
  check(!(await page.evaluate(() => localStorage.getItem("pcb-guest"))), "guest identity cleared on this device");
  await page.screenshot({ path: "shots/4-after-claim-me.png", fullPage: true });

  // ===== 5. Keep playing CentreCircle as the account: the account's open doc keeps updating, then Finish closes it =====
  await go(page, "/centrecircle");
  await clickText(page, /^(Play today|Back to today)/);
  await wait(500);
  const before = await found();
  for (const w of cands) {
    for (const c of w) await press(c);
    await press("Enter");
    await wait(250);
    if ((await found()) > before) break;
  }
  await wait(1500);
  let kCC2 = await get("daily-scores", `centrecircle_${today}_e2e_kim`);
  check(kCC2 && kCC2.score > (kCC?.score ?? ccBefore) && kCC2.open === true, `account's open score went up (${kCC?.score} → ${kCC2?.score})`);
  await clickText(page, /^Finish$/); // opens the confirm
  await wait(400);
  await clickText(page, /^Finish$/); // confirm
  await wait(2000);
  kCC2 = await get("daily-scores", `centrecircle_${today}_e2e_kim`);
  check(kCC2 && kCC2.open === false, "Finish closed the account's CentreCircle (open: false)");
  check((await clientPatch("daily-scores", `centrecircle_${today}_e2e_kim`, { score: 9999 })) === 403, "rules: a finished score is locked");

  // ===== 6. Leaderboards: the account is on, the guest isn't =====
  const { ctx: rctx, page: rp } = await newCtx({ "pcb-user": JSON.stringify({ username: "rival", avatar: "⚽" }) });
  await go(rp, "/leaderboard");
  await rp.getByRole("button", { name: /Photo Finish/ }).first().click().catch(() => {});
  await wait(1500);
  const lb = await rp.evaluate(() => document.body.innerText);
  check(/e2e_kim/.test(lb) && /rival/.test(lb) && !/guest-/.test(lb), "Leaders: e2e_kim and rival listed, no guests");
  await rp.screenshot({ path: "shots/6-leaders.png", fullPage: true });
  await rctx.close();

  // ===== 7. A guest from the first release with scores queued on their device =====
  const { ctx: lctx, page: lp } = await newCtx({
    "pcb-guest": JSON.stringify({ username: "guest-legacy01", avatar: "👤", guest: true }),
    "pcb-pending": JSON.stringify([{ kind: "daily", game: "careerpath", dateKey: today, score: 64, found: 3, total: 5 }, { kind: "arcade", game: "targetman", score: 120 }]),
  });
  await go(lp, "/");
  await wait(2000);
  docs = await all("daily-scores");
  check(docs.some((d) => d.username === "guest-legacy01" && d.game === "careerpath" && d.guest === true), "first-release queued daily score sent as the guest");
  const arc = await all("scores");
  check(arc.some((d) => d.username === "guest-legacy01" && d.game === "targetman" && d.guest === true), "first-release queued arcade score sent as the guest");
  check(!(await lp.evaluate(() => localStorage.getItem("pcb-pending"))), "queue cleared");
  await lctx.close();

  // ===== 8. /stats counts guests once =====
  const { ctx: sctx, page: sp } = await newCtx({ "pcb-user": JSON.stringify({ username: "tiger", avatar: "🐯" }) });
  await go(sp, "/stats");
  await wait(4000);
  const st = await sp.evaluate(() => document.body.innerText);
  await sp.screenshot({ path: "shots/8-stats.png", fullPage: true });
  // Today: named = rival, e2e_kim (2). Guests = guest-legacy01 + the seeded rules guest (2); the guest
  // who became e2e_kim isn't counted again
  check(/2 named · 2 guests/.test(st), `stats: players today split named/guests correctly (${(st.match(/\d+ named · \d+ guests/) || ["?"])[0]})`);
  check(/Picked a name\s*\n\s*33%/.test(st), `stats: Guests card shows 1 of 3 guests picked a name (${(st.match(/Picked a name\s*\n\s*[^\n]+/) || ["?"])[0].replace(/\s+/g, " ")})`);
  await sctx.close();
  await gctx.close();
} catch (e) {
  fail(`crashed: ${e.stack || e}`);
}

await browser.close();
const failed = results.filter((r) => r.startsWith("FAIL"));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
