import express from 'express';
import multer from 'multer';
import cors from 'cors';

const app = express();
const upload = multer();

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
app.use(cors({ origin: FRONTEND_ORIGIN }));

// Health
app.get('/', (req, res) => res.send('Accent Coach AI backend running'));

// MOCK scorer — erstattes med rigtig API-integration
function mockScore(targetPhrase) {
  const words = (targetPhrase || '')
    .replace(/[^a-zA-Z\s']/g, '')
    .split(/\s+/)
    .filter(Boolean);
  return {
    overall: 72 + Math.random() * 18, // 72–90
    words: words.map(w => ({ word: w, score: 60 + Math.random()*40 }))
  };
}

app.post('/api/score', upload.single('audio'), (req, res) => {
  const { targetPhrase, targetAccent } = req.body;
  const result = mockScore(targetPhrase || '');
  res.json(result);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('Accent Coach AI API på port', PORT));
