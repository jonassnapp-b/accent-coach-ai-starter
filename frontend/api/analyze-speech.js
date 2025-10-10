// Minimal serverless backend på Vercel.
// Modtager base64-lyd + accent og returnerer et result, som din PhonemeFeedback kan vise.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST' });
  }

  try {
    const { audio, mime, accent } = req.body ?? {};
    if (!audio) {
      return res.status(400).json({ error: 'Missing audio (base64)' });
    }

    // Hvis du får en dataURL (fx "data:audio/webm;base64,AAAA..."), så strip headeren:
    const base64 = audio.includes(',') ? audio.split(',')[1] : audio;

    // Decode til buffer (kun hvis du vil sende fil videre til et eksternt API)
    const buffer = Buffer.from(base64, 'base64');

    // TODO: Rigtig analyse (fx OpenAI Whisper til transskription + din egen scoring)
    // Nedenfor returnerer vi et "fornuftigt" dummy-resultat, så hele kæden virker nu.
    // Struktur matcher din PhonemeFeedback-komponent.

    const demoTranscript = 'This is a demo recording';
    const words = demoTranscript.split(' ').map((w, i) => ({
      w,
      score: 0.82,        // en pæn middel-score
      phonemes: w.split('').map((ch, j) => ({
        ph: ch.toLowerCase(),
        score: 0.8 - (j * 0.02), // små variationer
      })),
    }));

    return res.status(200).json({
      transcript: demoTranscript,
      accent: accent || 'us',
      words,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
