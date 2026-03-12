export default async function handler(req, res) {
  if ((req.method || "GET").toUpperCase() !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing OPENAI_API_KEY"
      });
    }

    const { accent = "en_us" } = req.body || {};
    const normalizedAccent =
      String(accent).toLowerCase() === "en_br" ? "en_br" : "en_us";

    const voice = normalizedAccent === "en_br" ? "sage" : "alloy";

    const payload = {
      model: "gpt-realtime-preview",
      voice,
      modalities: ["audio", "text"]
    };

    console.log("[realtime-session] sending payload:", payload);

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const rawText = await response.text();
    console.log("[realtime-session] status:", response.status);
    console.log("[realtime-session] raw response:", rawText);

    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { raw: rawText };
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Failed to create realtime session",
        detail: data
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("[realtime-session] crash:", err);

    return res.status(500).json({
      error: "Failed to create realtime session",
      detail: err?.message || String(err)
    });
  }
}