export default async function handler(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const { accent = "en_us" } = req.body || {};

    const voice = accent === "en_br" ? "sage" : "alloy";

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
       body: JSON.stringify({
  model: "gpt-realtime-preview",
  voice,
  modalities: ["audio"]
})
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);
      return res.status(500).json({
        error: "Failed to create realtime session",
        detail: data
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: "Failed to create realtime session",
      detail: err?.message || String(err)
    });
  }
}