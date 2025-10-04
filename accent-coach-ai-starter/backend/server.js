import express from 'express';
import multer from 'multer';
import cors from 'cors';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());            // Åbn CORS for MVP
app.options('*', cors());   // Tillad preflight-requests

// Health check
app.get('/', (_req, res) => res.send('Accent Coach AI backend running'));

// Mock-funktion til at simulere en score
function mockScore(targetPhrase = '') {
  const words = (targetPhrase || '')
    .toString()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .split(/\s+/)
    .filter(Boolean);

  return {
    overall: Math.round(72 + Math.random() * 18),
    words: words.map(w => ({ word: w, score: Math.round(60 + Math.random() * 40) })),
  };
}

// API-endpoint
app.post('/api/score', upload.single('audio'), (req, res) => {
  try {
    const { targetPhrase = '', targetAccent = '' } = req.body || {};
    const result = mockScore(targetPhrase);
    res.json(result);
  } catch (err) {
    console.error('API /api/score error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Accent Coach AI API kører på port ${PORT}`));
