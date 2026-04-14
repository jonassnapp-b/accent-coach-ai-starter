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

  const map = {
    en_us: "en-US-AriaNeural",
    en_br: "en-GB-LibbyNeural",
    zh_cn: "zh-CN-XiaoxiaoNeural",
    ja_jp: "ja-JP-NanamiNeural",
    ko_kr: "ko-KR-SunHiNeural",
    es_es: "es-ES-ElviraNeural",
    de_de: "de-DE-KatjaNeural",
    fr_fr: "fr-FR-DeniseNeural",
    ru_ru: "ru-RU-SvetlanaNeural",
    ar_sa: "ar-SA-ZariyahNeural",
  };

  return map[a] || "en-US-AriaNeural";
}
function pickOpenAiVoice(accent) {
  const a = (accent || "en_us").toLowerCase();

  if (a === "en_br") return "cedar";
  return "marin";
}
function pickAzureLang(accent) {
  const a = (accent || "en_us").toLowerCase();

  const map = {
    en_us: "en-US",
    en_br: "en-GB",
    zh_cn: "zh-CN",
    ja_jp: "ja-JP",
    ko_kr: "ko-KR",
    es_es: "es-ES",
    de_de: "de-DE",
    fr_fr: "fr-FR",
    ru_ru: "ru-RU",
    ar_sa: "ar-SA",
  };

  return map[a] || "en-US";
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
  const lang = pickAzureLang(accent);

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

async function fetchOpenAiMp3({ text, accent, rate, voice }) {
  if (!openai) return null;

  const a = (accent || "en_us").toLowerCase();
  const speed = Number(rate ?? 1.0) || 1.0;
  const chosenVoice = String(voice || "").trim() || pickOpenAiVoice(a);

const instructionMap = {
  en_us: "Speak natural American English. Warm, human, and conversational. Never sound robotic.",
  en_br: "Speak natural British English. Warm, human, and conversational. Never sound robotic.",
  zh_cn: "Speak natural Mandarin Chinese. Warm, human, and conversational. Never sound robotic.",
  ja_jp: "Speak natural Japanese. Warm, human, and conversational. Never sound robotic.",
  ko_kr: "Speak natural Korean. Warm, human, and conversational. Never sound robotic.",
  es_es: "Speak natural Spanish from Spain. Warm, human, and conversational. Never sound robotic.",
  de_de: "Speak natural German. Warm, human, and conversational. Never sound robotic.",
  fr_fr: "Speak natural French. Warm, human, and conversational. Never sound robotic.",
  ru_ru: "Speak natural Russian. Warm, human, and conversational. Never sound robotic.",
  ar_sa: "Speak natural Arabic. Warm, human, and conversational. Never sound robotic.",
};

const instructions =
  instructionMap[a] ||
  "Speak naturally in the requested language. Warm, human, and conversational. Never sound robotic.";

  const speech = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: chosenVoice,
    input: text,
    format: "mp3",
    speed,
    instructions,
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
  .audioFilters("highpass=f=150,lowpass=f=7600,equalizer=f=2200:t=q:w=1.0:g=2,equalizer=f=3400:t=q:w=1.1:g=4,equalizer=f=5000:t=q:w=1.0:g=2,loudnorm=I=-15:TP=-2:LRA=7")
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

  const a = (accent || "en_us").toLowerCase();

  let mp3 = null;

  if (a === "en_us") {
    try {
      mp3 = await fetchOpenAiMp3({ text: t, accent: a, rate, voice });
    } catch (e) {
      console.error("[tts] OpenAI failed:", e?.message || e);
    }

    if (!mp3) {
      try {
        mp3 = await fetchAzureMp3({ text: t, accent: a, rate, voice });
      } catch (e) {
        console.error("[tts] Azure failed:", e?.message || e);
      }
    }
  } else {
    try {
      mp3 = await fetchAzureMp3({ text: t, accent: a, rate, voice });
    } catch (e) {
      console.error("[tts] Azure failed:", e?.message || e);
    }

    if (!mp3) {
      try {
        mp3 = await fetchOpenAiMp3({ text: t, accent: a, rate, voice });
      } catch (e) {
        console.error("[tts] OpenAI failed:", e?.message || e);
      }
    }
  }

  if (!mp3?.audioBuffer) {
    throw new Error("No TTS provider available (Azure/OpenAI both failed).");
  }

  const wav = await toWavPcm16Mono16k(mp3.audioBuffer, ".mp3");
  return { audioBuffer: wav, mime: "audio/wav" };
}

