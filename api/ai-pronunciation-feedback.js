import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const { transcript, scores } = req.body || {};

    if (!transcript) {
      return res.status(400).json({ error: "Missing transcript" });
    }

const prompt = `
You are an English pronunciation coach.

User said:
"${transcript}"

Pronunciation scores from Azure:
${JSON.stringify(scores || {}, null, 2)}

Return JSON only in this exact shape:
{
  "feedbackSummary": string,
  "feedbackTip": string,
  "weakWords": [{ "word": string, "score": number }],
  "spokenFeedbackText": string,
  "nextAssistantText": string
}

Rules:
- feedbackSummary: very short summary for UI, e.g. "Pronunciation: 92% — Good clarity"
- feedbackTip: one short practical improvement tip
- weakWords: up to 2 weakest words if visible from scores, otherwise []
- spokenFeedbackText: one short sentence the app can speak aloud
- nextAssistantText: one short natural follow-up question to continue the conversation
- Keep everything concise, encouraging, and natural.
`;

    const resp = await client.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
      text: { format: { type: "json_object" } }
    });

    const out = resp.output_text || "";
    const parsed = JSON.parse(out);

    return res.status(200).json({
  feedbackSummary: parsed.feedbackSummary || "",
  feedbackTip: parsed.feedbackTip || "",
  weakWords: Array.isArray(parsed.weakWords) ? parsed.weakWords : [],
  spokenFeedbackText: parsed.spokenFeedbackText || "",
  nextAssistantText: parsed.nextAssistantText || "",
});

  } catch (err) {
    return res.status(500).json({
      error: err?.message || "AI feedback failed"
    });
  }
}