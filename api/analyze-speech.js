// api/analyze-speech.js — Azure STT (fallback for transcript) + SpeechSuper (scripted, strict)
import express from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import { Readable } from "stream";
import FormData from "form-data";
import ffmpegPath from "ffmpeg-static";

if (ffmpegPath) { try { ffmpeg.setFfmpegPath(ffmpegPath); } catch {} }

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
export const config = { api: { bodyParser: false } };

/* -------- utils -------- */
function dataURLtoBuffer(dataURL) {
  const base64 = dataURL.includes(",") ? dataURL.split(",")[1] : dataURL;
  return Buffer.from(base64, "base64");
}
function bufferToStream(buf) {
  const s = new Readable();
  s._read = () => {};
  s.push(buf); s.push(null);
  return s;
}
async function toWavPcm16Mono16k(inputBuf, inputMimeHint = "") {
  return new Promise((resolve, reject) => {
    const inStream = bufferToStream(inputBuf);
    const chunks = [];
    const cmd = ffmpeg(inStream);
    if (/(aac|m4a|mp4)/i.test(inputMimeHint)) cmd.inputFormat("aac");
    cmd.audioChannels(1).audioFrequency(16000).audioCodec("pcm_s16le").format("wav")
      .on("error", (err) => reject(new Error(String(err))))
      .on("end", () => { try { resolve(Buffer.concat(chunks)); } catch (e) { reject(e); } });
    cmd.pipe().on("data", (c) => chunks.push(c)).on("error", (err) => reject(new Error(String(err))));
  });
}

/* -------- Azure STT (for transcript fallback) -------- */
const AZURE_CT = "audio/wav; codecs=audio/pcm; samplerate=16000; bitspersample=16; channels=1";
async function azureSTT({ region, key, locale, wavBytes }) {
  const url =
    `https://${region}.stt.speech.microsoft.com/` +
    `speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(locale)}&format=detailed`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": AZURE_CT, Accept: "application/json" },
    body: wavBytes,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json?.error?.message || json?.Message || `Azure STT ${r.status}`);
  const nbest = Array.isArray(json?.NBest) ? json.NBest[0] : undefined;
  const transcript = (nbest?.Display ?? json?.DisplayText ?? nbest?.Lexical ?? "").toString().trim();
  return { transcript, raw: json };
}

/* -------- SpeechSuper (scripted) -------- */
async function speechsuperScripted({ appKey, coreType, refText, wavBytes }) {
  const url = `https://api.speechsuper.com/${coreType}`;
  const textPayload = {
    appKey, coreType, refText,
    rank: 100, audioFormat: "wav", sampleRate: 16000, userId: "fluentup-dev",
  };
  const fd = new FormData();
  fd.append("text", JSON.stringify(textPayload));
  fd.append("audio", Buffer.from(wavBytes), { filename: "clip.wav" });

  const r = await fetch(url, { method: "POST", headers: { "Request-Index": "0", ...fd.getHeaders?.() }, body: fd });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json?.message || json?.error || `SpeechSuper HTTP ${r.status}`);
  return json;
}

/** Map SpeechSuper → your UI shape */
function mapSpeechsuperToUi(sa, refText, accent) {
  const root = sa?.result || sa?.text_score || sa || {};
  const list = root.word_score_list || root.words || root.wordList || root.word_scores || [];
  const words = [];

  for (const it of (Array.isArray(list) ? list : [])) {
    const wText = (it.word ?? it.text ?? it.display ?? "").toString().trim();
    if (!wText) continue;
    let wScore = Number(it.accuracy_score ?? it.pronunciation_score ?? it.score ?? 0);
    if (wScore > 1) wScore /= 100;

    const phSrc = it.phone_score_list || it.phones || it.phonemes || [];
    const phonemes = [];
    for (const p of (Array.isArray(phSrc) ? phSrc : [])) {
      const ph = (p.phone ?? p.phoneme ?? p.ph ?? "").toString().trim();
      if (!ph) continue;
      let s = Number(p.accuracy_score ?? p.pronunciation_score ?? p.score ?? 0);
      if (s > 1) s /= 100;
      phonemes.push({ ph, score: s, phoneme: ph, accuracy: s, accuracyScore: Math.round(s * 100) });
    }

    words.push({ w: wText, score: wScore, phonemes, word: wText, accuracy: wScore, accuracyScore: Math.round(wScore * 100) });
  }

  let overall100 =
    Number(root.pronunciation_score ?? root.accuracy_score ?? root.overall_score ??
           sa?.pronunciation_score ?? sa?.accuracy_score ?? 0) || 0;

  if (!overall100 && words.length) {
    overall100 = Math.round((words.reduce((a,b)=>a+(b.score||0),0) / words.length) * 100);
  }

 function mapSpeechsuperToUi(sa, refText, accent) {
  // ...
  return {
    transcript: refText,
    accent, // ← brug det accent som brugeren faktisk valgte
    words,
    overall: overall100/100,
    overallAccuracy: overall100,
    snr: null
  };
}

}

/* -------- Route -------- */
router.post("/analyze-speech", upload.single("audio"), async (req, res) => {
  try {
    // read audio
    let rawBuf, mimeHint = "", accent = req.body?.accent;
    if (req.file?.buffer) { rawBuf = req.file.buffer; mimeHint = req.file.mimetype || ""; }
    else if (req.is("application/json")) {
  // Accept both full dataURL in "audio" and raw base64 in "audioBase64"
  const { audio, audioBase64, mime, accent: a2, refText: r2 } = req.body ?? {};

  let dataUrl = "";
  if (audio && typeof audio === "string") {
    dataUrl = audio; // already a data:...;base64,XXXX
  } else if (audioBase64 && typeof audioBase64 === "string") {
    const guessed = mime || "audio/wav";
    dataUrl = `data:${guessed};base64,${audioBase64}`;
  }

  if (dataUrl) {
    rawBuf = dataURLtoBuffer(dataUrl);
    mimeHint = mime || "";
  }
  if (a2) accent = a2;
  if (r2) refText = r2;
}

    if (!rawBuf) return res.status(400).json({ error: "Missing audio" });

    const short = { us: "en-US", uk: "en-GB", au: "en-AU", ca: "en-CA" };
    const locale = (accent && (accent.includes("-") ? accent : short[accent])) || "en-US";

    const AZ_REGION = process.env.AZURE_SPEECH_REGION;
    const AZ_KEY    = process.env.AZURE_SPEECH_KEY;

    // normalize audio
    const wavBytes = await toWavPcm16Mono16k(rawBuf, mimeHint);
    if (!wavBytes?.length) return res.status(400).json({ error: "Audio conversion failed" });

    // target text (prefer provided refText; otherwise fall back to STT)
    let refText = (req.body?.refText || "").toString().trim();
    if (!refText) {
      if (!AZ_REGION || !AZ_KEY) return res.status(500).json({ error: "Azure STT env vars missing (needed for transcript fallback)" });
      const stt = await azureSTT({ region: AZ_REGION, key: AZ_KEY, locale, wavBytes });
      if (!stt.transcript) return res.status(424).json({ error: "No transcript recognized; cannot score.", accent: locale });
      refText = stt.transcript;
    }

    // SpeechSuper scripted scoring
    const appKey = process.env.SPEECHSUPER_APP_KEY;
    if (!appKey) return res.status(500).json({ error: "SPEECHSUPER_APP_KEY missing" });

    const ssJson = await speechsuperScripted({ appKey, coreType: "sent.eval.promax", refText, wavBytes });

    // map → UI
    const ui = mapSpeechsuperToUi(ssJson, refText, locale);
    return res.status(200).json(ui);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

export default router;
