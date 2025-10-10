// frontend/api/analyze-speech.js
// Vercel Serverless Function – “rigtig” transskription via OpenAI Whisper.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST' });
  }

  try {
    const { audio, mime, accent } = req.body ?? {};
    if (!audio) return res.status(400).json({ error: 'Missing audio (base64 dataURL)' });

    // audio er en dataURL – strip header hvis tilstede
    const base64 = audio.includes(',') ? audio.split(',')[1] : audio;
    const buf = Buffer.from(base64, 'base64');

    // Node 18 har File/FormData/Blob globalt (undici)
    const file = new File([buf], `audio.${extFromMime(mime)}`, { type: mime || 'audio/webm' });

    const form = new FormData();
    form.append('file', file);
    form.append('model', 'whisper-1');
    // form.append('language', 'en');            // valgfri: hvis du vil låse sprog
    // form.append('temperature', '0');          // valgfri: mere deterministisk

    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        // !!! VIGTIGT: IKKE 'Content-Type' manuelt – fetch sætter korrekt boundary for FormData
      },
      body: form,
    });

    if (!resp.ok) {
      const err = await safeJson(resp);
      return res.status(resp.status).json({ error: err?.error?.message || `OpenAI error (${resp.status})` });
    }

    const data = await resp.json(); // { text: "..." }
    const transcript = (data?.text || '').trim();

    // Simpel “phoneme feedback” struktur så UI virker nu:
    // (Whisper giver ord-timestamps i andre flows; her holder vi det enkelt:
    //  ægte fonemer kræver G2P eller forced alignment – kan vi lægge på senere.)
    const words = transcript
      ? transcript.split(/\s+/).map((w) => ({
          w,
          score: 0.82, // baseline “ok” udtale
          phonemes: Array.from(w).map((ch, j) => ({
            ph: ch.toLowerCase(),
            score: Math.max(0.6, 0.85 - j * 0.02), // lidt variation for “lifelike” feedback
          })),
        }))
      : [];

    return res.status(200).json({
      transcript,
      accent: accent || 'us',
      words,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}

// Hjælpere
function extFromMime(m) {
  if (!m) return 'webm';
  if (m.includes('webm')) return 'webm';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mpeg')) return 'mp3';
  if (m.includes('wav')) return 'wav';
  if (m.includes('mp4')) return 'mp4';
  return 'webm';
}

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}
