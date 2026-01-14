// dev-server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

// Single OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ----------------------------------------------------------------
   Helpers
----------------------------------------------------------------- */

// Accent -> voices (Azure + OpenAI-fallback)
function pickVoices(accent) {
  const a = (accent || "en_us").toLowerCase();
  return {
    azure: a === "en_br" ? "en-GB-RyanNeural" : "en-US-JennyNeural",
    openai: a === "en_br" ? "sage" : "alloy",
    label: a === "en_br" ? "en-GB" : "en-US",
  };
}

// SSML escape
function escSSML(s = "") {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Tiny text utils
function normalize(s = "") {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/[“”"']/g, "").trim();
}
function tokens(s) {
  return normalize(s).split(" ").filter(Boolean);
}
function bigramSet(toks) {
  const set = new Set();
  for (let i = 0; i < toks.length - 1; i++) set.add(`${toks[i]} ${toks[i + 1]}`);
  return set;
}
function diceSim(a, b) {
  const ta = tokens(a), tb = tokens(b);
  if (ta.length < 2 || tb.length < 2) return 0;
  const A = bigramSet(ta), B = bigramSet(tb);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return (2 * inter) / (A.size + B.size || 1);
}
function levRatio(a, b) {
  a = normalize(a); b = normalize(b);
  const m = a.length, n = b.length;
  if (!m && !n) return 1;
  const dp = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = tmp;
    }
  }
  const dist = dp[n];
  return 1 - dist / (Math.max(m, n) || 1);
}
function tooSimilar(a, b) {
  return diceSim(a, b) >= 0.55 || levRatio(a, b) >= 0.82;
}
function keyOf(level, accent) {
  return `${(level || "easy").toLowerCase()}|${(accent || "en_us").toLowerCase()}`;
}

// Session-scoped historik (in-memory)
const RECENT = new Map();
const MAX_RECENT = 50;
function remember(key, text) {
  const arr = RECENT.get(key) || [];
  arr.unshift(text);
  if (arr.length > MAX_RECENT) arr.length = MAX_RECENT;
  RECENT.set(key, arr);
}
function isNewEnough(key, text) {
  const recent = RECENT.get(key) || [];
  const norm = normalize(text);
  for (const r of recent) {
    if (normalize(r) === norm) return false;
    if (tooSimilar(r, text)) return false;
  }
  return true;
}

/* ---------------- basale længde-constraints ---------------- */
function constraintsFor(level) {
  switch ((level || "easy").toLowerCase()) {
    case "easy":
      return { minWords: 5, maxWords: 8, notes: "simple everyday English (CEFR A1–A2). No clauses." };
    case "medium":
      return { minWords: 8, maxWords: 12, notes: "natural phrasing (A2–B1); allow one phrasal/prepositional phrase." };
    case "hard":
      return { minWords: 12, maxWords: 18, notes: "include one subordinate clause or mild idiom (B1–B2)." };
    default:
      return { minWords: 8, maxWords: 12, notes: "" };
  }
}
function validateSentence(s, c) {
  const ws = tokens(s);
  if (ws.length < c.minWords || ws.length > c.maxWords) return false;
  if (/[“”"']/.test(s)) return false;
  return true;
}

/* ---------------- udtale-features & sværhedsgrad ---------------- */
const FEATURE_REGEX = {
  voiced_th: /\b(th[eiouay])/i,
  voiceless_th: /\b(th)(?=[^aeiou])/i,
  consonant_cluster: /\b(scr|spl|spr|str|thr|sch|tch|dge|gnr)/i,
  final_consonant: /\b\w+(t|d|k|g|p|b)\b/i,
  r_colored_vowel: /(er|ir|ur|or|ar)\b|r[aeiou]/i,
  schwa: /\b(a|the|of|to|for|from|about|around)\b/i,
  diphthong: /(ai|ay|ei|ey|oy|oi|ow|ou)\b/i,
  silent_r_uk: /\b\w+re\b/i,
  t_flap_us: /\b\w+t\w+\b/i,
};
function countFeatures(text) {
  const hits = new Set();
  for (const [k, rx] of Object.entries(FEATURE_REGEX)) {
    if (rx.test(text)) hits.add(k);
  }
  return hits;
}
function difficultySpec(level) {
  const base = constraintsFor(level);
  switch ((level || "easy").toLowerCase()) {
    case "easy":
      return { ...base, targetFeatureCount: 1, allowedFeatures: ["voiceless_th","final_consonant","diphthong","schwa"] };
    case "medium":
      return { ...base, targetFeatureCount: 2, allowedFeatures: ["voiced_th","voiceless_th","consonant_cluster","r_colored_vowel","diphthong","schwa"] };
    case "hard":
      return { ...base, targetFeatureCount: 3, allowedFeatures: ["voiced_th","voiceless_th","consonant_cluster","r_colored_vowel","diphthong","schwa","silent_r_uk","t_flap_us"] };
    default:
      return { ...base, targetFeatureCount: 2, allowedFeatures: Object.keys(FEATURE_REGEX) };
  }
}
function featureNames(list) {
  return list.map(n => ({
    voiced_th: "voiced /ð/ (this, those)",
    voiceless_th: "voiceless /θ/ (think, thin)",
    consonant_cluster: "consonant cluster (spr/str/thr/tch…)",
    final_consonant: "final stop consonant (t/d/k/g/p/b at word end)",
    r_colored_vowel: "r-colored vowel (car, bird, nurse, north, near)",
    schwa: "weak syllable/schwa function word",
    diphthong: "diphthong (ai/ei/oi/ow/ou)",
    silent_r_uk: "non-rhotic spelling typical for UK (indicative)",
    t_flap_us: "American t-flap context (city, better; indicative)",
  }[n] || n));
}

/* ----------------------------------------------------------------
   Logging & ping
----------------------------------------------------------------- */

app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
app.get("/api/ping", (_req, res) => res.json({ ok: true, now: Date.now() }));

/* ----------------------------------------------------------------
   🔊 TTS (Azure first, OpenAI fallback)
   GET /api/tts?text=...&accent=en_us|en_br
----------------------------------------------------------------- */
app.get("/api/tts", async (req, res) => {
  const text = `${req.query.text || ""}`.trim();
  const accent = (req.query.accent || "en_us").toLowerCase();
  if (!text) return res.status(400).json({ error: "Missing text" });

  const { azure, openai: openaiVoice } = pickVoices(accent);
  const { AZURE_SPEECH_KEY, AZURE_SPEECH_REGION } = process.env;

  if (AZURE_SPEECH_KEY && AZURE_SPEECH_REGION) {
    try {
      const ssml = `<speak version="1.0" xml:lang="en-US"><voice name="${azure}">${escSSML(text)}</voice></speak>`;
      const url = `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
      console.log(`[TTS Azure] voice=${azure} region=${AZURE_SPEECH_REGION}`);

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-16khz-32kbitrate-mono-mp3",
          Accept: "audio/mpeg",
          "User-Agent": "accent-coach-dev-server",
        },
        body: ssml,
      });
      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(`Azure TTS ${resp.status}: ${msg || "<empty>"}`);
      }
      const buf = Buffer.from(await resp.arrayBuffer());
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      return res.send(buf);
    } catch (err) {
      console.error("Azure TTS error:", err?.message || err);
      // fall through to OpenAI
    }
  }

  try {
    console.log(`[TTS OpenAI] voice=${openaiVoice}`);
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: openaiVoice,
      input: text,
      format: "mp3",
    });
    const buffer = Buffer.from(await speech.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.send(buffer);
  } catch (err) {
    console.error("OpenAI TTS error:", err?.message || err);
    return res.status(500).json({ error: err?.message || "TTS failed" });
  }
});

/* ----------------------------------------------------------------
   🧠 Diverse, moderated, pronunciation-aware sentence generation
   POST /api/generate-sentence  { level, accent }
----------------------------------------------------------------- */
app.post("/api/generate-sentence", async (req, res) => {
  try {
    const level = (req.body?.level || "easy").toLowerCase();
    const accent = (req.body?.accent || "en_us").toLowerCase();
    const voices = pickVoices(accent);
    const c = difficultySpec(level);
    const K = keyOf(level, accent);

    const sys = `You output ONLY JSON with shape: {"items":[{"text":"...", "features":["..."]}, ...]}.
Each "features" value must be chosen from this list: ${featureNames(c.allowedFeatures).join(", ")}.
Keep sentences classroom-safe (no names, no quotes, no sensitive topics).
Word count ${c.minWords}-${c.maxWords}. Vary topic & grammar (time phrases, clauses, prepositional phrases, phrasal verbs).`;
    const usr = `Give 6 DIFFERENT English sentences that actually contain ${c.targetFeatureCount}+ of the allowed pronunciation features.`;

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.95,
      top_p: 0.95,
      presence_penalty: 0.8,
      frequency_penalty: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: usr },
      ],
    });

    let items = [];
    try {
      const parsed = JSON.parse(r.choices?.[0]?.message?.content || "{}");
      items = Array.isArray(parsed?.items) ? parsed.items : [];
    } catch { items = []; }

    const candidates = items
      .map(x => (typeof x?.text === "string" ? x.text.trim() : ""))
      .filter(Boolean)
      .slice(0, 12);

    let picked = "";
    for (const cand of candidates) {
      if (!validateSentence(cand, c)) continue;

      const mod = await openai.moderations.create({
        model: "omni-moderation-latest",
        input: cand,
      });
      if (mod.results?.[0]?.flagged) continue;

      const hitCount = [...countFeatures(cand)].filter(h => c.allowedFeatures.includes(h)).length;
      if (hitCount < c.targetFeatureCount) continue;
      if (!isNewEnough(K, cand)) continue;

      picked = cand;
      break;
    }

    if (!picked) {
      for (let i = 0; i < 3 && !picked; i++) {
        const rr = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.9,
          messages: [
            { role: "system", content: `One safe English sentence, ${c.minWords}-${c.maxWords} words, include ${c.targetFeatureCount}+ of: ${featureNames(c.allowedFeatures).join(", ")}` },
            { role: "user", content: "Return only the sentence, no quotes." },
          ],
        });
        const cand = rr.choices?.[0]?.message?.content?.trim() || "";
        if (!cand || !validateSentence(cand, c)) continue;
        const mod2 = await openai.moderations.create({ model: "omni-moderation-latest", input: cand });
        if (mod2.results?.[0]?.flagged) continue;
        const hitCount = [...countFeatures(cand)].filter(h => c.allowedFeatures.includes(h)).length;
        if (hitCount < c.targetFeatureCount) continue;
        if (!isNewEnough(K, cand)) continue;
        picked = cand;
      }
    }

    if (!picked) picked = "Neighbors organized a clean-up day at the small riverbank.";
    remember(K, picked);

    res.json({ text: picked, voice: voices.label });
  } catch (err) {
    console.error("generate-sentence error:", err);
    res.status(500).json({ error: err?.message || "generation failed" });
  }
});
/* ----------------------------------------------------------------
   💬 Conversation Trainer endpoints
   - POST /api/conv/start      { level, accent, topic? }
   - POST /api/conv/next       { level, accent, history: [{role:'partner'|'user', text:string}], topic? }
----------------------------------------------------------------- */

// lille util til at bygge prompt ud fra sværhedsgrad
function convConstraints(level) {
  switch ((level || 'easy').toLowerCase()) {
    case 'easy':   return 'Short, clear, everyday phrasing (A1–A2). 6–12 words.';
    case 'medium': return 'Natural phrasing with a time phrase or phrasal verb (A2–B1). 8–16 words.';
    case 'hard':   return 'More complex clause or contrast (B1–B2). 12–20 words.';
    default:       return '8–16 words.';
  }
}

// Moderér sikkert svar
async function safeReply(text) {
  const mod = await openai.moderations.create({
    model: 'omni-moderation-latest',
    input: text
  });
  if (mod?.results?.[0]?.flagged) return null;
  return text.trim();
}

// Generér partner-ytring
async function generatePartnerUtterance({ level='easy', topic='daily life' }) {
  const constraints = convConstraints(level);
  const r = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.8,
    messages: [
      {
        role: 'system',
        content:
          `You are a friendly conversation partner. Keep it classroom-appropriate, no names, no quotes, no politics/adult/sensitive content.`
      },
      {
        role: 'user',
        content:
          `Topic: ${topic}. Produce ONE utterance the learner should respond to. ${constraints}`
      }
    ]
  });
  const raw = r.choices?.[0]?.message?.content || '';
  return safeReply(raw) || 'How was your day today?';
}

/**
 * Start ny samtale
 * body: { level, accent, topic? }
 * return: { partnerText, voice }
 */
app.post('/api/conv/start', async (req, res) => {
  try {
    const level  = (req.body?.level  || 'easy').toLowerCase();
    const accent = (req.body?.accent || 'en_us').toLowerCase();
    const topic  = (req.body?.topic  || 'daily life');
    const voices = pickVoices(accent);

    const partnerText = await generatePartnerUtterance({ level, topic });
    return res.json({ partnerText, voice: voices.label });
  } catch (e) {
    console.error('conv/start error:', e);
    res.status(500).json({ error: e?.message || 'conv start failed' });
  }
});

/**
 * Næste tur i samtalen
 * body: { level, accent, history:[{role:'partner'|'user', text}], topic? }
 * return: { partnerText, voice }
 */
app.post('/api/conv/next', async (req, res) => {
  try {
    const level   = (req.body?.level  || 'easy').toLowerCase();
    const accent  = (req.body?.accent || 'en_us').toLowerCase();
    const topic   = (req.body?.topic  || 'daily life');
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const voices  = pickVoices(accent);

    // byg kort kontekst (max 6 seneste)
    const last = history.slice(-6).map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');

    const constraints = convConstraints(level);
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.8,
      messages: [
        {
          role: 'system',
          content:
            `You are a friendly conversation partner for English learners. Keep replies short, clear, and classroom-safe.`
        },
        {
          role: 'user',
          content:
`Topic: ${topic}
Recent turns:
${last || '(no prior turns)'}
Reply with ONE new partner turn the learner should answer. ${constraints}`
        }
      ]
    });

    const raw = r.choices?.[0]?.message?.content || '';
    const partnerText = await safeReply(raw) || 'Could you tell me more about that?';
    return res.json({ partnerText, voice: voices.label });
  } catch (e) {
    console.error('conv/next error:', e);
    res.status(500).json({ error: e?.message || 'conv next failed' });
  }
});

/* ----------------------------------------------------------------
   Existing handlers
----------------------------------------------------------------- */
const analyzeSpeech = (await import("./api/analyze-speech.js")).default;
const leaderboard = (await import("./api/leaderboard.js")).default;

app.use("/api/analyze-speech", analyzeSpeech);
app.get("/api/leaderboard", leaderboard);
app.post("/api/leaderboard", leaderboard);

// 404
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.listen(3000, "0.0.0.0", () => {
  console.log("✅ API ready on http://localhost:3000");
  console.log("  GET  /api/ping");
  console.log("  GET  /api/tts?text=Hello&accent=en_us|en_br");
  console.log("  POST /api/generate-sentence");
  console.log("  POST /api/analyze-speech");
  console.log("  GET/POST /api/leaderboard");
});
