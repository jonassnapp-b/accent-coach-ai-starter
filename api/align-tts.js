// api/align-tts.js
import { randomUUID, createHash } from "crypto";

const sha1 = (s) => createHash("sha1").update(s).digest("hex");

// ---------- SpeechSuper helpers ----------
function makeConnectStart({ appKey, secretKey, userId, coreType, refText, dictDialect }) {
  const ts = Date.now().toString();
  const tokenId = randomUUID().replace(/-/g, "").toUpperCase();

  const connect = {
    cmd: "connect",
    param: {
      sdk: { version: 16777472, source: 9, protocol: 2 },
      app: {
        applicationId: appKey,
        sig: sha1(appKey + ts + secretKey),
        timestamp: ts,
      },
    },
  };

  const start = {
    cmd: "start",
    param: {
      app: {
        applicationId: appKey,
        sig: sha1(appKey + ts + userId + secretKey),
        userId,
        timestamp: ts,
      },
      audio: {
        audioType: "wav",
        sampleRate: 16000,
        channel: 1,
        sampleBytes: 2,
      },
      request: {
        coreType,
        refText,
        language: "en_us",
        dict_dialect: dictDialect,
        dict_type: "CMU",
        phoneme_output: 1,
        model: "non_native",
        scale: 100,
        precision: 0.6,
        slack: 0.2,
        tokenId,
      },
    },
  };

  return { connect, start };
}

async function postSpeechSuperExact({
  host,
  coreType,
  appKey,
  secretKey,
  userId,
  refText,
  wavBytes,
  dictDialect,
}) {
  if (typeof fetch !== "function" || typeof FormData === "undefined" || typeof Blob === "undefined") {
    throw new Error("Node is missing fetch/FormData/Blob. Use Node 18+.");
  }

  const url = `${host.replace(/\/$/, "")}/${coreType}`;
  const { connect, start } = makeConnectStart({
    appKey,
    secretKey,
    userId,
    coreType,
    refText,
    dictDialect,
  });

  const fd = new FormData();
  fd.append("text", JSON.stringify({ connect, start }));
  fd.append("audio", new Blob([wavBytes], { type: "audio/wav" }), "coach.wav");

  const r = await fetch(url, { method: "POST", headers: { "Request-Index": "0" }, body: fd });
  const raw = await r.text();

  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {}

  if (!r.ok) throw new Error(`SpeechSuper error ${r.status}: ${raw}`);
  return json || {};
}

function base64ToBuffer(b64 = "") {
  return Buffer.from(b64 || "", "base64");
}

// ---------- Azure TTS (REAL) ----------
let _azureTokenCache = { token: null, expMs: 0 };

async function getAzureToken({ key, region }) {
  const now = Date.now();
  if (_azureTokenCache.token && _azureTokenCache.expMs > now) return _azureTokenCache.token;

  const url = `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Length": "0",
    },
  });

  const text = await r.text();
  if (!r.ok) throw new Error(`Azure issueToken failed ${r.status}: ${text}`);

  // Token is usually valid ~10 minutes. Cache for 9 min to be safe.
  _azureTokenCache = { token: text, expMs: Date.now() + 9 * 60 * 1000 };
  return text;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// Map your "ttsRate" (roughly 0.5..1.5) to Azure SSML prosody rate
function ttsRateToAzureRate(ttsRate) {
  const r = Number(ttsRate ?? 1.0);
  if (!Number.isFinite(r) || r <= 0) return "0%";
  // 1.0 => 0%, 0.5 => -50%, 1.5 => +50%
  const pct = Math.round((r - 1.0) * 100);
  return `${clamp(pct, -60, 80)}%`;
}

function pickAzureVoice(dictDialect) {
  // You can change voices later if you want.
  if (dictDialect === "en_br") return "en-GB-LibbyNeural";
  return "en-US-JennyNeural";
}

async function azureTtsToWavBase64({ text, dictDialect, ttsRate }) {
  const key = process.env.AZURE_SPEECH_KEY || "";
  const region = process.env.AZURE_SPEECH_REGION || "";

  if (!key || !region) {
    throw new Error("Azure TTS missing AZURE_SPEECH_KEY or AZURE_SPEECH_REGION.");
  }

  const token = await getAzureToken({ key, region });
  const voice = pickAzureVoice(dictDialect);
  const rate = ttsRateToAzureRate(ttsRate);

  // IMPORTANT: request 16kHz PCM WAV so SpeechSuper spans align well
  const outputFormat = "riff-16khz-16bit-mono-pcm";
  const ttsUrl = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const ssml =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<speak version="1.0" xml:lang="en-US">` +
    `<voice name="${voice}">` +
    `<prosody rate="${rate}">${escapeXml(text)}</prosody>` +
    `</voice></speak>`;

  const r = await fetch(ttsUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": outputFormat,
      "User-Agent": "accent-coach-ai",
    },
    body: ssml,
  });

  const arr = await r.arrayBuffer();
  if (!r.ok) {
    const msg = Buffer.from(arr).toString("utf8");
    throw new Error(`Azure TTS failed ${r.status}: ${msg}`);
  }

  const b64 = Buffer.from(arr).toString("base64");
  return { audioBase64: b64, mime: "audio/wav" };
}

function escapeXml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * DEV fallback TTS (beep):
 * Calls GET /api/tts which returns audio/wav
 * Only used when MOCK=1
 */
async function devBeepTtsAudioBase64({ text, accent, rate, port }) {
  const url =
    `http://127.0.0.1:${port}/api/tts` +
    `?text=${encodeURIComponent(text)}` +
    `&accent=${encodeURIComponent(accent || "en_us")}` +
    `&rate=${encodeURIComponent(String(rate ?? 1.0))}`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`TTS fallback failed ${r.status}`);

  const arr = await r.arrayBuffer();
  const b64 = Buffer.from(arr).toString("base64");
  return { audioBase64: b64, mime: "audio/wav" };
}

// --------- Vercel/Express-compatible handler ----------
async function readJsonBody(req) {
  // Express already parsed -> req.body exists
  if (req.body && typeof req.body === "object") return req.body;

  // Vercel/Node raw stream
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const body = await readJsonBody(req);

    const appKey = process.env.SPEECHSUPER_APP_KEY || "";
    const secretKey = process.env.SPEECHSUPER_SECRET_KEY || "";
    const host = (process.env.SPEECHSUPER_HOST || "https://api.speechsuper.com").replace(/\/$/, "");

    if (!appKey || !secretKey) {
      return res.status(500).json({ error: "SpeechSuper keys missing." });
    }

    const refText = String(body?.refText || "").trim();
    if (!refText) return res.status(400).json({ error: "Missing refText." });

    const accentRaw = String(body?.accent || "en_us").toLowerCase();
    const dictDialect = accentRaw === "en_br" ? "en_br" : "en_us";
    const ttsRate = Number(body?.ttsRate ?? 1.0) || 1.0;

    const USE_MOCK = String(process.env.MOCK || "0") === "1";
    const port = Number(process.env.PORT || 3000);

    // 1) generate coach/native audio (REAL Azure by default; beep only in MOCK)
    let audioBase64, mime;

    if (USE_MOCK) {
      // DEV beep for quick UI testing
      const out = await devBeepTtsAudioBase64({
        text: refText,
        accent: dictDialect,
        rate: ttsRate,
        port,
      });
      audioBase64 = out.audioBase64;
      mime = out.mime;
    } else {
      // REAL TTS (Azure)
      const out = await azureTtsToWavBase64({
        text: refText,
        dictDialect,
        ttsRate,
      });
      audioBase64 = out.audioBase64;
      mime = out.mime;
    }

    // 2) run SpeechSuper on the coach audio to get spans
    const wavBytes = base64ToBuffer(audioBase64);
    const coreType = /\s/.test(refText) ? "sent.eval.promax" : "word.eval.promax";
    const userId = "accent-coach-tts";

    const ss = await postSpeechSuperExact({
      host,
      coreType,
      appKey,
      secretKey,
      userId,
      refText,
      wavBytes,
      dictDialect,
    });

    if (ss?.errId || ss?.error) {
      return res.status(502).json({ error: ss.error || "SpeechSuper error", errId: ss.errId });
    }

    const root = ss?.result || ss?.text_score || ss || {};
    const wordsIn = root.words || root.word_score_list || root.wordList || root.word_scores || [];
    const w0 = (Array.isArray(wordsIn) ? wordsIn : [])[0] || null;
    const phSrc = w0?.phonemes || w0?.phone_score_list || w0?.phones || [];
    const phonemes = Array.isArray(phSrc) ? phSrc : [];

    // IMPORTANT: allow span.start === 0 (your old code accidentally rejected it)
    const tokens = phonemes
      .map((p, idx) => {
        const sym = String(p?.ph ?? p?.phoneme ?? p?.phone ?? p?.sound_like ?? "").trim();
        const span = p?.span && typeof p.span === "object" ? p.span : null;

        if (!sym) return null;
        if (!span) return null;
        if (span.start == null || span.end == null) return null;

        const start = Number(span.start) / 100; // 10ms -> seconds
        const end = Number(span.end) / 100;

        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
        return { i: idx + 1, sym, start, end };
      })
      .filter(Boolean);

    if (!tokens.length) {
      return res.status(500).json({ error: "No phoneme spans returned for coach audio." });
    }

    return res.status(200).json({ audioBase64, mime: mime || "audio/wav", tokens });
  } catch (err) {
    console.error("[align-tts] error", err);
    return res.status(500).json({ error: "Server error", detail: err?.message || String(err) });
  }
}
