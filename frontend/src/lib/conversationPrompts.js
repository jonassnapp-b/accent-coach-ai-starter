// src/lib/conversationPrompts.js

export const SYSTEM_PROMPT = `
You are FluentUp Conversation Coach.

Your job is NOT to be a generic chatbot.
Your job is to help the user improve spoken English pronunciation through a real-time voice conversation.

Rules:
- Be warm, short, and natural.
- Keep replies concise, usually 1-3 short sentences.
- Continue the conversation naturally.
- Give at most ONE pronunciation correction per turn.
- Focus on pronunciation, accent clarity, stress, or specific sounds.
- Do not overload the user with grammar corrections.
- If pronunciation data is provided, use it to give a specific correction.
- If no meaningful pronunciation issue is found, praise briefly and continue.
- Prefer concrete coaching like:
  - "Try the R in 'work' a bit stronger."
  - "Your TH in 'think' should be softer, tongue slightly forward."
  - "Stress the second word a little more."
- After feedback, continue the conversation with one natural follow-up question when appropriate.
`;

export function buildConversationUserPrompt({
  scenario,
  level,
  transcript,
  weakPhonemes = [],
  weakWords = [],
  turnIndex = 0,
}) {
  const phonemeText = weakPhonemes.length
    ? weakPhonemes
        .slice(0, 3)
        .map((p) => `${p.label}: ${p.score}`)
        .join(", ")
    : "none";

  const wordText = weakWords.length
    ? weakWords
        .slice(0, 3)
        .map((w) => `${w.word}: ${w.score}`)
        .join(", ")
    : "none";

  return `
Scenario: ${scenario}
Difficulty: ${level}
Turn number: ${turnIndex}

User transcript:
"${transcript}"

Weak phonemes:
${phonemeText}

Weak words:
${wordText}

Write a JSON object with:
{
  "coach_feedback": "short spoken feedback",
  "assistant_reply": "short natural next reply in the conversation",
  "suggested_repeat": "very short phrase for the user to repeat, or empty string"
}

Make it sound natural and voice-friendly.
`.trim();
}

export const DEFAULT_SCENARIOS = [
  {
    id: "small_talk",
    title: "Small Talk",
    starter: "Hey! How’s your day going so far?",
  },
  {
    id: "job_interview",
    title: "Job Interview",
    starter: "Thanks for joining today. Could you tell me a little about yourself?",
  },
  {
    id: "coffee_shop",
    title: "Coffee Shop",
    starter: "Hi! What would you like to order today?",
  },
  {
    id: "airport",
    title: "Airport",
    starter: "Good morning. Where are you flying today?",
  },
];