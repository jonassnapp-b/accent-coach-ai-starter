// api/analyze-speech.js
import express from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { createHash, randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { recordSessionResult } from "../backend/lib/weaknessAggregator.js";

async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}



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

const router = express.Router();
router.use((req, res, next) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});
router.options("/", (req, res) => {
  setCors(req, res);
  return res.status(204).end();
});



const upload = multer({ storage: multer.memoryStorage() });
export const config = { api: { bodyParser: false } };

// ---------- audio helpers ----------
function dataURLtoBuffer(str = "") {
  const base64 = str.includes(",") ? str.split(",")[1] : str;
  return Buffer.from(base64 || "", "base64");
}

// VIGTIGT: brug midlertidige filer i stedet for pipes
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
        try {
          await fs.unlink(inPath);
        } catch {}
        try {
          await fs.unlink(outPath);
        } catch {}
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
        dict_dialect: dictDialect, // en_us or en_br
        dict_type: "CMU",
        phoneme_output: 1,
        model: "non_native",
        scale: 100,
        precision: 0.6,
        slack: -0.5,
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
  fd.append("audio", new Blob([wavBytes], { type: "audio/wav" }), "clip.wav");

  const r = await fetchWithTimeout(
  url,
  {
    method: "POST",
    headers: { "Request-Index": "0" },
    body: fd,
  },
  25000
);

  const raw = await r.text();
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {}
  if (!r.ok) throw new Error(`SpeechSuper error ${r.status}: ${raw}`);
  return json || {};
}

// ---------- normalize all official fields ----------
function mapSpeechsuperToUi(ss, refText, accent) {
  const root = ss?.result || ss?.text_score || ss || {};
  // --- extra “meta” fields SpeechSuper may return (varies by coreType) ---
  const recognitionText =
    (root.recognition ?? root.transcription ?? root.asr ?? "").toString().trim() || null;

  const warning = root.warning ?? ss?.warning ?? null;

  const confidence =
    (typeof root.confidence === "number" ? root.confidence : null) ??
    (typeof ss?.confidence === "number" ? ss.confidence : null);

  const pause_filler = root.pause_filler ?? null;

  const liaison = root.liaison ?? null;
  const plosion = root.plosion ?? null;

  const sentences = root.sentences ?? null;

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

    let wScore100 =
      Number(it?.scores?.overall ?? it?.overall ?? it?.pronunciation ?? it?.accuracy ?? 0) || 0;

    // ✅ WORD span (10ms units) — keep it if SpeechSuper provides it
    const wordSpan = it?.span && typeof it.span === "object" ? it.span : null;
    if (wordSpan?.start != null && wordSpan?.end != null) debug_hasWordSpan++;

    const phSrc = it.phonemes || it.phone_score_list || it.phones || [];
    const phonemes = [];

    for (const p of Array.isArray(phSrc) ? phSrc : []) {
      const ph = (p.ph ?? p.phoneme ?? p.phone ?? p.sound_like ?? "").toString().trim();
      if (!ph) continue;

      const s100 =
        Number(
          p.pronunciation ??
            p.accuracy_score ??
            p.pronunciation_score ??
            p.score ??
            p.accuracy ??
            0
        ) || 0;

      // ✅ PHONEME span (10ms units) — keep it if SpeechSuper provides it
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
  span: p.span
    ? {
        start: p.span.start,
        end: p.span.end,
      }
    : null,
});

    }

    const phonicsIn = it.phonics || it.phone_letter_map || [];
    const phonics = [];
    for (const row of Array.isArray(phonicsIn) ? phonicsIn : []) {
      const s100 = Number(row.overall ?? row.pronunciation ?? row.accuracy ?? 0) || 0;
      phonics.push({
        spell: row.spell ?? row.letters ?? "",
        phoneme: Array.isArray(row.phoneme) ? row.phoneme : row.phoneme ? [row.phoneme] : [],
        overall: Math.round(s100 > 1 ? s100 : s100 * 100),
        sound_like: row.sound_like ?? null,
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
      phonics,
      pause: it.pause ?? null,

      // ✅ extras (only present in some SS cores)
      stress: typeof it.stress === "number" ? it.stress : null, // 0/100 (if provided)
      phonemewise_read:
        typeof it.phonemewise_read === "number"
          ? it.phonemewise_read
          : typeof it.detect_phonemewise_read === "number"
          ? it.detect_phonemewise_read
          : null,

      // ✅ NEW: word span passed through
      span: wordSpan, // { start, end } in 10ms units (if provided)
    });

  }

  if (!overall100 && words.length) {
    overall100 = Math.round((words.reduce((a, b) => a + (b.score || 0), 0) / words.length) * 100);
  }

  return {
    transcript: refText,
        recognition: recognitionText, // what SpeechSuper thinks you said (if provided)
    confidence,                   // STT confidence (if provided)
    warning,                      // warning codes/messages (if provided)
    pause_filler,                 // filler words stats (if provided)
    liaison,                      // linking (if provided)
    plosion,                      // loss of plosion (if provided)
    sentences,                    // sentence-level array (if provided)
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
    warning: root.warning ?? root.warn ?? null,
confidence: root.confidence ?? root.conf ?? root.confidence_score ?? null,
pause_filler: root.pause_filler ?? root.filler ?? null,
liaison: root.liaison ?? null,
plosion: root.plosion ?? null,

    _debug: {
      resultKeys: Object.keys(root || {}),
      hasWordSpanCount: debug_hasWordSpan,
      hasPhonemeSpanCount: debug_hasPhonemeSpan,
    },
  };
}

// ---------- route ----------
router.post("/", upload.single("audio"), async (req, res) => {
  try {
    const appKey = process.env.SPEECHSUPER_APP_KEY || "";
    const secretKey = process.env.SPEECHSUPER_SECRET_KEY || "";
    const host = (process.env.SPEECHSUPER_HOST || "https://api.speechsuper.com").replace(/\/$/, "");
    if (!appKey || !secretKey) {
      return res.status(500).json({ error: "SpeechSuper keys missing." });
    }

    const body = req.body || {};

let refText = String(
  body.refText ??
  body.text ??
  body.prompt ??
  ""
);

// 🔑 KRITISK: normalisér refText før SpeechSuper
refText = refText
  .replace(/[.?!,:;]+/g, "")   // fjern tegn man ikke "udtaler"
  .replace(/\s+/g, " ")        // fix dobbelte spaces
  .trim();

console.log(
  "[analyze-speech] refText:",
  JSON.stringify(refText),
  "hasSpace:",
  /\s/.test(refText)
);


if (!refText) {
  return res.status(400).json({ error: "Missing refText." });
}


    const accentRaw = String(body.accent || body.dictDialect || "").toLowerCase();
    const dictDialect = accentRaw === "en_br" ? "en_br" : "en_us";

    let rawBuf,
      mimeHint = "";
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
    if (!rawBuf) {
      return res.status(400).json({ error: "Missing audio." });
    }

    console.log("[analyze-speech] received audio mime:", mimeHint);

    const wavBytes = await toWavPcm16Mono16k(rawBuf, mimeHint);
    const coreType = /\s/.test(refText) ? "sent.eval.promax" : "word.eval.promax";
    const userId =
  String(body.userId || "").trim() ||
  String(req.headers["x-user-id"] || "").trim() ||
  "local";

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
try {
  const root = ss?.result || ss?.text_score || ss || {};
  const words0 = (root.words || root.word_score_list || root.wordList || root.word_scores || [])[0];
  const ph0 = (words0?.phonemes || words0?.phone_score_list || words0?.phones || [])[0];

  console.log("=== RAW SS CHECK ===");
  console.log("root keys:", Object.keys(root || {}));
  console.log("first word keys:", words0 ? Object.keys(words0) : null);
  console.log("first phoneme keys:", ph0 ? Object.keys(ph0) : null);
  console.log("first phoneme span:", ph0?.span ?? null);
  console.log("====================");
} catch (e) {
  console.log("RAW SS CHECK failed:", e?.message || e);
}

    if (ss?.errId || ss?.error) {
      return res.status(502).json({
        error: ss.error || "SpeechSuper error",
        errId: ss.errId,
      });
    }

    const uiAccent = dictDialect === "en_br" ? "en-GB" : "en-US";
    const ui = mapSpeechsuperToUi(ss, refText, uiAccent);
// -------- WeaknessLab save (ONLY ONCE per request) --------
try {
  const phonemes = [];

  for (const w of ui.words || []) {
    for (const p of w.phonemes || []) {
      const label = String(p.phoneme || p.ph || "").trim();
      const score = Number(p.accuracyScore ?? 0); // 0–100
      if (!label) continue;
      if (!Number.isFinite(score)) continue;

      phonemes.push({ label: label.toUpperCase(), score });
    }
  }

  if (phonemes.length) {
    await recordSessionResult(userId, { accent: dictDialect, phonemes });
    console.log("[WeaknessLab] saved phonemes:", phonemes.length);
  } else {
    console.log("[WeaknessLab] no phonemes to save");
  }
} catch (e) {
  console.warn("[WeaknessLab] save failed:", e?.message || e);
}


    return res.status(200).json(ui);
} catch (err) {
  const msg = String(err?.message || "");
  if (err?.name === "AbortError" || /aborted|timeout/i.test(msg)) {
    return res.status(504).json({ error: "Speech analysis timed out. Please try again." });
  }
  console.error("[analyze-speech] top-level error", err);
  return res.status(500).json({ error: err?.message || String(err) });
}


});

export default router;