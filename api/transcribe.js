import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    const { audioBase64, mime } = req.body;

    const buffer = Buffer.from(audioBase64, "base64");

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const transcription = await openai.audio.transcriptions.create({
      file: new File([buffer], "audio.webm", { type: mime || "audio/webm" }),
      model: "gpt-4o-mini-transcribe",
    });

    res.status(200).json({ text: transcription.text || "" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}