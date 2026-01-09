// backend/server.js
import dotenv from "dotenv";

// ✅ Load ROOT .env (project/.env)
dotenv.config({ path: new URL("../.env", import.meta.url) });

import express from "express";
import multer from "multer";
import cors from "cors";

import weaknessRouter from "../api/weakness.js";

/**
 * Loader that accepts both:
 * - default export function(req,res,next)
 * - default export express.Router()
 */
async function loadDefault(relPath, prettyName) {
  const mod = await import(relPath);
  const exp = mod?.default;

  if (!exp) {
    console.error(`\n[BOOT ERROR] ${prettyName} has no default export.`);
    console.error(`[BOOT ERROR] Exported keys:`, Object.keys(mod || {}));
    throw new Error(`${prettyName} missing default export`);
  }

  const isFn = typeof exp === "function";
  if (!isFn) {
    console.error(`\n[BOOT ERROR] ${prettyName} default export is not a function/router.`);
    console.error(`[BOOT ERROR] Type:`, typeof exp);
    throw new Error(`${prettyName} default export invalid`);
  }

  return exp;
}

// Load modules from ROOT /api folder
const ping = await loadDefault("../api/ping.js", "ping");
const analyzeSpeechRouter = await loadDefault("../api/analyze-speech.js", "analyze-speech router");
const alignTts = await loadDefault("../api/align-tts.js", "align-tts");
const tts = await loadDefault("../api/tts.js", "tts");

/* =========================
   Optional backend store (Upstash Redis)
   ========================= */
let store;
try {
  const mod = await import("./lib/store.js");
  store = mod.default || mod;
  console.log("[store] Using backend/lib/store.js");
} catch (e) {
  console.warn("[store] backend/lib/store.js not found. Using in-memory fallback (dev only).");

  const proUntil = new Map();
  const referralCount = new Map();
  const refMap = new Map();
  const codeOfUser = new Map();

  const now = () => Date.now();
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
  async function getReferralCount(userId) {
    return referralCount.get(userId) || 0;
  }
  async function incReferralCount(userId) {
    const c = (referralCount.get(userId) || 0) + 1;
    referralCount.set(userId, c);
    return c;
  }
  async function ensureRefCode(userId) {
    if (codeOfUser.has(userId)) return codeOfUser.get(userId);
    const code = randCode();
    codeOfUser.set(userId, code);
    return code;
  }
  async function bindRefCodeToUser(code, inviterUserId) {
    if (!code || !inviterUserId) return false;
    refMap.set(code, inviterUserId);
    return true;
  }
  async function resolveRef(code) {
    return refMap.get(code) || null;
  }

  store = {
    isPro,
    addProDays,
    getReferralCount,
    incReferralCount,
    ensureRefCode,
    bindRefCodeToUser,
    resolveRef,
  };
}

/* =========================
   App bootstrap
   ========================= */
const app = express();
multer(); // keep multer "used"

// ✅ Parse JSON for POST bodies (feedback/referrals/etc.)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ✅ CORS: dev-friendly, but safe-ish
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // non-browser / native

      const o = String(origin).replace(/\/+$/, "");
      if (o === "http://localhost:5173" || o === "http://127.0.0.1:5173") return cb(null, true);
      if (/^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(o)) return cb(null, true);

      // allow configured origins too
      const FRONTEND_ORIGIN = (process.env.FRONTEND_ORIGIN || "").split(",").map(s => s.trim().replace(/\/+$/, "")).filter(Boolean);
      if (FRONTEND_ORIGIN.includes(o)) return cb(null, true);

      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: false,
  })
);
app.options("*", cors());

// Logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health
app.get("/", (_req, res) => res.send("Accent Coach AI backend running"));
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ✅ Core routes
app.all("/api/ping", ping);
app.all("/api/align-tts", alignTts);
app.all("/api/tts", tts);

// ✅ analyze-speech is an Express Router -> mount at /api
app.use("/api", analyzeSpeechRouter);

/**
 * ✅ Weakness Router mounting (robust)
 * This makes the endpoint work whether api/weakness.js defines:
 *   - router.get("/weakness", ...)
 * OR
 *   - router.get("/api/weakness", ...)
 */
app.use("/api", weaknessRouter); // supports "/weakness"
app.use("/", weaknessRouter);    // supports "/api/weakness" if router hard-coded it

/**
 * ✅ HARD fallback so /api/weakness never 404 again.
 * Put this BEFORE the /api 404 handler.
 */
app.get("/api/weakness", (_req, res) => res.status(200).json({ items: [] }));
app.get("/api/weaknesses", (_req, res) => res.status(200).json({ items: [] }));

// Feedback
app.post("/api/feedback", (req, res) => {
  const { message, userAgent, ts } = req.body || {};
  console.log("[Feedback]", new Date(ts || Date.now()).toISOString(), userAgent || "", "\n", message || "");
  res.json({ ok: true });
});

// Pro + referral
app.get("/api/pro/status", async (req, res) => {
  const userId = String(req.query.userId || "").trim();
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  const pro = await store.isPro(userId);
  res.json({ pro });
});

app.post("/api/pro/grant-trial", async (req, res) => {
  const { userId, days = 30 } = req.body || {};
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  const untilMs = await store.addProDays(userId, Number(days) || 30);
  res.json({ ok: true, untilMs });
});

// app.get("/api/referral/code", async (req, res) => {
//   const userId = String(req.query.userId || "").trim();
//   if (!userId) return res.status(400).json({ error: "Missing userId" });
//   const code = await store.ensureRefCode(userId);
//   if (store.bindRefCodeToUser) await store.bindRefCodeToUser(code, userId);
//   res.json({ code });
// });


app.get("/api/referral/count", async (req, res) => {
  const userId = String(req.query.userId || "").trim();
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  const count = await store.getReferralCount(userId);
  res.json({ count });
});

app.post("/api/referral/open", async (req, res) => {
  const { code, newUserId } = req.body || {};
  if (!code) return res.status(400).json({ error: "Missing referral code" });

  const inviter = await store.resolveRef(code);
  if (!inviter) return res.json({ ok: false, reason: "unknown_code" });

  if (newUserId && String(newUserId) === String(inviter)) {
    return res.json({ ok: false, reason: "self_ref" });
  }

  await store.incReferralCount(inviter);
  const until = await store.addProDays(inviter, 30);
  res.json({ ok: true, inviter, proUntilMs: until });
});

// 404 + error (keep last)
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => {
  console.error("[server error]", err);
  res.status(500).json({ error: "Server error", detail: err?.message || String(err) });
});

// Start
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`Accent Coach AI API listening on http://${HOST}:${PORT}`);
  console.log("[env] SPEECHSUPER_APP_KEY loaded:", Boolean(process.env.SPEECHSUPER_APP_KEY));
  console.log("[env] SPEECHSUPER_SECRET_KEY loaded:", Boolean(process.env.SPEECHSUPER_SECRET_KEY));
});
