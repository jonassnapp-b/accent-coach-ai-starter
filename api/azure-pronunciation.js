export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;

    if (!key || !region) {
      return res.status(500).json({ error: "Missing Azure env vars" });
    }

    const { audioBase64, mime } = req.body || {};

    if (!audioBase64) {
      return res.status(400).json({ error: "Missing audioBase64" });
    }

    const audioBuffer = Buffer.from(audioBase64, "base64");

    const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`;

    const azureRes = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": mime || "audio/webm",
        Accept: "application/json;text/xml",
        "Pronunciation-Assessment": JSON.stringify({
          ReferenceText: "",
          GradingSystem: "HundredMark",
          Dimension: "Comprehensive",
          EnableMiscue: false,
          ScenarioId: "unscripted",
        }),
      },
      body: audioBuffer,
    });

    const raw = await azureRes.text();

    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }

    if (!azureRes.ok) {
      return res.status(azureRes.status).json({
        error: data?.error || data?.RecognitionStatus || raw || "Azure pronunciation failed",
      });
    }

    const nbest = Array.isArray(data?.NBest) ? data.NBest[0] : null;
    const displayText =
      nbest?.Display ||
      data?.DisplayText ||
      "";

    const pa = nbest?.PronunciationAssessment || {};

    const words = Array.isArray(nbest?.Words)
      ? nbest.Words.map((w) => ({
          word: w?.Word || "",
          accuracyScore: Number(w?.PronunciationAssessment?.AccuracyScore ?? 0),
          errorType: w?.PronunciationAssessment?.ErrorType || "",
        }))
      : [];

    return res.status(200).json({
      transcript: displayText,
      overallAccuracy: Number(pa?.AccuracyScore ?? 0),
      fluency: Number(pa?.FluencyScore ?? 0),
      completeness: Number(pa?.CompletenessScore ?? 0),
      pronunciation: Number(pa?.PronScore ?? 0),
      words,
      raw: data,
    });
  } catch (err) {
    return res.status(500).json({
      error: err?.message || "Azure pronunciation failed",
    });
  }
}