import express from 'express';
import multer from 'multer';
import cors from 'cors';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Allow all origins for now (to verify everything works)
app.use(cors());
app.options('*', cors()); // handle preflight for any route



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
  try {
    const { targetPhrase = '', targetAccent = '' } = req.body || {};
    const result = mockScore(targetPhrase || '');
    return res.json(result);
  } catch (e) {
    console.error('API /api/score error:', e);
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
});


// --- Start server ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Accent Coach AI API på port ${PORT}`));
