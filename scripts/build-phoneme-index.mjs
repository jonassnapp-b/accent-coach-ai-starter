import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { dictionary as dict } from "cmu-pronouncing-dictionary";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const FRONTEND = path.join(ROOT, "frontend");

const SENTENCE_BANK_PATH = path.join(FRONTEND, "src", "lib", "sentenceBank.js");
const OUT_PATH = path.join(FRONTEND, "src", "lib", "phonemeSentenceIndex.json");

// --- You can tune these ---
const MIN_PER_PHONEME = 80;     // guarantee at least this many per CMU phoneme
const MAX_PER_PHONEME = 300;    // cap output size per phoneme
const WORD_POOL_PER_PHONEME = 600;

// CMU phoneme set (as in your screenshot + common ARPABET set)
function getAllCmuPhonemesFromDict() {
  const set = new Set();

  for (const rawKey of Object.keys(dict)) {
    const w = normalizeWord(rawKey);
    if (!isSafeWord(w)) continue;

    const phones = dictPhonesForWord(w);
    if (!phones || !phones.length) continue;

    for (const ph of phones) set.add(ph);
  }

  return Array.from(set).sort();
}


function stripStress(ph) {
  return String(ph || "").replace(/[0-9]/g, "").toUpperCase();
}

function normalizeWord(w) {
  return String(w || "")
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/^[^a-z']+|[^a-z']+$/g, "") // trim punctuation edges
    .replace(/-/g, "");                 // treat hyphen as join
}

function tokenize(sentence) {
  return String(sentence || "")
    .replace(/’/g, "'")
    .split(/\s+/)
    .map(normalizeWord)
    .filter(Boolean);
}

function isSafeWord(w) {
  if (!w) return false;
  if (w.length < 2) return false;
  if (w.length > 14) return false;
  if (!/^[a-z']+$/.test(w)) return false;
  if (w.includes("''")) return false;
  if (w.startsWith("'") || w.endsWith("'")) return false;

  const lower = String(w).toLowerCase();
  const upper = lower.toUpperCase();

  const CMU_PHONEME_CODES = new Set([
    "AA", "AE", "AH", "AO", "AW", "AX", "AXR", "AY",
    "EH", "ER", "EY", "IH", "IX", "IY", "OW", "OY",
    "UH", "UW", "UX", "OH",
    "B", "CH", "D", "DH", "DX", "EL", "EM", "EN",
    "F", "G", "HH", "JH", "K", "L", "M", "N", "NG",
    "NX", "P", "Q", "R", "S", "SH", "T", "TH", "V",
    "W", "Y", "Z", "ZH"
  ]);

  if (CMU_PHONEME_CODES.has(upper)) return false;

  if (lower.length >= 2 && /^[bcdfghjklmnpqrstvwxyz]+$/i.test(lower)) return false;

  // reject weird short tokens from CMU dict
  const COMMON_TWO_LETTER_WORDS = new Set([
    "am", "an", "as", "at", "be", "by", "do", "go", "he", "hi", "if", "in",
    "is", "it", "me", "my", "no", "of", "oh", "on", "or", "ox", "so", "to",
    "up", "us", "we"
  ]);

  if (lower.length === 2 && !COMMON_TWO_LETTER_WORDS.has(lower)) return false;

  const COMMON_THREE_LETTER_ALLOW = new Set([
    "and", "are", "but", "can", "day", "for", "get", "had", "has", "her", "him",
    "his", "how", "its", "let", "lot", "man", "new", "not", "now", "off", "one",
    "our", "out", "say", "see", "she", "the", "too", "try", "use", "way", "who",
    "you"
  ]);

  if (lower.length === 3 && !/[aeiou]/.test(lower) && !COMMON_THREE_LETTER_ALLOW.has(lower)) {
    return false;
  }

  return true;
}

function dictPhonesForWord(word) {
  const raw = String(word || "").trim();
  if (!raw) return null;

  // cmu-pronouncing-dictionary keys are typically UPPERCASE
  const keyUpper = raw.toUpperCase();

  const entry = dict[keyUpper] ?? dict[raw];
  if (!entry) return null;

  const pron = Array.isArray(entry) ? entry[0] : entry;
  if (!pron) return null;

  return String(pron)
    .trim()
    .split(/\s+/)
    .map(stripStress)
    .filter(Boolean);
}


async function loadAllSentences() {
  if (!fs.existsSync(SENTENCE_BANK_PATH)) {
    return [];
  }

  const mod = await import(pathToFileURL(SENTENCE_BANK_PATH).href);

  if (typeof mod.getAllSentences === "function") {
    const arr = mod.getAllSentences();
    if (!Array.isArray(arr)) return [];
    return arr.map(String).filter(Boolean);
  }

  // fallback if you ever add arrays later
  if (Array.isArray(mod.LEVELS)) {
    const all = [];
    for (const lvl of mod.LEVELS) {
      if (Array.isArray(lvl?.sentences)) all.push(...lvl.sentences);
      if (Array.isArray(lvl?.items)) all.push(...lvl.items);
    }
    return all.map(String).filter(Boolean);
  }

  return [];
}

function buildIndexFromSentences(sentences) {
  // phoneme -> Map(sentence -> score)
  const phonemeToSentenceScore = new Map();

  for (const s of sentences) {
    const words = tokenize(s);
    if (!words.length) continue;

    const counts = new Map();

    for (const w of words) {
      const phs = dictPhonesForWord(w);
      if (!phs) continue;
      for (const ph of phs) {
        counts.set(ph, (counts.get(ph) || 0) + 1);
      }
    }

    for (const [ph, c] of counts.entries()) {
      if (!phonemeToSentenceScore.has(ph)) phonemeToSentenceScore.set(ph, new Map());
      const m = phonemeToSentenceScore.get(ph);
      m.set(s, Math.max(m.get(s) || 0, c));
    }
  }

  const out = {};
  for (const [ph, m] of phonemeToSentenceScore.entries()) {
   const arr = Array.from(m.entries())
  // 🔴 KRAV: mindst 3 forekomster af phonemet
  .filter(([, count]) => count >= 3)
  // 🔴 SORTÉR hårdest først
  .sort((a, b) => b[1] - a[1])
  .slice(0, MAX_PER_PHONEME)
  .map(([sentence]) => sentence);

out[ph] = arr;

  }

  return out;
}




function sentenceLooksOk(s) {
  if (!s) return false;
  const t = String(s).trim();
  if (t.length < 8) return false;
  if (/["“”]/.test(t)) return false;
  if (/[A-Z]{4,}/.test(t)) return false;

  const wc = t.split(/\s+/).filter(Boolean).length;
  if (wc < 5 || wc > 16) return false;

  const words = t.match(/[A-Za-z']+/g) || [];
  const CMU_PHONEME_CODES = new Set([
    "AA", "AE", "AH", "AO", "AW", "AX", "AXR", "AY",
    "EH", "ER", "EY", "IH", "IX", "IY", "OW", "OY",
    "UH", "UW", "UX", "OH",
    "B", "CH", "D", "DH", "DX", "EL", "EM", "EN",
    "F", "G", "HH", "JH", "K", "L", "M", "N", "NG",
    "NX", "P", "Q", "R", "S", "SH", "T", "TH", "V",
    "W", "Y", "Z", "ZH"
  ]);

  for (const raw of words) {
    const w = String(raw).toLowerCase();
    const upper = w.toUpperCase();

    if (CMU_PHONEME_CODES.has(upper)) return false;
    if (w.length >= 2 && /^[bcdfghjklmnpqrstvwxyz]+$/i.test(w)) return false;
  }
  const COMMON_TWO_LETTER_WORDS = new Set([
    "am", "an", "as", "at", "be", "by", "do", "go", "he", "hi", "if", "in",
    "is", "it", "me", "my", "no", "of", "oh", "on", "or", "ox", "so", "to",
    "up", "us", "we"
  ]);

  for (const raw of words) {
    const w = String(raw).toLowerCase();
    const upper = w.toUpperCase();

    if (CMU_PHONEME_CODES.has(upper)) return false;
    if (w.length >= 2 && /^[bcdfghjklmnpqrstvwxyz]+$/i.test(w)) return false;
    if (w.length === 2 && !COMMON_TWO_LETTER_WORDS.has(w)) return false;
  }
    const badFragments = [
    " raj",
    " bijur",
    " dijon",
    " fejes",
    " fosia",
    " je ",
    " ji ",
    " gm ",
    " fm ",
    " hm ",
    " dj ",
  ];

  const lowerT = ` ${t.toLowerCase()} `;
  for (const bad of badFragments) {
    if (lowerT.includes(bad)) return false;
  }
  return true;
}




function ensureCoverage(index, phonemeList) {
  const out = { ...index };

  const SAFE_FALLBACKS = {
    AA: [
      "The hot coffee was gone.",
      "I saw the small ball fall.",
      "The job was hard at first."
    ],
    AE: [
      "That cat sat on the mat.",
      "Pack the bag and catch the cab.",
      "The last answer was bad."
    ],
    AH: [
      "I want to say it clearly.",
      "We can do it again today.",
      "The bus was coming up."
    ],
    AO: [
      "I saw the small ball fall.",
      "The dog was walking slowly.",
      "Call Paul in the morning."
    ],
    AW: [
      "Now I found out how it works.",
      "A loud crowd was outside.",
      "How about going now?"
    ],
    AY: [
      "I like to try again today.",
      "My time is right now.",
      "Why did I buy that?"
    ],
    B: [
      "Be back by noon.",
      "The blue bag is big.",
      "Bring the book back."
    ],
    CH: [
      "Choose a cheap chair and check it.",
      "The child chose cheese.",
      "Check the change again."
    ],
    D: [
      "Do that again today.",
      "The dog ran down the road.",
      "I did the job already."
    ],
    DH: [
      "These are the days that matter.",
      "This is the way they do it.",
      "That is the thing they wanted."
    ],
    EH: [
      "Get the best level next.",
      "Let them check again.",
      "The red pen is ready."
    ],
    ER: [
      "Her first turn was perfect.",
      "Learn the word first.",
      "The service was worth it."
    ],
    EY: [
      "Say it again later.",
      "Take the same train today.",
      "They came late again."
    ],
    F: [
      "Five friends feel fine.",
      "The phone fell fast.",
      "I found the file first."
    ],
    G: [
      "Go get the green bag.",
      "The game is going well.",
      "Give the gift back."
    ],
    HH: [
      "He had a hat at home.",
      "Help her get here.",
      "His hand was cold."
    ],
    IH: [
      "This is a simple little fix.",
      "Pick this big fish.",
      "It will fit in here."
    ],
    IY: [
      "We need to see the key details.",
      "Please read each piece clearly.",
      "Keep these three seats free."
    ],
    JH: [
      "John and Jane jumped in.",
      "The joke was gentle and short.",
      "The job changed in June."
    ],
    K: [
      "Keep the key close.",
      "I can come back quickly.",
      "The cat came inside."
    ],
    L: [
      "Please relax and roll your tongue.",
      "The little light was low.",
      "Look at the last line."
    ],
    M: [
      "My mom made a meal.",
      "Make more time for music.",
      "The man was smiling."
    ],
    N: [
      "No need to panic now.",
      "I need a new note.",
      "The next one is fine."
    ],
    NG: [
      "I am singing and bringing something.",
      "We were thinking about going long.",
      "The song was playing softly."
    ],
    OW: [
      "Go home slowly.",
      "I hope so.",
      "Show me the road."
    ],
    OY: [
      "The boy enjoyed a noisy toy.",
      "Try to avoid annoying noise.",
      "The choice was yours."
    ],
    P: [
      "Please repeat the phrase.",
      "The paper was on the table.",
      "Put the cup back."
    ],
    R: [
      "Please relax and roll your tongue.",
      "Her red car turned right.",
      "Read the report again."
    ],
    S: [
      "Say the same sound slowly.",
      "The sun was shining.",
      "I saw the sign outside."
    ],
    SH: [
      "She should share the shiny shoes.",
      "The shop was shut.",
      "Show me the short version."
    ],
    T: [
      "Take your time today.",
      "Try it two times.",
      "The train stopped there."
    ],
    TH: [
      "Think about that thing again.",
      "Three things were there.",
      "Thank them for this."
    ],
    UH: [
      "Put the book on the table.",
      "The good cook looked up.",
      "I took the full book."
    ],
    UW: [
      "We use two new tools.",
      "The blue room was cool.",
      "Move the food carefully."
    ],
    V: [
      "Very vivid voices.",
      "The van moved fast.",
      "I have five videos."
    ],
    W: [
      "We will wait a while.",
      "The window was wide open.",
      "Why were we walking?"
    ],
    Y: [
      "You can use it now.",
      "Yesterday you were here.",
      "Yes, you know why."
    ],
    Z: [
      "Zoe was busy today.",
      "These days are easy.",
      "The music was loud."
    ],
    ZH: [
      "I usually watch television in the evening.",
      "That decision was a measure of pleasure.",
      "The visual version was unusual."
    ],
  };

  for (const ph of phonemeList) {
    const existing = Array.isArray(out[ph]) ? out[ph] : [];
    const seen = new Set();
    const merged = [];

    for (const s of existing) {
      const t = String(s || "").trim();
      if (!t) continue;
      if (!sentenceLooksOk(t)) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      merged.push(t);
    }

    const safe = SAFE_FALLBACKS[ph] || [
      "I want to say it clearly.",
      "Please say it again slowly.",
      "We can try it once more."
    ];

    let i = 0;
    while (merged.length < Math.min(MIN_PER_PHONEME, MAX_PER_PHONEME)) {
      const s = safe[i % safe.length];
      if (!seen.has(s) && sentenceLooksOk(s)) {
        seen.add(s);
        merged.push(s);
      }
      i++;
      if (i > 500) break;
    }

    out[ph] = merged.slice(0, MAX_PER_PHONEME);
  }

  return out;
}

async function main() {
  // 1) From your own sentenceBank (if any)
  const sentences = await loadAllSentences();
  const uniqSentences = Array.from(new Set(sentences.map(s => String(s).trim()))).filter(Boolean);

  const baseIndex = buildIndexFromSentences(uniqSentences);

  // 2) Word pools from CMUdict to guarantee coverage for all phonemes
 const phonemeList = getAllCmuPhonemesFromDict();
const fullIndex = ensureCoverage(baseIndex, phonemeList);

fs.writeFileSync(OUT_PATH, JSON.stringify(fullIndex, null, 2), "utf8");

console.log(`[phoneme-index] bank sentences: ${uniqSentences.length}`);
console.log(`[phoneme-index] wrote: ${OUT_PATH}`);
console.log(`[phoneme-index] guaranteed phonemes: ${phonemeList.length}`);
console.log(
  `[phoneme-index] example sizes:`,
  phonemeList.slice(0, 8).map(p => `${p}:${(fullIndex[p]||[]).length}`).join("  ")
);
}

main().catch((e) => {
  console.error("[phoneme-index] FAILED:", e?.stack || e?.message || String(e));
  process.exit(1);
});
