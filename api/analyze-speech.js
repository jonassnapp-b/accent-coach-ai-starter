// api/analyze-speech.js
// Azure Speech-to-Text + Pronunciation Assessment (free-form)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    const { audio, mime, accent } = req.body ?? {};
    if (!audio) return res.status(400).json({ error: "Missing audio (base64 dataURL)" });

    const region = process.env.AZURE_SPEECH_REGION;
    const key = process.env.AZURE_SPEECH_KEY;
    if (!region || !key) {
      return res.status(500).json({ error: "Azure Speech env vars missing" });
    }

    // dataURL -> bytes
    const base64 = audio.includes(",") ? audio.split(",")[1] : audio;
    const bytes = Buffer.from(base64, "base64");

    // Language from accent
    // Sprog ud fra accent. Hvis accent allerede er en locale (fx "en-US"), brug den direkte.
// Begrænset til 100 % sikre engelske accenter (US, UK, AU, CA)
const shortToLocale = {
  us: 'en-US',
  uk: 'en-GB',
  au: 'en-AU',
  ca: 'en-CA',
};

let lang = 'en-US';
if (accent) {
  lang = accent.includes('-') ? accent : (shortToLocale[accent] || 'en-US');
}


    // Pronunciation Assessment (free-form)
    const paConfig = {
      ReferenceText: "",
      GradingSystem: "HundredMark",
      Granularity: "Word", // or "Phoneme"
      EnableMiscue: true,
    };
    const paHeader = Buffer.from(JSON.stringify(paConfig)).toString("base64");

    // Use detailed format so we (usually) get NBest + Words
    const url =
      `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1` +
      `?language=${encodeURIComponent(lang)}&format=detailed`;

    const azureResp = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": mime || "audio/ogg; codecs=opus",
        "Pronunciation-Assessment": paHeader,
        Accept: "application/json",
      },
      body: bytes,
    });

    const data = await azureResp.json().catch(() => ({}));

    if (!azureResp.ok) {
      const msg = data?.error?.message || data?.Message || `Azure error (${azureResp.status})`;
      return res.status(azureResp.status).json({ error: msg, _debugAzure: data });
    }

    // ---- Robust parsing (handles different shapes/casing) ----
    const list = data?.NBest || data?.nbest || [];
    const nbest = Array.isArray(list) ? list[0] : undefined;

    const rawTranscript =
      data?.DisplayText ??
      data?.displayText ??
      nbest?.Display ??
      nbest?.display ??
      nbest?.Lexical ??
      nbest?.lexical ??
      "";

    const cleanTranscript = String(rawTranscript || "").trim();

    const wordsList = nbest?.Words || nbest?.words || [];

    let words = Array.isArray(wordsList)
      ? wordsList.map((w) => {
          const acc =
            (w?.PronunciationAssessment?.AccuracyScore ??
              w?.accuracyScore ??
              80) / 100;
          const token = (w?.Word ?? w?.word ?? "").toString();
          return {
            w: token,
            score: acc,
            phonemes: [{ ph: token.toLowerCase(), score: acc }],
          };
        })
      : [];

    // Fallback if Azure didn’t return word timing but we have a transcript
    if ((!words || words.length === 0) && cleanTranscript) {
      words = cleanTranscript.split(/\s+/).map((w, i) => ({
        w,
        score: 0.82,
        phonemes: [{ ph: w.toLowerCase(), score: Math.max(0.6, 0.85 - i * 0.02) }],
      }));
    }

    // TEMP: include raw Azure payload to inspect in DevTools
    return res.status(200).json({
      transcript: cleanTranscript || ".",
      accent: accent || "us",
      words,
      _debugAzure: data, // <— look at this in Network->Response
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
