// api/_lib/tts.js
import OpenAI from "openai";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

if (ffmpegPath) {
  try {
    ffmpeg.setFfmpegPath(ffmpegPath);
  } catch (e) {
    console.error("[ffmpeg] setFfmpegPath failed:", e?.message || e);
  }
}

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function escSSML(s = "") {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pickAzureVoice(accent) {
  const a = (accent || "en_us").toLowerCase();

  // Prøv disse først (typisk mindre robot end Ryan/Jenny for mange)
  if (a === "en_br") return "en-GB-SoniaNeural";   // eller: en-GB-LibbyNeural / en-GB-RyanNeural
  return "en-US-AriaNeural";                       // eller: en-US-JennyNeural / en-US-GuyNeural
}


async function fetchAzureMp3({ text, accent, rate, voice: voiceOverride }) {
  const key = process.env.AZURE_SPEECH_KEY || "";
  const region = process.env.AZURE_SPEECH_REGION || "";
  if (!key || !region) return null;

  const voice = voiceOverride || pickAzureVoice(accent);

  // Azure prosody rate: brug % (1.0 => 0%, 0.98 => -2%, 1.08 => +8%)
  const ratePct = Math.round((Number(rate || 1) - 1) * 100);
  const rateStr = `${ratePct >= 0 ? "+" : ""}${ratePct}%`;

  // Brug accent til sprog-tag (så UK ikke står som en-US)
  const lang = (accent || "en_us").toLowerCase() === "en_br" ? "en-GB" : "en-US";

  // (valgfrit men ofte mindre robot): "express-as"
  // Hvis du ikke vil have det, så slet <mstts:express-as ...> wrapperen.
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" ` +
    `xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${lang}">` +
    `<voice name="${voice}">` +
    `<mstts:express-as style="friendly">` +
    `<prosody rate="${rateStr}">${escSSML(text)}</prosody>` +
    `</mstts:express-as>` +
    `</voice></speak>`;

  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-16khz-32kbitrate-mono-mp3",
      Accept: "audio/mpeg",
      "User-Agent": "accent-coach-api",
    },
    body: ssml,
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => "");
    throw new Error(`Azure TTS ${resp.status}: ${msg || "<empty>"}`);
  }

  const buf = Buffer.from(await resp.arrayBuffer());
  return { audioBuffer: buf, mime: "audio/mpeg" };
}

async function fetchOpenAiMp3({ text, accent, rate }) {
  if (!openai) return null;

  const a = (accent || "en_us").toLowerCase();
  const voice = a === "en_br" ? "sage" : "alloy";

const speed = Number(rate ?? 1.0) || 1.0;

const speech = await openai.audio.speech.create({
  model: "gpt-4o-mini-tts",
  voice,
  input: text,
  format: "mp3",
  speed,
  instructions:
    a === "en_br"
      ? "Speak natural British English. Warm and human, not robotic."
      : "Speak natural American English. Warm and human, not robotic.",
});


  const buf = Buffer.from(await speech.arrayBuffer());
  return { audioBuffer: buf, mime: "audio/mpeg" };
}

// Convert any audio buffer (mp3/wav/whatever) -> WAV PCM16 mono 16k
async function toWavPcm16Mono16k(inputBuf, inputExt = ".mp3") {
  const id = randomUUID().replace(/-/g, "");
  const tmpDir = os.tmpdir();

  const inPath = path.join(tmpDir, `ac_tts_in_${id}${inputExt}`);
  const outPath = path.join(tmpDir, `ac_tts_out_${id}.wav`);

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

export async function getTtsAudio({ text, accent = "en_us", rate = 1.0, voice = "" }) {
  const t = String(text || "").trim();
  if (!t) throw new Error("Missing text");

// 1) OpenAI first
let mp3 = null;
try {
  mp3 = await fetchOpenAiMp3({ text: t, accent, rate });
} catch (e) {
  console.error("[tts] OpenAI failed:", e?.message || e);
}

// 2) Azure fallback (if keys exist & valid)
if (!mp3) {
  try {
    mp3 = await fetchAzureMp3({ text: t, accent, rate, voice });
  } catch (e) {
    console.error("[tts] Azure failed:", e?.message || e);
  }
}


  if (!mp3?.audioBuffer) {
    throw new Error("No TTS provider available (Azure/OpenAI both failed).");
  }

  // 3) Always return WAV 16k PCM mono (SpeechSuper-friendly)
  const wav = await toWavPcm16Mono16k(mp3.audioBuffer, ".mp3");
  return { audioBuffer: wav, mime: "audio/wav" };
}
