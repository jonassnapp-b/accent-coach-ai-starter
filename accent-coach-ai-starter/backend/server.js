import express from 'express';
import multer from 'multer';
import cors from 'cors';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());            // Open CORS for MVP
app.options('*', cors());   // Allow preflight requests

// Health check
app.get('/', (_req, res) => res.send('Accent Coach AI backend running'));

// Mock scoring function
function mockScore(targetPhrase = '') {
  const words = (targetPhrase || '')
    .toString()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .split(/\s+/)
    .filter(Boolean);

  return {
    overall: Math.round(72 + Math.random() * 18), // 72–90
    words: words.map(w => ({
      word: w,
      score: Math.round(60 + Math.random() * 40), // 60–100
    })),
  };
}

// Build actionable feedback based on lower-scoring words
function buildFeedback(targetPhrase = '', words = []) {
  const low = words.filter(w => (w.score ?? 100) < 80);

  const focusAreas = new Set();
  const tips = [];

  const hasTH          = (w) => /\b(th(e|is|at|ose|ese)|think|thought|through)\b/i.test(w);
  const likelyR        = (w) => /r/i.test(w);
  const finalConsonant = (w) => /[bdfgklmnprsStTz]$/i.test(w);
  const likelyVW       = (w) => /[wv]/i.test(w); // ← fixed: match v/w anywhere

  for (const item of low) {
    const word = (item.word || '').toString();

    if (hasTH(word)) {
      focusAreas.add('TH sound (/θ/ /ð/)');
      tips.push({
        word,
        note: 'Soft TH: place the tongue lightly against the teeth — not like D/Z.',
        drill: 'Say “the / this / those” slowly; let air flow out.',
      });
    } else if (finalConsonant(word)) {
      focusAreas.add('Final consonants');
      tips.push({
        word,
        note: 'Pronounce the final consonant clearly (especially t/d/s).',
        drill: `Say “${word}” 3× with extra focus on the ending.`,
      });
    } else if (likelyR(word)) {
      focusAreas.add('R sound / r-colored vowels');
      tips.push({
        word,
        note: 'American “r”: tongue slightly raised and pulled back; not rolled.',
        drill: `Exaggerate the “r” in “${word}” three times.`,
      });
    } else if (likelyVW(word)) {
      focusAreas.add('V vs W');
      tips.push({
        word,
        note: 'V: lower lip against teeth. W: rounded lips with airflow.',
        drill: 'Practice minimal pairs: “wine–vine”, “west–vest”.',
      });
    } else {
      tips.push({
        word,
        note: 'Articulate more slowly and stretch the vowel slightly.',
        drill: `Say “${word}” syllable by syllable, slowly (3×).`,
      });
    }
  }

  const avg = words.length
    ? Math.round(words.reduce((s, w) => s + (w.score ?? 100), 0) / words.length)
    : 0;

  let overall;
  if (!words.length) {
    overall = 'No words detected.';
  } else if (avg >= 90) {
    overall = `Strong pronunciation overall (~${avg}/100). Just polish minor details.`;
  } else if (avg >= 80) {
    overall = `Good foundation (~${avg}/100). Focus on a few recurring patterns.`;
  } else {
    overall = `High improvement potential (~${avg}/100). Work on 1–2 sounds at a time.`;
  }

  return {
    overall,
    focusAreas: [...focusAreas],
    wordTips: tips.slice(0, 12),
    nextSteps: [
      'Practice slowly (0.75× speed) and exaggerate difficult sounds.',
      'Record again and check if focus areas improve.',
    ],
  };
}

// API endpoint
app.post('/api/score', upload.single('audio'), (req, res) => {
  try {
    const { targetPhrase = '', targetAccent = '' } = req.body || {};
    const result = mockScore(targetPhrase);
    result.feedback = buildFeedback(targetPhrase, result.words || []);
    return res.json(result);
  } catch (err) {
    console.error('API /api/score error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Accent Coach AI API running on port ${PORT}`));
