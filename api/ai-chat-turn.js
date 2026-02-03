// api/ai-chat-turn.js
import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { scenarioId, scenarioTitle, scenarioSubtitle, level, accent, history } = req.body || {};

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // We return JSON only.
    const system = `
You are "Kai", an English speaking AI conversation partner in a role-play scenario.
Goal: keep the conversation natural and short, 1–2 sentences per turn.
You MUST return strict JSON with:
{
  "assistantText": string,            // what Kai says next
  "expectedUserReply": string         // a short, speakable reply the user should say next (1 sentence, <= 10 words)
}
The expectedUserReply must be a plausible reply to assistantText and easy to pronounce.
No markdown. No extra keys.
`;

    const user = `
Scenario:
- id: ${scenarioId}
- title: ${scenarioTitle}
- subtitle: ${scenarioSubtitle}
- level: ${level}
Accent UI: ${accent}

Conversation so far (role/text):
${JSON.stringify(history || [], null, 2)}
`;

    const resp = await client.responses.create({
      model: "gpt-5", // choose your model
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      // Encourage JSON-only
      text: { format: { type: "json_object" } },
    });

    // Responses API returns output text in a structured way; safest: join text parts
    const out = resp.output_text || "";
    let parsed = null;
    try {
      parsed = JSON.parse(out);
    } catch {
      return res.status(500).json({ error: "AI returned non-JSON", raw: out });
    }

    const assistantText = String(parsed?.assistantText || "").trim();
    const expectedUserReply = String(parsed?.expectedUserReply || "").trim();

    if (!assistantText || !expectedUserReply) {
      return res.status(500).json({ error: "AI JSON missing fields", raw: parsed });
    }

    return res.status(200).json({ assistantText, expectedUserReply });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
