// api/analyze-speech.js
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { Readable } from "stream";
import { createHash, randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
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

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Request-Index, X-Requested-With"
  );
}

if (ffmpegPath) {
  try {
    ffmpeg.setFfmpegPath(ffmpegPath);
  } catch (e) {
    console.error("[ffmpeg] setFfmpegPath failed:", e?.message || e);
  }
}

const upload = multer({ storage: multer.memoryStorage() });

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) reject(result);
      else resolve(result);
    });
  });
}

// ---------- audio helpers ----------
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
    console.log("[ffmpeg] converting", { mime: inputMimeHint, inPath, outPath });

    ffmpeg(inPath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(16000)
      .audioCodec("pcm_s16le")
      .format("wav")
      .on("error", async (err) => {
        console.error("[ffmpeg] error:", err?.message || err);
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
          console.error("[ffmpeg] read out file failed:", e?.message || e);
          reject(e);
        }
      })
      .save(outPath);
  });
}

// ---------- SpeechSuper helpers ----------
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

  const r = await fetch(url, {
    method: "POST",
    headers: { "Request-Index": "0" },
    body: fd,
  });

  const raw = await r.text();
  let json = null;
  try { json = JSON.parse(raw); } catch {}
  if (!r.ok) throw new Error(`SpeechSuper error ${r.status}: ${raw}`);
  return json || {};
}

function mapSpeechsuperToUi(ss, refText, accent) {
  const root = ss?.result || ss?.text_score || ss || {};

  let overall100 =
    Number(
      root.overall ??
      root.pronunciation ??
      root.pronunciation_score ??
      root.accuracy_score ??
      root.overall_score ??
      ss?.pronunciation_score ??
      ss?.accuracy_score ??
      0
    ) || 0;

  const wordsIn = root.words || root.word_score_list || root.wordList || root.word_scores || [];
  const words = [];
  let debug_hasWordSpan = 0;
  let debug_hasPhonemeSpan = 0;

  for (const it of Array.isArray(wordsIn) ? wordsIn : []) {
    const wText = (it.word ?? it.text ?? it.display ?? it.word_text ?? "").toString().trim();
    let wScore100 = Number(it?.scores?.overall ?? it?.overall ?? it?.pronunciation ?? it?.accuracy ?? 0) || 0;

    const wordSpan = it?.span && typeof it.span === "object" ? it.span : null;
    if (wordSpan?.start != null && wordSpan?.end != null) debug_hasWordSpan++;

    const phSrc = it.phonemes || it.phone_score_list || it.phones || [];
    const phonemes = [];

    for (const p of Array.isArray(phSrc) ? phSrc : []) {
      const ph = (p.ph ?? p.phoneme ?? p.phone ?? p.sound_like ?? "").toString().trim();
      if (!ph) continue;

      const s100 = Number(
        p.pronunciation ??
        p.accuracy_score ??
        p.pronunciation_score ??
        p.score ??
        p.accuracy ??
        0
      ) || 0;

      const phSpan = p?.span && typeof p.span === "object" ? p.span : null;
      if (phSpan?.start != null && phSpan?.end != null) debug_hasPhonemeSpan++;

      phonemes.push({
        ph,
        phoneme: ph,
        score: s100 > 1 ? s100 / 100 : s100,
        accuracy: s100 > 1 ? s100 / 100 : s100,
        accuracyScore: Math.round(s100 > 1 ? s100 : s100 * 100),
        sound_like: p.sound_like ?? null,
        stress_mark: typeof p.stress_mark === "number" ? p.stress_mark : 0,
        span: p.span ? { start: p.span.start, end: p.span.end } : null,
      });
    }

    const w01 = Math.max(0, Math.min(1, wScore100 > 1 ? wScore100 / 100 : wScore100));

    words.push({
      w: wText || refText,
      word: wText || refText,
      score: w01,
      accuracy: w01,
      accuracyScore: Math.round(w01 * 100),
      phonemes,
      phonics: [],
      pause: it.pause ?? null,
      span: wordSpan,
    });
  }

  if (!overall100 && words.length) {
    overall100 = Math.round((words.reduce((a, b) => a + (b.score || 0), 0) / words.length) * 100);
  }

  return {
    transcript: refText,
    accent,
    words,
    overall: Math.max(0, Math.min(1, overall100 / 100)),
    overallAccuracy: Math.round(overall100),
    integrity: root.integrity ?? null,
    fluency: root.fluency ?? null,
    rhythm: root.rhythm ?? null,
    speed: root.speed ?? null,
    pause_count: root.pause_count ?? null,
    duration: root.duration ?? null,
    numeric_duration: root.numeric_duration ?? null,
    rear_tone: root.rear_tone ?? null,
    _debug: {
      resultKeys: Object.keys(root || {}),
      hasWordSpanCount: debug_hasWordSpan,
      hasPhonemeSpanCount: debug_hasPhonemeSpan,
    },
  };
}

export default async function handler(req, res) {
  // ✅ ALWAYS set CORS first (even for 405)
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method Not Allowed");
  }

  try {
    // parse multipart via multer
    await runMiddleware(req, res, upload.single("audio"));

    const appKey = process.env.SPEECHSUPER_APP_KEY || "";
    const secretKey = process.env.SPEECHSUPER_SECRET_KEY || "";
    const host = (process.env.SPEECHSUPER_HOST || "https://api.speechsuper.com").replace(/\/$/, "");
    if (!appKey || !secretKey) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: "SpeechSuper keys missing." }));
    }

    const body = req.body || {};

    let refText = String(body.refText ?? body.text ?? body.prompt ?? "");
    refText = refText.replace(/[.?!,:;]+/g, "").replace(/\s+/g, " ").trim();
    if (!refText) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Missing refText." }));
    }

    const accentRaw = String(body.accent || body.dictDialect || "").toLowerCase();
    const dictDialect = accentRaw === "en_br" ? "en_br" : "en_us";

    let rawBuf, mimeHint = "";
    if (req.file?.buffer) {
      rawBuf = req.file.buffer;
      mimeHint = req.file.mimetype || "";
    } else if (req.headers["content-type"]?.includes("application/json")) {
      const { audio, audioBase64, mime } = body ?? {};
      const b64 = audioBase64 || audio || "";
      if (b64) {
        rawBuf = dataURLtoBuffer(b64);
        mimeHint = mime || "";
      }
    }

    if (!rawBuf) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Missing audio." }));
    }

    const wavBytes = await toWavPcm16Mono16k(rawBuf, mimeHint);
    const coreType = /\s/.test(refText) ? "sent.eval.promax" : "word.eval.promax";
    const userId = "accent-coach";

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
      res.statusCode = 502;
      return res.end(JSON.stringify({ error: ss.error || "SpeechSuper error", errId: ss.errId }));
    }

    const uiAccent = dictDialect === "en_br" ? "en-GB" : "en-US";
    const ui = mapSpeechsuperToUi(ss, refText, uiAccent);

    // keep your weakness aggregation as-is (short version)
    try {
      const phonemes = [];
      for (const w of ui.words || []) {
        for (const p of w.phonemes || []) {
          const label = String(p.phoneme || p.ph || "").trim();
          const score = Number(p.accuracyScore ?? 0);
          if (label && Number.isFinite(score)) phonemes.push({ label: label.toUpperCase(), score });
        }
      }
      if (phonemes.length) await recordSessionResult("accent-coach", { phonemes });
    } catch (e) {
      console.warn("[WeaknessLab] save failed:", e?.message || e);
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(ui));
  } catch (err) {
    console.error("[analyze-speech] error", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: err?.message || String(err) }));
  }
}
