// api/weakness.js
import express from "express";
import { getWeaknessOverview } from "../backend/lib/weaknessAggregator.js";
import { redis } from "../backend/lib/store.js"; // <-- vigtigt: vi bruger redis direkte

const router = express.Router();
const APP_ID = "accent-coach";

async function handleOverview(req, res) {
  try {
    const accent = String(req.query.accent || "").toLowerCase(); // "en_us" | "en_br" | ""
    // accent optional – if omitted, we return combined weakness across accents

    const userId =
      String(req.query.userId || "").trim() ||
      String(req.headers["x-user-id"] || "").trim() ||
      "local";

    let data;

if (!accent) {
  // samlet for alle accenter
  const accents = ["en_us", "en_br"];

  const results = await Promise.all(
    accents.map((a) => getWeaknessOverview(APP_ID, { userId, accent: a }))
  );

  // getWeaknessOverview returns an object like { topWeaknesses: [...] }
  // Convert to one flat array so frontend can merge reliably.
  const flat = [];
  for (let i = 0; i < results.length; i++) {
    const a = accents[i];
    const obj = results[i] || {};
    const arr = Array.isArray(obj.topWeaknesses) ? obj.topWeaknesses : [];

    for (const w of arr) {
      flat.push({
        phoneme: w?.label,
        avg: w?.avg,
        count: w?.count,
        accent: a,
        best: w?.best ?? w?.bestScore ?? null,
      });
    }
  }

  
  data = flat;
} else {
  // eksisterende adfærd
  data = await getWeaknessOverview(APP_ID, { userId, accent });
}

    return res.status(200).json(data);
  } catch (e) {
    console.error("[weakness] overview failed:", e?.message || e);
    return res.status(500).json({ error: "Weakness overview failed" });
  }
}


// Backwards compatible
router.get("/weakness", handleOverview);
router.get("/weakness/overview", handleOverview);

// Debug: confirms which process is serving requests
router.get("/weakness/_debug", (req, res) => {
  res.json({ ok: true, pid: process.pid, appId: APP_ID, ts: new Date().toISOString() });
});

// Debug: what does store.js export? (du har allerede en /_store route et sted - behold kun én)
router.get("/weakness/_store", async (req, res) => {
  try {
    res.json({
      ok: true,
      hasRedis: Boolean(redis),
      redisType: typeof redis,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Debug: dump raw saved data using redis
router.get("/weakness/_raw", async (req, res) => {
  try {
    if (!redis) {
      return res.status(500).json({ error: "redis is not available from store.js" });
    }

    // Upstash Redis supports keys(pattern) in most setups
    const pattern = `weakness:${APP_ID}:*`;
    const keys = await redis.keys(pattern);

    const rows = [];
    for (const k of keys) {
      const v = await redis.get(k);
      rows.push([k, v]);
    }

    res.json({ ok: true, count: rows.length, keys, rows });
  } catch (e) {
    console.error("[weakness] _raw failed:", e?.message || e);
    res.status(500).json({ error: "raw dump failed", detail: e?.message || String(e) });
  }
});

export default router;
