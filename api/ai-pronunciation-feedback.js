import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const { transcript, scores, accent } = req.body || {};
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
  const targetAccent =
  String(accent || "en_us").toLowerCase() === "en_br"
    ? "British English"
    : "American English";
    if (!transcript) {
      return res.status(400).json({ error: "Missing transcript" });
    }

const prompt = `
You are an English pronunciation coach for a speaking app.

Create spoken feedback using ONLY the Azure pronunciation data below.
Speak like a helpful human teacher talking to a normal learner.
Use simple everyday English.
Do not sound robotic, technical, or overly formal.
Do not use IPA or technical phoneme symbols unless absolutely necessary.
Instead of technical symbols, prefer plain explanations like:
- "the th sound"
- "the r sound"
- "the ending sound"
- "the middle of the word"

User said:
"${transcript}"

Target accent:
${targetAccent}

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
- 2 to 4 short sentences only.
- Make it easy for an average learner to understand.
- Do not mention score numbers in the spoken feedback.
- Start with a short natural overall impression.
- Then mention the weakest word if one exists.
- If there is a clear weak sound, explain it in simple learner-friendly language.
- If fluency is weaker, mention that the sentence needs to sound smoother.
- If the pronunciation is strong overall, say that briefly, but still mention the main weak area.
- Never say only "good job", "great job", or "nice work".
- Never give generic advice like "improve a couple of sounds".
- If weakWords is not empty, you MUST mention at least one of those words explicitly.
- Keep it concrete, simple, and human.

Good examples:
- "That was mostly clear, but the word 'birthday' was weaker than the rest. The th sound needs a little more work."
- "Overall that sounded good, but 'comfortable' was less clear. Try to make the middle of that word cleaner."
- "Your sentence was understandable, but one word stood out as weaker: 'thought'. The th sound was the main issue."

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