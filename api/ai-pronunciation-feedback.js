import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const { transcript, scores } = req.body || {};
const allWords = Array.isArray(scores?.words) ? scores.words : [];

const weakWords = allWords
  .map((w) => ({
    word: String(w?.word || "").trim(),
    score: Number(w?.accuracyScore || 0),
    errorType: String(w?.errorType || "").trim(),
  }))
  .filter((w) => w.word && Number.isFinite(w.score) && w.score > 0)
  .sort((a, b) => a.score - b.score)
  .slice(0, 3);

const weakPhonemes = allWords
  .flatMap((w) =>
    Array.isArray(w?.phonemes)
      ? w.phonemes.map((p) => ({
          word: String(w?.word || "").trim(),
          phoneme: String(p?.phoneme || "").trim(),
          score: Number(p?.accuracyScore || 0),
        }))
      : []
  )
  .filter((p) => p.phoneme && Number.isFinite(p.score) && p.score > 0)
  .sort((a, b) => a.score - b.score)
  .slice(0, 5);
    if (!transcript) {
      return res.status(400).json({ error: "Missing transcript" });
    }

const prompt = `
You are an English pronunciation coach for a speaking app.

You must create spoken feedback using the Azure data below.
Do not be vague.
Do not say "good job", "great job", "nice work", or similar empty praise unless you immediately follow it with a specific weak word or weak sound.
Do not guess mistakes that are not supported by the data.

User said:
"${transcript}"

Top-level Azure scores:
${JSON.stringify(
  {
    overallAccuracy: scores?.overallAccuracy,
    fluency: scores?.fluency,
    completeness: scores?.completeness,
    pronunciation: scores?.pronunciation,
    prosody: scores?.prosody,
  },
  null,
  2
)}

Weakest words:
${JSON.stringify(weakWords, null, 2)}

Weakest phonemes:
${JSON.stringify(weakPhonemes, null, 2)}

Return JSON only in this exact shape:
{
  "spokenFeedbackText": string,
  "nextAssistantText": string
}

Rules for spokenFeedbackText:
- 2 to 4 sentences only.
- Sound natural when spoken aloud.
- Sentence 1: briefly summarize the overall result using the real Azure scores.
- Sentence 2: MUST name the weakest word if one exists.
- If a weak phoneme exists, mention the weakest sound in simple learner-friendly language.
- If fluency is below 85, mention that the rhythm or smoothness needs improvement.
- If pronunciation is strong overall, still mention the weakest specific area.
- Never output generic feedback with no specific word or sound.
- If weakWords is not empty, you MUST mention at least one of those words explicitly.
- If weakPhonemes is not empty, you MUST mention at least one of those phonemes explicitly.
- Keep it concrete and specific.

Rules for nextAssistantText:
- One short natural follow-up question only.
- Keep the conversation moving naturally.
`;

    const resp = await client.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
      text: { format: { type: "json_object" } }
    });

    const out = resp.output_text || "";
    const parsed = JSON.parse(out);
console.log("[ai-pronunciation-feedback] parsed =", parsed);
 return res.status(200).json({
  spokenFeedbackText: parsed.spokenFeedbackText || "",
  nextAssistantText: parsed.nextAssistantText || "",
});

  } catch (err) {
    return res.status(500).json({
      error: err?.message || "AI feedback failed"
    });
  }
}