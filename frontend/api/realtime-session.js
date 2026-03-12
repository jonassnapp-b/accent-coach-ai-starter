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
    const normalizedAccent =
      String(accent).toLowerCase() === "en_br" ? "en_br" : "en_us";

    const instructions =
      normalizedAccent === "en_br"
        ? "You are FluentUp Conversation Coach. Have a natural spoken English conversation in British English. Be warm and concise."
        : "You are FluentUp Conversation Coach. Have a natural spoken English conversation in American English. Be warm and concise.";

    const payload = {
      model: "gpt-4o-realtime-preview",
      instructions,
      voice: normalizedAccent === "en_br" ? "sage" : "alloy"
    };
console.log("OPENAI PAYLOAD:", JSON.stringify(payload, null, 2));
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
console.log("OPENAI STATUS:", response.status);
console.log("OPENAI RESPONSE:", rawText);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Failed to create realtime session",
        detail: data
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      error: "Failed to create realtime session",
      detail: err?.message || String(err)
    });
  }
}