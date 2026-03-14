import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { accent = "en_us" } = req.body || {};

    const session = await client.beta.realtime.sessions.create({
      model: "gpt-realtime",
      voice: accent === "en_br" ? "alloy" : "verse",
    });

    return res.status(200).json(session);
  } catch (err) {
    console.error("[realtime-session] error", err);
    return res.status(500).json({
      error: err?.message || "Failed to create realtime session",
    });
  }
}