// server.js
import express from "express";
import multer from "multer";
import cors from "cors";

/* =========================
   Optional backend store (Upstash Redis)
   ========================= */
let store; // will be set below
try {
  // Prefer helpers in backend/lib/store.js (week 3)
  store = await import("./lib/store.js");
  console.log("[store] Using backend/lib/store.js");
} catch (e) {
  console.warn("[store] backend/lib/store.js not found. Using in-memory fallback (dev only).");

  // --- In-memory fallback (DEV ONLY) ---
  const proUntil = new Map();        // key: userId -> unix ms when Pro expires
  const referralCount = new Map();   // key: userId -> integer count
  const refMap = new Map();          // key: code -> inviterUserId
  const codeOfUser = new Map();      // key: userId -> code

  function days(ms) { return ms / (24 * 60 * 60 * 1000); }
  function now() { return Date.now(); }
  const randCode = () => Math.random().toString(36).slice(2, 10).toUpperCase();

  async function isPro(userId) {
    if (!userId) return false;
    return (proUntil.get(userId) || 0) > now();
  }
  async function addProDays(userId, addDays) {
    const addMs = (addDays || 0) * 24 * 60 * 60 * 1000;
    const cur = proUntil.get(userId) || 0;
    const base = cur > now() ? cur : now();
    const next = base + addMs;
    proUntil.set(userId, next);
    return next;
  }
  async function getReferralCount(userId) { return referralCount.get(userId) || 0; }
  async function incReferralCount(userId) {
    const c = (referralCount.get(userId) || 0) + 1;
    referralCount.set(userId, c);
    return c;
  }
  async function ensureRefCode(userId) {
    if (codeOfUser.has(userId)) return codeOfUser.get(userId);
    let code = randCode();
    // (no collision handling needed in memory)
    codeOfUser.set(userId, code);
    return code;
  }
  async function bindRefCodeToUser(code, inviterUserId) {
    if (!code || !inviterUserId) return false;
    refMap.set(code, inviterUserId);
    return true;
  }
  async function resolveRef(code) { return refMap.get(code) || null; }

  // expose same shape as ./lib/store.js
  store = {
    isPro, addProDays,
    getReferralCount, incReferralCount,
    ensureRefCode, bindRefCodeToUser, resolveRef,
  };
}

/* =========================
   App bootstrap
   ========================= */
const app = express();
const upload = multer();

// ---------- CORS + parsere ----------
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Preflight
app.options("*", cors());

// Lille request-logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ---------- Health ----------
app.get("/", (_req, res) => res.send("Accent Coach AI backend running"));
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ---------- Hjælpere ----------
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Minimal WAV (mono 16-bit PCM) så UI altid kan spille noget
function sineWavBuffer(freq = 660, seconds = 1.1, sampleRate = 22050, vol = 0.2) {
  const n = Math.floor(seconds * sampleRate);
  const dataBytes = n * 2;
  const buf = Buffer.alloc(44 + dataBytes);

  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8);

  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);

  buf.write("data", 36);
  buf.writeUInt32LE(dataBytes, 40);

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const s = Math.sin(2 * Math.PI * freq * t) * vol;
    const v = Math.max(-1, Math.min(1, s));
    buf.writeInt16LE(Math.floor(v * 32767), 44 + i * 2);
  }
  return buf;
}

/* =========================
   Core API (unchanged behaviour)
   ========================= */

// ---------- API: generate sentence ----------
// --- Generate sentence (with cache headers for speed) ---
app.post("/api/generate-sentence", async (req, res) => {
  try {
    // ✅ Add short-term CDN/browser caching
    res.setHeader(
      "Cache-Control",
      "public, max-age=30, s-maxage=60, stale-while-revalidate=86400, stale-if-error=86400"
    );

    // Parse body
    const { level = "easy", accent = "en_us" } = req.body || {};

    // Example sentences (replace later with your real logic if you want)
    const samples = {
      easy:   "I like coffee in the morning.",
      medium: "Could you share your thoughts on it?",
      hard:   "Sustainability requires consistent, collective action."
    };

    const text = samples[level] || samples.easy;
    const voice = accent === "en_br" ? "en-GB" : "en-US";

    // ✅ Send JSON response
    res.status(200).json({ text, voice });
  } catch (err) {
    res.setHeader("Cache-Control", "public, max-age=5, s-maxage=5");
    console.error("❌ /api/generate-sentence error:", err);
    res.status(500).json({ error: err?.message || "generate-sentence failed" });
  }
});


// ---------- API: tts (returnerer lille WAV) ----------
app.get("/api/tts", (req, res) => {
  console.log("[api] tts query:", req.query);
  const wav = sineWavBuffer(660, 1.1);
  res.setHeader("Content-Type", "audio/wav");
  res.setHeader("Cache-Control", "no-store");
  res.send(wav);
});

// ---------- API: analyze-speech (mock) ----------
function mockAnalyze(refText = "") {
  const words = (refText || "")
    .replace(/[^a-zA-Z\s']/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12);

  return {
    overall: Math.round(72 + Math.random() * 18),
    feedback: "Mock scoring – for development only.",
    words: words.map((w) => ({
      word: w,
      score: Math.round(60 + Math.random() * 40),
    })),
  };
}

app.post("/api/analyze-speech", upload.single("audio"), (req, res) => {
  const { refText } = req.body || {};
  console.log("[api] analyze-speech file:", req.file?.mimetype, req.file?.size, "bytes; refText len:", (refText || "").length);
  res.json(mockAnalyze(refText));
});

// ---------- API: feedback ----------
app.post("/api/feedback", (req, res) => {
  const { message, userAgent, ts } = req.body || {};
  console.log(
    "[Feedback]",
    new Date(ts || Date.now()).toISOString(),
    userAgent || "",
    "\n",
    message || ""
  );
  res.json({ ok: true });
});

/* =========================
   Week 3: Pro status + Referral endpoints
   ========================= */

// GET /api/pro/status?userId=abc
app.get("/api/pro/status", async (req, res) => {
  const userId = String(req.query.userId || "").trim();
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  const pro = await store.isPro(userId);
  res.json({ pro });
});

// POST /api/pro/grant-trial { userId, days }
app.post("/api/pro/grant-trial", async (req, res) => {
  const { userId, days = 30 } = req.body || {};
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  const untilMs = await store.addProDays(userId, Number(days) || 30);
  res.json({ ok: true, untilMs });
});

// GET /api/referral/code?userId=abc -> returns stable code for inviter to share
app.get("/api/referral/code", async (req, res) => {
  const userId = String(req.query.userId || "").trim();
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  const code = await store.ensureRefCode(userId);
  // If using Upstash, ensure code->user binding happens in store.ensureRefCode; for fallback we bind here:
  if (store.bindRefCodeToUser) await store.bindRefCodeToUser(code, userId);
  res.json({ code });
});

// GET /api/referral/count?userId=abc
app.get("/api/referral/count", async (req, res) => {
  const userId = String(req.query.userId || "").trim();
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  const count = await store.getReferralCount(userId);
  res.json({ count });
});

// POST /api/referral/open { code, newUserId }
// Called when a new user opens the app/website with ?ref=CODE
app.post("/api/referral/open", async (req, res) => {
  const { code, newUserId } = req.body || {};
  if (!code) return res.status(400).json({ error: "Missing referral code" });

  const inviter = await store.resolveRef(code);
  if (!inviter) return res.json({ ok: false, reason: "unknown_code" });

  // avoid self-referral if you also send newUserId
  if (newUserId && String(newUserId) === String(inviter)) {
    return res.json({ ok: false, reason: "self_ref" });
  }

  // reward inviter
  await store.incReferralCount(inviter);
  const until = await store.addProDays(inviter, 30); // +30 days Pro
  res.json({ ok: true, inviter, proUntilMs: until });
});

/* =========================
   404 + Error handling
   ========================= */
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, _req, res, _next) => {
  console.error("[server error]", err);
  res.status(500).json({ error: "Server error", detail: err?.message || String(err) });
});

/* =========================
   Start server
   ========================= */
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`Accent Coach AI API listening on http://${HOST}:${PORT}`);
});
