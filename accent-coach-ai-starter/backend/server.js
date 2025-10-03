import express from 'express';
import multer from 'multer';
import cors from 'cors';

const app = express();
const upload = multer();

// --- CORS opsætning ---
const ALLOWED_ORIGINS = [
  'https://accent-coach-ai-starter.vercel.app', // dit Vercel site
  'http://localhost:5173'                       // hvis du tester lokalt
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); 
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('Ikke tilladt af CORS'));
  },
  methods: ['POST', 'OPTIONS'],
}));

// Preflight OPTIONS requests
app.options('/api/score', cors());

// --- Health check ---
app.get('/', (req, res) => res.send('Accent Coach AI backend running'));

// --- Mock scorer (kan erstattes af rigtig AI senere) ---
function mockScore(targetPhrase) {
  const words = targetPhrase
    .toLowerCase()
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  return {
    overall: 72 + Math.random() * 18, // 72–90
    words: words.map(w => ({
      word: w,
      score: 60 + Math.random() * 40
    }))
  };
}

// --- API endpoint ---
app.post('/api/score', upload.single('audio'), (req, res) => {
  const { targetPhrase, targetAccent } = req.body;
  const result = mockScore(targetPhrase || '');
  res.json(result);
});

// --- Start server ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Accent Coach AI API på port ${PORT}`));
