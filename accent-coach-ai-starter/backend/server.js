// backend/server.js
import express from "express";
import multer from "multer";
import cors from "cors";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.options("*", cors());

/* -----------------------------
   MOCK STORAGE (no DB yet)
------------------------------*/
const attempts = []; // {id, userId, phrase, score, words:[{word,score}], ts}
const users = [{ id: "demo", name: "Demo User" }]; // placeholder
const leaderboard = [
  { user: "Alex", score: 92 },
  { user: "Sam", score: 89 },
  { user: "Pat", score: 85 },
];

/* -----------------------------
   HELPERS (mock logic)
------------------------------*/
function mockScore(targetPhrase = "") {
  const words = (targetPhrase || "")
    .toString()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ({ word: w, score: Math.round(60 + Math.random() * 40) }));

  const overall = words.length
    ? Math.round(words.reduce((s, w) => s + (w.score ?? 100), 0) / words.length)
    : Math.round(72 + Math.random() * 18);

  return { overall, words };
}

function buildWordFeedback(targetPhrase = "", words = []) {
  const low = words.filter((w) => (w.score ?? 100) < 80);

  const focusAreas = new Set();
  const tips = [];

  const hasTH = (w) => /\b(th(e|is|at|ose|ese)|think|thought|through)\b/i.test(w);
  const likelyR = (w) => /r/i.test(w);
  const finalConsonant = (w) => /[bdfgklmnprsStTz]$/i.test(w);
  const likelyVW = (w) => /\b(w|v)/i.test(w);

  for (const item of low) {
    const word = (item.word || "").toString();

    if (hasTH(word)) {
      focusAreas.add("TH sound (/θ/ /ð/)");
      tips.push({
        word,
        note:
          "Soft TH: place the tongue lightly on the teeth (not like D/Z).",
        drill: 'Say “the / this / those” slowly; let air flow out.',
      });
    } else if (finalConsonant(word)) {
      focusAreas.add("Final consonants");
      tips.push({
        word,
        note: "Pronounce the final consonant clearly (esp. t/d/s).",
        drill: `Say “${word}” 3x with extra focus on the ending.`,
      });
    } else if (likelyR(word)) {
      focusAreas.add("American R");
      tips.push({
        word,
        note: "Tongue slightly raised & pulled back (not rolled).",
        drill: `Exaggerate the ‘r’ in “${word}” three times.`,
      });
    } else if (likelyVW(word)) {
      focusAreas.add("V vs W");
      tips.push({
        word,
        note: "V: lower lip on teeth. W: rounded lips with airflow.",
        drill: 'Minimal pairs: “wine/vine”, “west/vest”.',
      });
    } else {
      tips.push({
        word,
        note: "Slow down and stretch the vowel slightly.",
        drill: `Say “${word}” syllable-by-syllable, slowly (3x).`,
      });
    }
  }

  const avg = words.length
    ? Math.round(words.reduce((s, w) => s + (w.score ?? 100), 0) / words.length)
    : 0;

  let summary;
  if (!words.length) summary = "No words detected.";
  else if (avg >= 90) summary = `Strong overall (~${avg}/100). Polish details.`;
  else if (avg >= 80) summary = `Good base (~${avg}/100). Focus a few patterns.`;
  else summary = `Big improvement potential (~${avg}/100). Pick 1–2 sounds.`;

  return {
    summary,
    focusAreas: [...focusAreas],
    wordTips: tips.slice(0, 12),
    nextSteps: [
      "Practice slowly (0.75x speed), exaggerate difficult sounds.",
      "Record again & see if the focus areas improve.",
    ],
  };
}

function mockPhonemeFeedback(phrase = "", words = []) {
  // Fake phoneme-level notes – swap with real forced alignment later
  const phonemes = [
    { symbol: "/θ/", tip: "Place tongue at teeth; let air pass softly (TH)." },
    { symbol: "/ð/", tip: "Voiced TH: same tongue position, add voice." },
    { symbol: "/ɹ/", tip: "American R: tongue pulled back, no roll." },
    { symbol: "/s/", tip: "Focus on a clean hiss; avoid 'sh' coloration." },
    { symbol: "/t/", tip: "Release the final T clearly but lightly." },
  ];
  const low = words.filter((w) => (w.score ?? 100) < 80);
  return {
    phrase,
    phonemes: phonemes.slice(0, Math.min(3, low.length || 2)),
    tip:
      "Work on 1–2 sounds per week. Practice minimal pairs and slow, exaggerated reps.",
  };
}

/* -----------------------------
   ROUTES
------------------------------*/

// Health check
app.get("/", (_req, res) => res.send("Accent Coach AI backend running"));

// 1) Score audio (existing)
app.post("/api/score", upload.single("audio"), (req, res) => {
  try {
    const { targetPhrase = "", targetAccent = "" } = req.body || {};
    const result = mockScore(targetPhrase);
    result.feedback = buildWordFeedback(targetPhrase, result.words || []);
    res.json(result);
  } catch (err) {
    console.error("API /api/score error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 2) Smart feedback tab (word + phoneme hints)
app.get("/api/feedback", (req, res) => {
  try {
    const phrase = (req.query.phrase || "").toString();
    const scored = mockScore(phrase);
    const wordFeedback = buildWordFeedback(phrase, scored.words || []);
    const phoneme = mockPhonemeFeedback(phrase, scored.words || []);
    res.json({ score: scored, wordFeedback, phoneme });
  } catch (e) {
    console.error("API /api/feedback error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// 3) Save attempt (Progress)
app.post("/api/attempt", (req, res) => {
  try {
    const { userId = "demo", phrase = "", score = 0, words = [] } = req.body || {};
    const item = {
      id: String(Date.now()),
      userId,
      phrase,
      score: Number(score) || 0,
      words: Array.isArray(words) ? words : [],
      ts: Date.now(),
    };
    attempts.push(item);
    res.json({ ok: true, attempt: item });
  } catch (e) {
    console.error("API /api/attempt error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// 4) Progress: history, streaks, plan
app.get("/api/progress", (req, res) => {
  try {
    const userId = (req.query.userId || "demo").toString();
    const mine = attempts.filter((a) => a.userId === userId).sort((a,b)=>b.ts-a.ts);

    // Simple 7-day streak mock
    const ONE_DAY = 24 * 60 * 60 * 1000;
    let streak = 0;
    let dayCursor = new Date();
    for (let i = 0; i < 7; i++) {
      const start = +new Date(dayCursor.getFullYear(), dayCursor.getMonth(), dayCursor.getDate());
      const end = start + ONE_DAY;
      const didPractice = mine.some((a) => a.ts >= start && a.ts < end);
      if (didPractice) streak++;
      else break;
      dayCursor = new Date(start - ONE_DAY);
    }

    // Simple learning plan: pick 2 weakest words across last 5 attempts
    const last5 = mine.slice(0, 5);
    const wordScores = {};
    last5.forEach((a) => a.words?.forEach((w) => {
      if (!wordScores[w.word]) wordScores[w.word] = [];
      wordScores[w.word].push(w.score ?? 100);
    }));
    const avgEntry = Object.entries(wordScores).map(([word, arr]) => ({
      word,
      avg: Math.round(arr.reduce((s, n) => s + n, 0) / arr.length),
    }));
    const weakest = avgEntry.sort((a,b)=>a.avg-b.avg).slice(0, 2).map(x=>x.word);

    res.json({
      history: mine,
      streak,
      plan: {
        focus: weakest.length ? weakest : ["th", "final t"],
        actions: [
          "Practice 10 minutes/day with slow exaggerated reps.",
          "Record and compare your scores.",
          "Revisit difficult words from last attempts.",
        ],
      },
      badges: [
        ...(streak >= 3 ? [{ id: "streak3", label: "3-day streak" }] : []),
        ...(streak >= 7 ? [{ id: "streak7", label: "7-day streak" }] : []),
      ],
    });
  } catch (e) {
    console.error("API /api/progress error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// 5) Leaderboard (Social)
app.get("/api/leaderboard", (_req, res) => {
  res.json({ leaderboard });
});

// 6) Share clip – mock endpoint (returns a fake URL)
app.post("/api/share", (req, res) => {
  try {
    const { userId = "demo", attemptId } = req.body || {};
    const url = `https://example.com/clip/${attemptId || Date.now()}`;
    res.json({ ok: true, url, message: "Mock share URL generated." });
  } catch (e) {
    console.error("API /api/share error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// 7) AI Coach chat – mock reply (replace with OpenAI later)
app.post("/api/chat", (req, res) => {
  try {
    const { message = "", context = {} } = req.body || {};
    const reply =
      "Try slowing down the TH in words like 'the' and 'this'. Touch your tongue to your teeth and let air flow. Then repeat the whole sentence at 0.75x speed.";
    res.json({ reply, echo: message, context });
  } catch (e) {
    console.error("API /api/chat error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// 8) Adaptive difficulty – return sentences by level
app.get("/api/sentences", (req, res) => {
  const level = (req.query.level || "medium").toString();
  const bank = {
    easy: [
      "The cat sat on the mat.",
      "This is a red book.",
      "I like tea and cake.",
    ],
    medium: [
      "The quick brown fox jumps over the lazy dog.",
      "They thought about those thrilling theories.",
      "Please verify the version before release.",
    ],
    hard: [
      "The thorough analysis revealed subtle pronunciation errors.",
      "She rarely worries about irregular verb variations.",
      "Three brothers brought thirty bright, brittle bracelets.",
    ],
  };
  res.json({ level, sentences: bank[level] || bank.medium });
});

/* ----------------------------- */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`Accent Coach AI API running on port ${PORT}`)
);
