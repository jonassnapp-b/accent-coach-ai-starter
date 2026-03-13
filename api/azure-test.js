export default async function handler(req, res) {
  try {
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;

    if (!key || !region) {
      return res.status(500).json({ ok: false, error: "Missing Azure env vars" });
    }

    return res.status(200).json({
      ok: true,
      hasKey: !!key,
      region,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || "Test failed" });
  }
}