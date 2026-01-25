import { getTtsAudio } from "./_lib/tts.js";

/**
 * GET /api/tts?text=Hello&accent=en_us&rate=1
 * POST /api/tts  { text, accent, rate }
 * Returns audio bytes (mp3 by default)
 */
export default async function handler(req, res) {
  console.log("[api/tts] HIT", req.method);

  try {
    const method = (req.method || "GET").toUpperCase();

    if (method !== "GET" && method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const q = req.query || {};
    const b = req.body || {};

    const textRaw = method === "POST" ? b.text : q.text;
    const accentRaw = method === "POST" ? b.accent : q.accent;
    const rateRaw = method === "POST" ? b.rate : q.rate;
    const voiceRaw = method === "POST" ? b.voice : q.voice;


    const text = String(textRaw || "").trim();
    if (!text) return res.status(400).json({ error: "Missing text" });

    const accentNorm = String(accentRaw || "en_us").toLowerCase();
    const accent = accentNorm === "en_br" ? "en_br" : "en_us";

    const rate = Number(rateRaw ?? 1.0) || 1.0;
const voice = voiceRaw ? String(voiceRaw).trim() : "";

const { audioBuffer, mime } = await getTtsAudio({ text, accent, rate, voice });

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
