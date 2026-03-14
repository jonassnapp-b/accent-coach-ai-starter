import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import os from "os";
import path from "path";

ffmpeg.setFfmpegPath(ffmpegPath);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;

    if (!key || !region) {
      return res.status(500).json({ error: "Missing Azure env vars" });
    }

    const { audioBase64, mime } = req.body || {};

    if (!audioBase64) {
      return res.status(400).json({ error: "Missing audioBase64" });
    }
const audioBuffer = Buffer.from(audioBase64, "base64");
console.log("[azure] entered wav conversion");
const inputPath = path.join(os.tmpdir(), `input-${Date.now()}.webm`);
const outputPath = path.join(os.tmpdir(), `output-${Date.now()}.wav`);

fs.writeFileSync(inputPath, audioBuffer);
await new Promise((resolve, reject) => {
  ffmpeg(inputPath)
    .audioFrequency(16000)
    .audioChannels(1)
    .format("wav")
    .save(outputPath)
    .on("end", resolve)
    .on("error", reject);
});

const wavBuffer = fs.readFileSync(outputPath);
console.log("[azure] wav bytes =", wavBuffer.length);
const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`;

const paHeader = Buffer.from(
  JSON.stringify({
    GradingSystem: "HundredMark",
    Granularity: "Phoneme",
    Dimension: "Comprehensive",
    EnableMiscue: false
  })
).toString("base64");

console.log("[azure] mime =", mime);
console.log("[azure] input bytes =", audioBuffer.length);

const azureRes = await fetch(url, {
  method: "POST",
  headers: {
    "Ocp-Apim-Subscription-Key": key,
    "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
    Accept: "application/json;text/xml",
    "Pronunciation-Assessment": paHeader,
  },
  body: wavBuffer,
});

const raw = await azureRes.text();
console.log("[azure] status =", azureRes.status);
console.log("[azure] raw =", raw);
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }

    if (!azureRes.ok) {
  console.log("[azure] non-200 status =", azureRes.status);
  console.log("[azure] non-200 raw =", raw);

  return res.status(azureRes.status).json({
    error: data?.error || data?.RecognitionStatus || raw || "Azure pronunciation failed",
    azureStatus: azureRes.status,
    azureRaw: raw,
    sentMime: mime || "audio/webm",
    audioBytes: audioBuffer.length,
  });
}

    const nbest = Array.isArray(data?.NBest) ? data.NBest[0] : null;
    const displayText =
      nbest?.Display ||
      data?.DisplayText ||
      "";

    const pa = nbest || {};

    const words = Array.isArray(nbest?.Words)
      ? nbest.Words.map((w) => ({
          word: w?.Word || "",
          accuracyScore: Number(w?.PronunciationAssessment?.AccuracyScore ?? 0),
          errorType: w?.PronunciationAssessment?.ErrorType || "",
        }))
      : [];

    return res.status(200).json({
      transcript: displayText,
      overallAccuracy: Number(pa?.AccuracyScore ?? 0),
      fluency: Number(pa?.FluencyScore ?? 0),
      completeness: Number(pa?.CompletenessScore ?? 0),
      pronunciation: Number(pa?.PronScore ?? 0),
      words,
      raw: data,
    });
  } catch (err) {
    return res.status(500).json({
      error: err?.message || "Azure pronunciation failed",
    });
  }
}