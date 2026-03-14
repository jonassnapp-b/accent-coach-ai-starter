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

Write ONE short spoken feedback message (1 sentence).

Example style:
"Nice job. Your pronunciation was clear, but try stressing the word 'technology' more."

Return JSON only:
{
  "spokenFeedback": string
}
`;

    const resp = await client.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
      text: { format: { type: "json_object" } }
    });

    const out = resp.output_text || "";
    const parsed = JSON.parse(out);

    return res.status(200).json({
      spokenFeedback: parsed.spokenFeedback
    });

  } catch (err) {
    return res.status(500).json({
      error: err?.message || "AI feedback failed"
    });
  }
}