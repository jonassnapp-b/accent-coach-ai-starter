// api/analyze-speech.js
import express from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { createHash, randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import { recordSessionResult } from "../backend/lib/weaknessAggregator.js";

export const config = { api: { bodyParser: false } };

function setCors(req, res) {
  const origin = req.headers.origin;

  const allowed = new Set([
    "capacitor://localhost",
    "ionic://localhost",
    "http://localhost",
    "http://localhost:5173",
    "https://accent-coach-ai-starter.vercel.app",
  ]);

  if (origin && allowed.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  // IMPORTANT: always return these so preflight passes
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Request-Index, X-Requested-With"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}

if (ffmpegPath) {
  try {
    ffmpeg.setFfmpegPath(ffmpegPath);
  } catch (e) {
    console.error("[ffmpeg] setFfmpegPath failed:", e?.message || e);
  }
}

const upload = multer({ storage: multer.memoryStorage() });

function dataURLtoBuffer(str = "") {
  const base64 = str.includes(",") ? str.split(",")[1] : str;
  return Buffer.from(base64 || "", "base64");
}

function bufferToStream(buf) {
  const s = new Readable();
  s._read = () => {};
  s.push(buf);
  s.push(null);
  return s;
}

async function toWavPcm16Mono16k(inputBuf, inputMimeHint = "") {
  const id = randomUUID().replace(/-/g, "");
  const tmpDir = os.tmpdir();

  let ext = ".bin";
  if (/webm/i.test(inputMimeHint)) ext = ".webm";
  else if (/m4a|mp4/i.test(inputMimeHint)) ext = ".m4a";
  else if (/aac/i.test(inputMimeHint)) ext = ".aac";
  else if (/ogg/i.test(inputMimeHint)) ext = ".ogg";

  const inPath = path.join(tmpDir, `ac_in_${id}${ext}`);
  const outPath = path.join(tmpDir, `ac_out_${id}.wav`);

  await fs.writeFile(inPath, inputBuf);

  return new Promise((resolve, reject) => {
    ffmpeg(inPath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(16000)
      .audioCodec("pcm_s16le")
      .format("wav")
      .on("error", async (err) => {
        try { await fs.unlink(inPath); } catch {}
        try { await fs.unlink(outPath); } catch {}
        reject(new Error("ffmpeg convert failed: " + (err?.message || err)));
      })
      .on("end", async () => {
        try {
          const data = await fs.readFile(outPath);
          await fs.unlink(inPath).catch(() => {});
          await fs.unlink(outPath).catch(() => {});
          resolve(data);
        } catch (e) {
          reject(e);
        }
      })
      .save(outPath);
  });
}

const sha1 = (s) => createHash("sha1").update(s).digest("hex");

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
      audio: { audioType: "wav", sampleRate: 16000, channel: 1, sampleBytes: 2 },
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
        slack: -1,
        tokenId,
      },
    },
  };

  return { connect, start };
}

async function postSpeechSuperExact({ host, coreType, appKey, secretKey, userId, refText, wavBytes, dictDialect }) {
  const url = `${host.replace(/\/$/, "")}/${coreType}`;
  const { connect, start } = makeConnectStart({ appKey, secretKey, userId, coreType, refText, dictDialect });

  const fd = new FormData();
  fd.append("text", JSON.stringify({ connect, start }));
  fd.append("audio", new Blob([wavBytes], { type: "audio/wav" }), "clip.wav");

  const r = await fetch(url, { method: "POST", headers: { "Request-Index": "0" }, body: fd });
  const raw = await r.text();
  let json = null;
  try { json = JSON.parse(raw); } catch {}
  if (!r.ok) throw new Error(`SpeechSuper error ${r.status}: ${raw}`);
  return json || {};
}

// KEEP your existing mapper (use yours if you want)
function mapSpeechsuperToUi(ss, refText, accent) {
  const root = ss?.result || ss?.text_score || ss || {};
  const wordsIn = root.words || root.word_score_list || [];
  const words = (Array.isArray(wordsIn) ? wordsIn : []).map((it) => {
    const wText = String(it.word ?? it.text ?? "").trim();
    const phonemesSrc = it.phonemes || it.phone_score_list || it.phones || [];
    const phonemes = (Array.isArray(phonemesSrc) ? phonemesSrc : []).map((p) => {
      const ph = String(p.ph ?? p.phoneme ?? p.phone ?? "").trim();
      const s100 = Number(p.pronunciation ?? p.accuracy_score ?? p.pronunciation_score ?? p.score ?? p.accuracy ?? 0) || 0;
      return {
        phoneme: ph,
        accuracyScore: Math.round(s100 > 1 ? s100 : s100 * 100),
        span: p?.span ? { start: p.span.start, end: p.span.end } : null,
      };
    }).filter(p => p.phoneme);

    const wScore100 = Number(it?.scores?.overall ?? it?.overall ?? it?.pronunciation ?? it?.accuracy ?? 0) || 0;
    const w01 = Math.max(0, Math.min(1, wScore100 > 1 ? wScore100 / 100 : wScore100));

    return {
      word: wText || refText,
      accuracyScore: Math.round(w01 * 100),
      phonemes,
      span: it?.span && typeof it.span === "object" ? it.span : null,
    };
  });

  let overall100 = Number(root.overall ?? root.pronunciation ?? root.pronunciation_score ?? root.accuracy_score ?? 0) || 0;
  if (!overall100 && words.length) overall100 = Math.round(words.reduce((a, b) => a + (b.accuracyScore || 0), 0) / words.length);

  return {
    transcript: refText,
    accent,
    words,
    overallAccuracy: Math.round(overall100),
    overall: Math.max(0, Math.min(1, overall100 / 100)),
  };
}

const app = express();

// ✅ CORS MUST be first (before any routes)
app.use((req, res, next) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// ✅ Preflight for this function path
app.options("/", (req, res) => {
  setCors(req, res);
  return res.status(204).end();
});

// ✅ POST handler at "/" because file path already is /api/analyze-speech
app.post("/", upload.single("audio"), async (req, res) => {
  try {
    const appKey = process.env.SPEECHSUPER_APP_KEY || "";
    const secretKey = process.env.SPEECHSUPER_SECRET_KEY || "";
    const host = (process.env.SPEECHSUPER_HOST || "https://api.speechsuper.com").replace(/\/$/, "");
    if (!appKey || !secretKey) return res.status(500).json({ error: "SpeechSuper keys missing." });

    const body = req.body || {};
    let refText = String(body.refText ?? body.text ?? body.prompt ?? "");
    refText = refText.replace(/[.?!,:;]+/g, "").replace(/\s+/g, " ").trim();
    if (!refText) return res.status(400).json({ error: "Missing refText." });

    const accentRaw = String(body.accent || body.dictDialect || "").toLowerCase();
    const dictDialect = accentRaw === "en_br" ? "en_br" : "en_us";

    let rawBuf, mimeHint = "";
    if (req.file?.buffer) {
      rawBuf = req.file.buffer;
      mimeHint = req.file.mimetype || "";
    } else if (req.is("application/json")) {
      const { audio, audioBase64, mime } = req.body ?? {};
      const b64 = audioBase64 || audio || "";
      if (b64) {
        rawBuf = dataURLtoBuffer(b64);
        mimeHint = mime || "";
      }
    }
    if (!rawBuf) return res.status(400).json({ error: "Missing audio." });

    const wavBytes = await toWavPcm16Mono16k(rawBuf, mimeHint);
    const coreType = /\s/.test(refText) ? "sent.eval.promax" : "word.eval.promax";
    const userId = "accent-coach";

    const ss = await postSpeechSuperExact({ host, coreType, appKey, secretKey, userId, refText, wavBytes, dictDialect });
    if (ss?.errId || ss?.error) return res.status(502).json({ error: ss.error || "SpeechSuper error", errId: ss.errId });

    const uiAccent = dictDialect === "en_br" ? "en-GB" : "en-US";
    const ui = mapSpeechsuperToUi(ss, refText, uiAccent);

    // (optional) keep your weakness saving, but ONLY once (not 5x)
    try {
      const phonemes = [];
      for (const w of ui.words || []) for (const p of w.phonemes || []) {
        const label = String(p.phoneme || "").trim();
        const score = Number(p.accuracyScore ?? 0);
        if (label && Number.isFinite(score)) phonemes.push({ label: label.toUpperCase(), score });
      }
      if (phonemes.length) await recordSessionResult("accent-coach", { phonemes });
    } catch {}

    return res.status(200).json(ui);
  } catch (err) {
    console.error("[analyze-speech] error", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

export default app;
