// drapk.in reminders. Sends Web Push to people who turned reminders on (push-subs collection).
// No dependencies: RFC 8291 (aes128gcm) + RFC 8292 (VAPID) with Node's crypto.
//
//   node scripts/push/send.mjs streak [--dry]          evening: streak >= 3 and not played today
//   node scripts/push/send.mjs morning [--dry]         "Today's set is ready" (morning opt-in only)
//   node scripts/push/send.mjs test --user tiger       one test notification
//
// Private key: $VAPID_JSON (the JSON itself) or ~/.drapkin/vapid.json — never in the repo.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROJECT = "drapk-in";
const API_KEY = "AIzaSyDgg5sd6bAQAMo2ENtdZJV-lP6ytduPbj4"; // the public web key from the site
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const MIN_STREAK = 3;

const args = process.argv.slice(2);
const mode = args[0];
const dry = args.includes("--dry");
const only = args.includes("--user") ? args[args.indexOf("--user") + 1]?.toLowerCase() : null;
if (!["streak", "morning", "test"].includes(mode)) { console.log("usage: send.mjs streak|morning|test [--dry] [--user name]"); process.exit(1); }

const vapid = JSON.parse(process.env.VAPID_JSON || fs.readFileSync(path.join(os.homedir(), ".drapkin", "vapid.json"), "utf8"));
const b64u = (b) => Buffer.from(b).toString("base64url");

// --- Firestore (REST, public rules) ---
const val = (v) => v?.stringValue ?? v?.booleanValue ?? (v?.integerValue != null ? Number(v.integerValue) : v?.mapValue ? Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, val(x)])) : undefined);
async function runQuery(structuredQuery) {
  const r = await fetch(`${BASE}:runQuery?key=${API_KEY}`, { method: "POST", body: JSON.stringify({ structuredQuery }) });
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error(JSON.stringify(j).slice(0, 300));
  return j.filter((x) => x.document).map((x) => ({ id: x.document.name.split("/").pop(), ...Object.fromEntries(Object.entries(x.document.fields).map(([k, v]) => [k, val(v)])) }));
}
async function markDead(user) {
  await fetch(`${BASE}/push-subs/${user}?key=${API_KEY}&updateMask.fieldPaths=dead`, {
    method: "PATCH", body: JSON.stringify({ fields: { dead: { booleanValue: true } } }),
  });
}
const dayIn = (tz, ms = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: tz || "Europe/London" }).format(ms);
const shift = (k, n) => { const [y, m, d] = k.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };

// --- Web Push ---
const privKey = crypto.createPrivateKey({ key: vapid.privateJwk, format: "jwk" });
async function push(sub, payload) {
  const aud = new URL(sub.endpoint).origin;
  const h = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const c = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "https://drapk.in" }));
  const jwt = `${h}.${c}.${b64u(crypto.sign("sha256", Buffer.from(`${h}.${c}`), { key: privKey, dsaEncoding: "ieee-p1363" }))}`;
  const ua = Buffer.from(sub.keys.p256dh, "base64url");
  const auth = Buffer.from(sub.keys.auth, "base64url");
  const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
  const as = ecdh.getPublicKey();
  const salt = crypto.randomBytes(16);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", ecdh.computeSecret(ua), auth, Buffer.concat([Buffer.from("WebPush: info\0"), ua, as]), 32));
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const ci = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ct = Buffer.concat([ci.update(Buffer.concat([Buffer.from(JSON.stringify(payload)), Buffer.from([2])])), ci.final(), ci.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: { Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`, "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "21600", Urgency: "high" },
    body: Buffer.concat([salt, rs, Buffer.from([as.length]), as, ct]),
  });
  return res.status;
}

// --- Who gets what ---
const subs = (await runQuery({ from: [{ collectionId: "push-subs" }] }))
  .filter((s) => s.endpoint && s.keys?.p256dh && !s.dead && (!only || s.id === only));

async function streakOf(user, tz) {
  const rows = await runQuery({
    from: [{ collectionId: "daily-scores" }], select: { fields: [{ fieldPath: "dateKey" }] },
    where: { fieldFilter: { field: { fieldPath: "username" }, op: "EQUAL", value: { stringValue: user } } },
  });
  const days = new Set(rows.map((r) => r.dateKey));
  const today = dayIn(tz);
  let n = 0;
  for (let d = shift(today, -1); days.has(d); d = shift(d, -1)) n++;
  return { playedToday: days.has(today), streak: n };
}

let sent = 0, skipped = 0, dead = 0, reads = subs.length;
for (const s of subs) {
  let payload = null;
  if (mode === "test") payload = { title: "drapk.in", body: "This is a test notification ⚽", url: "/", tag: "test" };
  if (mode === "morning" && s.morning) payload = { title: "Today's set is ready ⚽", body: "Career Path, Photo Finish, CentreCircle and Griddle", url: "/?src=push_morning", tag: "daily" };
  if (mode === "streak" && s.streak) {
    const { playedToday, streak } = await streakOf(s.id, s.tz);
    reads += streak + 1;
    if (!playedToday && streak >= MIN_STREAK) payload = { title: `Your ${streak}-day streak ends at midnight 🔥`, body: "One game keeps it going", url: "/?src=push_streak", tag: "streak" };
  }
  if (!payload) { skipped++; continue; }
  if (dry) { console.log("would send", s.id, "→", payload.title); sent++; continue; }
  const status = await push(s, payload);
  if (status === 404 || status === 410) { dead++; await markDead(s.id); }
  else if (status >= 200 && status < 300) sent++;
  console.log(s.id, status);
}
console.log(`${mode}${dry ? " (dry run)" : ""}: sent ${sent}, skipped ${skipped}, gone ${dead} · ~${reads} Firestore reads`);
