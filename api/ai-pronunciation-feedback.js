import OpenAI from "openai";
const ENGLISH_PHONEME_COACH_MAP = {
  AA: { instruction: "Open your mouth wide, keep your tongue low and relaxed." },
  AE: { instruction: "Open your mouth wide, keep your tongue forward and low." },
  AH: { instruction: "Keep your mouth relaxed and slightly open, tongue neutral." },
  AO: { instruction: "Round your lips slightly and keep your tongue low." },
  AW: { instruction: "Start with mouth open, then glide lips forward." },
  AY: { instruction: "Start open, then raise the tongue toward the front." },
  EH: { instruction: "Keep your mouth slightly open, tongue mid-front." },
  ER: { instruction: "Curl your tongue slightly back without touching the roof." },
  EY: { instruction: "Start mid, then raise the tongue slightly." },
  IH: { instruction: "Keep it short, tongue relaxed and slightly forward." },
  IY: { instruction: "Spread lips slightly, tongue high and forward." },
  OW: { instruction: "Round lips and move forward smoothly." },
  OY: { instruction: "Start rounded, then move tongue forward." },
  UH: { instruction: "Light lip rounding, tongue relaxed." },
  UW: { instruction: "Round lips tightly, tongue high and back." },
  AX: { instruction: "Keep everything relaxed, very short sound." },
  IX: { instruction: "Short, relaxed, tongue slightly forward." },
  P: { instruction: "Close lips fully, release with air." },
  B: { instruction: "Close lips fully, release with voice." },
  T: { instruction: "Touch tongue just behind top teeth, release cleanly." },
  D: { instruction: "Touch tongue just behind top teeth, release with voice." },
  K: { instruction: "Lift back of tongue, release air." },
  G: { instruction: "Lift back of tongue, release with voice." },
  CH: { instruction: "Stop airflow, then release into friction." },
  JH: { instruction: "Voiced version of CH, smooth release." },
  F: { instruction: "Top teeth on lower lip, push air through." },
  V: { instruction: "Top teeth on lower lip, add voice." },
  TH: { instruction: "Tongue lightly between teeth, push air." },
  DH: { instruction: "Tongue lightly between teeth, add voice." },
  S: { instruction: "Tongue close behind teeth, narrow air." },
  Z: { instruction: "Same as S but with voice." },
  SH: { instruction: "Lips slightly rounded, smooth air." },
  ZH: { instruction: "Same as SH but voiced." },
  HH: { instruction: "Air flows freely from throat." },
  M: { instruction: "Close lips, sound through nose." },
  N: { instruction: "Tongue behind teeth, sound through nose." },
  NG: { instruction: "Back of tongue up, sound through nose." },
  L: { instruction: "Tongue touches ridge behind teeth." },
  R: { instruction: "Pull tongue back, do not touch roof." },
  W: { instruction: "Round lips tightly, glide forward." },
  Y: { instruction: "Tongue high and forward, glide quickly." }
};

function getEnglishPhonemeInstruction(selectedLanguage, phoneme) {
  const isEnglish = selectedLanguage === "en_us" || selectedLanguage === "en_br";
  if (!isEnglish) return "";
  const entry = ENGLISH_PHONEME_COACH_MAP[String(phoneme || "").toUpperCase()];
  return typeof entry?.instruction === "string" ? entry.instruction.trim() : "";
}
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const { transcript, scores, accent, language } = req.body || {};
const selectedLanguage = String(language || accent || "en_us").toLowerCase();
const isEnglish = selectedLanguage === "en_us" || selectedLanguage === "en_br";

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
      ? w.phonemes.map((p) => {
          const phoneme = String(p?.phoneme || "").trim().toUpperCase();

          return {
            word: String(w?.word || "").trim(),
            phoneme,
            score: Number(p?.accuracyScore || 0),
            instruction: getEnglishPhonemeInstruction(selectedLanguage, phoneme),
          };
        })
      : []
  )
  .filter((p) => p.phoneme && Number.isFinite(p.score) && p.score > 0)
  .sort((a, b) => a.score - b.score)
  .slice(0, 5);
  

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
const articulationAllowed = isEnglish;
    if (!transcript) {
      return res.status(400).json({ error: "Missing transcript" });
    }

const prompt = `
You are a pronunciation coach for a speaking app.

IMPORTANT:
You must write BOTH spokenFeedbackText and nextAssistantText ONLY in ${targetLanguage}.
NEVER use English unless ${targetLanguage} is English.
This rule is strict and must always be followed.

Create pronunciation feedback using ONLY the data below.
Do not guess.
Do not invent mouth, tongue, lip, jaw, or airflow advice.

Articulation guidance allowed:
${articulationAllowed ? "YES" : "NO"}

If articulation guidance is allowed:
- You may mention mouth, tongue, lip, jaw, or airflow advice ONLY if the exact instruction text is provided in weakPhonemes.instruction.
- You must copy that instruction faithfully and not expand it with extra mechanics.
- If no instruction exists for a weak phoneme, do not give articulation advice for that sound.

If articulation guidance is NOT allowed:
- Do not mention mouth, tongue, lips, jaw, airflow, placement, or articulation at all.
- Use only the available pronunciation data such as weakest word, weak sound, fluency, prosody, pronunciation, rhythm, pacing, smoothness, clarity, or connectedness.

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
3 to 4 short sentences only.
Start with one short overall impression.
Mention the weakest word explicitly if one exists.
If articulationAllowed is true and a weak phoneme has an instruction, you may explain improvement using that instruction only.
If articulationAllowed is false, do not mention articulation mechanics at all.
If fluency is weaker, briefly say the speech should sound smoother or more connected.
If prosody is weaker, briefly mention rhythm, stress, or natural flow.
Never invent technical explanations.
Never use IPA.
Never claim unavailable data.

Rules for nextAssistantText:
Must be written entirely in ${targetLanguage}.
One short natural follow-up question only.
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
Do not invent pronunciation mechanics.

If articulation guidance is allowed, you may use mouth, tongue, lip, jaw, or airflow advice ONLY when the exact instruction is explicitly provided in the user data.
If articulation guidance is not allowed, do not mention mouth, tongue, lips, jaw, airflow, placement, or articulation at all.

Use only the evidence present in the provided scores, words, phonemes, and instructions.
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