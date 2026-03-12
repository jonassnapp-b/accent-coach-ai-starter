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
        ? "You are FluentUp Conversation Coach. Have a natural real-time spoken English conversation. Speak in natural British English. Be warm, concise, and voice-friendly. The first thing you say should ask what the user wants to talk about today while naturally offering many possible topics. Do not mention scenarios. Keep replies conversational and normal length. If the user interrupts, adapt naturally."
        : "You are FluentUp Conversation Coach. Have a natural real-time spoken English conversation. Speak in natural American English. Be warm, concise, and voice-friendly. The first thing you say should ask what the user wants to talk about today while naturally offering many possible topics. Do not mention scenarios. Keep replies conversational and normal length. If the user interrupts, adapt naturally.";

  const payload = {
  session: {
    model: "gpt-realtime",
    voice: normalizedAccent === "en_br" ? "sage" : "alloy",
    instructions,
    modalities: ["audio"],
    audio: {
      input: {
        turn_detection: {
          type: "server_vad",
          create_response: true,
          interrupt_response: true,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          threshold: 0.5
        }
      }
    }
  }
};

    console.log("[realtime-session] payload:", JSON.stringify(payload, null, 2));

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

    let data;
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