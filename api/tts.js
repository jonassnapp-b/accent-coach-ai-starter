import { getTtsAudio } from "./_lib/tts.js";

/**
 * GET /api/tts?text=Hello&accent=en_us&rate=1
 * POST /api/tts  { text, accent, rate }
 * Returns audio bytes
 */
export default async function handler(req, res) {
  console.log("[api/tts] HIT", req.method);

  try {
    const method = (req.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};
    const q = req.query || {};

    const text = String((method === "POST" ? body.text : q.text) || "").trim();
    if (!text) return res.status(400).json({ error: "Missing text" });

    const accentRaw = String((method === "POST" ? body.accent : q.accent) || "en_us").toLowerCase();
    const accent = accentRaw === "en_br" ? "en_br" : "en_us";

    const rate = Number((method === "POST" ? body.rate : q.rate) ?? 1.0) || 1.0;

    const { audioBuffer, mime } = await getTtsAudio({ text, accent, rate });

    res.setHeader("Content-Type", mime || "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(audioBuffer);
  } catch (err) {
    console.error("[api/tts] error", err);
    return res.status(500).json({
      error: "TTS failed",
      detail: err?.message || String(err),
    });
  }
}
