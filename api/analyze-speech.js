// api/analyze-speech.js
import express from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { Readable } from "stream";
import { createHash, randomUUID } from "crypto";

if (ffmpegPath) try { ffmpeg.setFfmpegPath(ffmpegPath); } catch {}

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
export const config = { api: { bodyParser: false } };

/* ----------------- audio helpers ----------------- */
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
  return new Promise((resolve, reject) => {
    const inStream = bufferToStream(inputBuf);
    const chunks = [];
    const cmd = ffmpeg(inStream);
    if (/(aac|m4a|mp4)/i.test(inputMimeHint)) cmd.inputFormat("aac");
    cmd
      .audioChannels(1)
      .audioFrequency(16000)
      .audioCodec("pcm_s16le")
      .format("wav")
      .on("error", (err) => reject(new Error(String(err))))
      .on("end", () => resolve(Buffer.concat(chunks)));
    cmd
      .pipe()
      .on("data", (c) => chunks.push(c))
      .on("error", (err) => reject(new Error(String(err))));
  });
}

/* ----------------- SpeechSuper helpers ----------------- */
const sha1 = (s) => createHash("sha1").update(s).digest("hex");
const chooseCore = (refText) =>
  /\s/.test((refText || "").trim()) ? "sent.eval.promax" : "word.eval.promax";

function makeConnectStart({ appKey, secretKey, userId, coreType, refText }) {
  const tsConnect = Date.now().toString();
  const tsStart = Date.now().toString();
  const tokenId = randomUUID().replace(/-/g, "").toUpperCase();

  const connect = {
    cmd: "connect",
    param: {
      sdk: { version: 16777472, source: 9, protocol: 2 },
      app: {
        applicationId: appKey,
        sig: sha1(appKey + tsConnect + secretKey),
        timestamp: tsConnect,
      },
    },
  };

  const start = {
    cmd: "start",
    param: {
      app: {
        applicationId: appKey,
        sig: sha1(appKey + tsStart + userId + secretKey),
        userId,
        timestamp: tsStart,
      },
      audio: { audioType: "wav", sampleRate: 16000, channel: 1, sampleBytes: 2 },
      request: {
  coreType,
  language: "en_us",
  dict_dialect: accent, // use en_us or en_br
  precision: 1,
  getParam: 1,
  phoneme_output: 1,
  refText,
  question_prompt: refText,
  rank: 100,
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
}) {
  const url = `${host.replace(/\/$/, "")}/${coreType}`;
  const { connect, start } = makeConnectStart({
    appKey,
    secretKey,
    userId,
    coreType,
    refText,
  });

  const fd = new FormData();
  // Their HTTP sample posts ONE JSON object in "text"
  fd.append("text", JSON.stringify({ connect, start }));
  fd.append("audio", new Blob([wavBytes], { type: "audio/wav" }), "clip.wav");

  const r = await fetch(url, {
    method: "POST",
    headers: { "Request-Index": "0" },
    body: fd,
  });

  const raw = await r.text();
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {}
  if (!r.ok) {
    const e = new Error(raw);
    e.code = r.status;
    e.raw = raw;
    e.json = json;
    throw e;
  }
  return json || {};
}

/* ----------------- map SS → UI ----------------- */
/**
 * Normalizes multiple SpeechSuper result variants to our UI shape:
 * {
 *   transcript, accent,
 *   words: [{ w, score (0–1), phonemes: [{ ph, score }] }],
 *   overall (0–1), overallAccuracy (0–100)
 * }
 */
function mapSpeechsuperToUi(ss, refText, accent) {
  const root = ss?.result || ss?.text_score || ss || {};

  // Overall: many variants use 0–100 integer
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

  const wordsIn =
    root.words || root.word_score_list || root.wordList || root.word_scores || [];

  const words = [];
  for (const it of Array.isArray(wordsIn) ? wordsIn : []) {
    // word text
    const wText = (it.word ?? it.text ?? it.display ?? it.word_text ?? "").toString().trim();

    // word-level score: check typical places (scores.overall or accuracy/pronunciation)
    let wScore100 =
      Number(it?.scores?.overall ?? it?.overall ?? it?.pronunciation ?? it?.accuracy ?? 0) || 0;

    // phonemes: look for array under common keys
    const phSrc = it.phonemes || it.phone_score_list || it.phones || [];
    const phonemes = [];
    for (const p of Array.isArray(phSrc) ? phSrc : []) {
      const ph =
        (p.ph ??
          p.phoneme ??
          p.phone ??
          p.sound_like ??
          "").toString().trim();
      if (!ph) continue;

      // SpeechSuper often returns "pronunciation" (0–100) per phoneme
      let s100 =
        Number(
          p.pronunciation ??
            p.accuracy_score ??
            p.pronunciation_score ??
            p.score ??
            p.accuracy ??
            0
        ) || 0;

      const s01 = Math.max(0, Math.min(1, s100 > 1 ? s100 / 100 : s100));
      phonemes.push({
        ph,
        score: s01,
        phoneme: ph,
        accuracy: s01,
        accuracyScore: Math.round(s01 * 100),
      });
    }

    const w01 = Math.max(0, Math.min(1, wScore100 > 1 ? wScore100 / 100 : wScore100));
    words.push({
      w: wText || refText,
      score: w01,
      phonemes,
      word: wText || refText,
      accuracy: w01,
      accuracyScore: Math.round(w01 * 100),
    });
  }

  // If no overall provided, derive from words
  if (!overall100 && words.length) {
    overall100 = Math.round(
      (words.reduce((a, b) => a + (b.score || 0), 0) / words.length) * 100
    );
  }

  return {
    transcript: refText,
    accent,
    words,
    overall: Math.max(0, Math.min(1, overall100 / 100)),
    overallAccuracy: Math.round(overall100),
    snr: null,
    _debug: { resultKeys: Object.keys(root || {}) },
  };
}

/* ----------------- route ----------------- */
router.post("/analyze-speech", upload.single("audio"), async (req, res) => {
  try {
    const appKey = process.env.SPEECHSUPER_APP_KEY || "";
    const secretKey = process.env.SPEECHSUPER_SECRET_KEY || "";
    const host = (process.env.SPEECHSUPER_HOST || "https://api.speechsuper.com").replace(
      /\/$/,
      ""
    );
    if (!appKey || !secretKey)
      return res.status(500).json({ error: "SpeechSuper keys missing." });

    const refText = (req.body?.refText || "").trim();
    if (!refText) return res.status(400).json({ error: "Missing refText." });

    let rawBuf,
      mimeHint = "",
      accent = req.body?.accent || "en-US";
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
    if (!wavBytes?.length)
      return res.status(400).json({ error: "Audio conversion failed." });

    const coreType = chooseCore(refText);
    const userId = "accent-coach";

    console.log("[SS SEND sample]", {
      coreType,
      refText,
      wavBytes: wavBytes.length,
    });

    const ss = await postSpeechSuperExact({
      host,
      coreType,
      appKey,
      secretKey,
      userId,
      refText,
      wavBytes,
    });

    if (ss && (ss.errId || ss.error)) {
      return res
        .status(502)
        .json({ error: ss.error || "SpeechSuper error", errId: ss.errId ?? null, raw: ss });
    }

    const ui = mapSpeechsuperToUi(ss, refText, accent);
    return res.status(200).json(ui);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

export default router;
