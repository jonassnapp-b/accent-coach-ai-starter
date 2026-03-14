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

  const session = await client.realtime.clientSecrets.create({
  session: {
    type: "realtime",
    model: "gpt-realtime",
    audio: {
      output: {
        voice: accent === "en_br" ? "cedar" : "marin",
      },
    },
  },
});
console.log("[realtime-session] session keys =", Object.keys(session || {}));
console.log("[realtime-session] has client_secret =", !!session?.client_secret?.value);
console.log("[realtime-session] session type =", session?.type);
console.log("[realtime-session] model =", session?.model);
console.log("[realtime-session] raw session =", JSON.stringify(session, null, 2));
    return res.status(200).json(session);
  } catch (err) {
    console.error("[realtime-session] error", err);
    return res.status(500).json({
      error: err?.message || "Failed to create realtime session",
    });
  }
}