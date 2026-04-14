import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const { transcript, scores, accent, language } = req.body || {};
const selectedLanguage = String(language || accent || "en_us").toLowerCase();

const allWords = Array.isArray(scores?.words) ? scores.words : [];

const weakWords = allWords
  .map((w) => ({
    word: String(w?.word || "").trim(),
    score: Number(w?.accuracyScore || 0),
    errorType: String(w?.errorType || "").trim(),
  }))
  .filter((w) => w.word && Number.isFinite(w.score) && w.score > 0)
  .sort((a, b) => a.score - b.score)
  .slice(0, 1);

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
  .slice(0, 2);
  

const languageMap = {
  en_us: "American English",
  en_br: "British English",
  zh_cn: "Mandarin Chinese",
  ja_jp: "Japanese",
  ko_kr: "Korean",
  es_es: "Spanish",
  de_de: "German",
  fr_fr: "French",
  ru_ru: "Russian",
  ar_sa: "Arabic",
};

const targetLanguage = languageMap[selectedLanguage] || "German";
    if (!transcript) {
      return res.status(400).json({ error: "Missing transcript" });
    }

const prompt = `
You are a pronunciation coach for a speaking app.

IMPORTANT:
- You must write BOTH spokenFeedbackText and nextAssistantText ONLY in ${targetLanguage}.
- NEVER use English unless ${targetLanguage} is English.
- This rule is strict and must always be followed.

Create spoken feedback using ONLY the pronunciation data below.
Speak like a helpful human teacher talking to a normal learner.
Keep it simple, natural, and human.
Do not sound robotic or technical.
Do not use IPA.
Do not explain sounds using English-specific examples.

User said:
"${transcript}"

Target language:
${targetLanguage}

Top-level pronunciation scores:
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
Must be written entirely in ${targetLanguage}.
Use 3 or 4 short sentences only.
Do not mention enthusiasm, confidence, or personality.
Do not give general praise.
Do not say things like "good job", "keep practicing", or "needs attention".
Mention the single weakest word explicitly if it exists.
Mention 1 or 2 weak sounds if they exist.
Explain exactly what to change in a practical way.
Focus on clarity, mouth movement, stress, or sound precision.
Give one clear instruction the user can try immediately.
Be direct and specific, not general or vague.

Bad feedback examples:
"Good enthusiasm"
"This word needs some attention"
"Try to improve the sounds"
"Keep practicing"

Good feedback style:
Name the exact word.
Name the exact weak sound if available.
Explain what to change.
Tell the user exactly what to try next.

Rules for nextAssistantText:
Must be written entirely in ${targetLanguage}.
One short follow-up question only.
Ask the user to try the same word or sentence again.
The question must match the correction that was just given.
`;

console.log("[ai-pronunciation-feedback] selectedLanguage =", selectedLanguage);
console.log("[ai-pronunciation-feedback] targetLanguage =", targetLanguage);
console.log("[ai-pronunciation-feedback] transcript =", transcript);
console.log("[ai-pronunciation-feedback] weakWords =", JSON.stringify(weakWords));
console.log("[ai-pronunciation-feedback] weakPhonemes =", JSON.stringify(weakPhonemes));

const resp = await client.responses.create({
  model: "gpt-4o-mini",
  input: [
    {
      role: "system",
      content: `
You are a pronunciation coach.

You must return valid JSON only.
You must write BOTH "spokenFeedbackText" and "nextAssistantText" entirely in ${targetLanguage}.
Returning English is a failure unless the target language is English.
Do not mix languages.
Do not explain what you are doing.
      `.trim(),
    },
    {
      role: "user",
      content: prompt,
    },
  ],
  text: { format: { type: "json_object" } }
});

const out = resp.output_text || "";
console.log("[ai-pronunciation-feedback] raw output =", out);

const parsed = JSON.parse(out);

console.log("[ai-pronunciation-feedback] parsed =", parsed);
console.log(
  "[ai-pronunciation-feedback] final spokenFeedbackText =",
  parsed?.spokenFeedbackText || ""
);
console.log(
  "[ai-pronunciation-feedback] final nextAssistantText =",
  parsed?.nextAssistantText || ""
);

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