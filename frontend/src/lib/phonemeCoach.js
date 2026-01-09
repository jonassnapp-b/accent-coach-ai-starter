// frontend/src/lib/phonemeCoach.js

// Simple rule-based coach tips.
// Input payload example:
// { phoneme: "TH", scorePct: 42, word: "word", accent: "en_us" }

const VOWELS = new Set([
  "AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY",
  "IH", "IY", "OW", "OY", "UH", "UW", "AX", "IX", "UX", "AXR", "OH",
]);

function normPh(p) {
  return String(p || "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[0-9]/g, "") // sometimes CMU has stress numbers, just in case
    .toUpperCase();
}

function clampPct(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function isVowel(ph) {
  return VOWELS.has(ph);
}

function generalTip(scorePct) {
  const p = clampPct(scorePct);
  if (p == null) return "Try again and focus on a clean, steady sound.";
  if (p >= 90) return "Excellent — keep it consistent at normal speed.";
  if (p >= 75) return "Good — now try a slightly slower, clearer pronunciation.";
  if (p >= 60) return "Close — exaggerate the mouth shape and slow down a bit.";
  return "Needs work — go slower and isolate the sound before saying the full word.";
}

// Targeted tips by CMU phoneme
const TIPS = {
  // TH sounds
  TH: "For /th/: place the tip of your tongue lightly between your teeth and blow air — don’t vibrate your voice.",
  DH: "For /th/ (voiced): tongue lightly between teeth, but TURN ON your voice (like in “this”).",

  // R / L
  R: "For /r/: pull your tongue slightly back and up (don’t touch the teeth). Lips can round a little.",
  L: "For /l/: touch the tongue tip to the ridge behind your top teeth. Keep it light and clean.",

  // V / W
  V: "For /v/: top teeth gently touch the bottom lip and vibrate your voice.",
  W: "For /w/: round lips forward (‘oo’ shape) and glide quickly into the next vowel.",

  // S / Z / SH / ZH
  S: "For /s/: keep tongue close to the ridge, narrow airflow. No voice.",
  Z: "For /z/: same as /s/ but with voice turned on.",
  SH: "For /sh/: lips slightly rounded, tongue a bit further back than /s/.",
  ZH: "For /zh/: like /sh/ but voiced (rare; like the middle sound in “measure”).",

  // CH / JH
  CH: "For /ch/: stop + burst + friction (like “chip”). Keep it crisp.",
  JH: "For /j/: like /ch/ but voiced (like “job”).",

  // T / D
  T: "For /t/: quick tongue tap on the ridge, then release cleanly. Don’t add an extra vowel.",
  D: "For /d/: like /t/ but voiced. Short and clean release.",

  // K / G
  K: "For /k/: back of tongue touches soft palate then releases. Keep it sharp.",
  G: "For /g/: like /k/ but voiced.",

  // F / P / B
  F: "For /f/: top teeth on bottom lip, blow air. No voice.",
  P: "For /p/: lips close then release with a small puff of air.",
  B: "For /b/: lips close then release, but with voice on (no strong puff).",

  // N / NG
  N: "For /n/: tongue on ridge behind top teeth, let air flow through the nose.",
  NG: "For /ng/: back of tongue up, air through the nose (like the end of “sing”).",

  // H
  HH: "For /h/: just breathy air from the throat into the vowel — don’t ‘block’ it.",

  // Y
  Y: "For /y/: glide quickly (like ‘y’ in “yes”). Don’t hold it too long.",
};

function vowelTip(ph) {
  // A few quick vowel shape cues
  switch (ph) {
    case "IY":
      return "For /ee/: spread lips slightly, tongue high and forward. Keep it long and steady.";
    case "IH":
    case "IX":
      return "For /ih/: relaxed tongue, slightly lower than /ee/. Shorter sound.";
    case "AE":
      return "For /ae/: open mouth wide (like ‘cat’). Jaw drops more than you think.";
    case "AA":
    case "AO":
      return "For /ah/: open jaw and keep tongue low. Don’t turn it into ‘uh’.";
    case "UH":
    case "UW":
    case "UX":
      return "For /oo/: round lips forward, tongue high-back. Keep it smooth.";
    case "ER":
    case "AXR":
      return "For /er/: tongue pulled back, lips relaxed. Avoid adding extra vowel before/after.";
    case "OW":
      return "For /oh/: start rounded then glide slightly — don’t keep it flat.";
    case "AY":
      return "For /ai/: start open (‘ah’) then glide to ‘ee’. Make the glide clear.";
    case "AW":
      return "For /au/: start open then round to ‘oo’. Don’t rush the glide.";
    case "OY":
      return "For /oy/: start ‘oh’ then glide to ‘ee’. Keep both parts distinct.";
    default:
      return "Focus on the mouth shape and keep the vowel steady — don’t change it mid-sound.";
  }
}

export async function getCoachFeedback(payload = {}) {
  const ph = normPh(payload.phoneme);
  const pct = clampPct(payload.scorePct);
  const word = String(payload.word || "").trim();

  // Always return something
  if (!ph) {
    return word
      ? `Try again on “${word}”. ${generalTip(pct)}`
      : generalTip(pct);
  }

  // If score is already high, keep it short
  if (pct != null && pct >= 90) {
    return word
      ? `Nice! In “${word}”, your /${ph.toLowerCase()}/ is strong. Try at normal speed now.`
      : `Nice! Your /${ph.toLowerCase()}/ is strong. Try at normal speed now.`;
  }

  // Targeted phoneme tips
  let tip = TIPS[ph];
  if (!tip && isVowel(ph)) tip = vowelTip(ph);

  // Fallback if unknown phoneme
  if (!tip) tip = generalTip(pct);

  // Add tiny guidance based on score bands
  if (pct != null && pct < 60) {
    tip = `${tip} Go slower and isolate this sound 3–5 times before the full word.`;
  } else if (pct != null && pct < 85) {
    tip = `${tip} Now repeat the word slowly, then speed up.`;
  }

  if (word) return `In “${word}”: ${tip}`;
  return tip;
}
