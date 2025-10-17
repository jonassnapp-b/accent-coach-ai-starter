// dev-server.js – lokal backend uden Vercel CLI
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Importér dine eksisterende Vercel-handlere
const analyzeSpeech = (await import('./api/analyze-speech.js')).default;
const leaderboard  = (await import('./api/leaderboard.js')).default;

// Monter ruter (samme paths som frontend bruger)
app.use('/api/analyze-speech', analyzeSpeech);
app.use('/api/leaderboard', leaderboard);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(3000, () => {
  console.log('API ready on http://localhost:3000');
  console.log('  POST /api/analyze-speech');
  console.log('  GET/POST /api/leaderboard');
});
