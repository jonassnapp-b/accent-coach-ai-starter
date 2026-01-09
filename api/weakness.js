// api/weakness.js
import express from "express";
import { getWeaknessOverview } from "../backend/lib/weaknessAggregator.js";
import { redis } from "../backend/lib/store.js"; // <-- vigtigt: vi bruger redis direkte

const router = express.Router();
const APP_ID = "accent-coach";

async function handleOverview(req, res) {
  try {
    const data = await getWeaknessOverview(APP_ID);
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
