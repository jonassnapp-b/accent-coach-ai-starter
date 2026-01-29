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

function buildWordPoolsFromDict(phonemeList) {
  // phoneme -> [words]
  const pools = new Map();
  for (const ph of phonemeList) pools.set(ph, []);

  // dict keys are uppercase; normalize to lowercase
  for (const rawKey of Object.keys(dict)) {
    const w = normalizeWord(rawKey);
    if (!isSafeWord(w)) continue;

    const phones = dictPhonesForWord(w);
    if (!phones || !phones.length) continue;

    // Add word to every phoneme it contains (dedup later)
    for (const ph of phones) {
      if (!pools.has(ph)) continue;
      pools.get(ph).push(w);
    }
  }

  // de-dup and lightly prefer shorter words (more “everyday”)
  for (const [ph, arr] of pools.entries()) {
    const uniq = Array.from(new Set(arr));
    uniq.sort((a, b) => a.length - b.length || a.localeCompare(b));
    pools.set(ph, uniq.slice(0, WORD_POOL_PER_PHONEME));
  }

  return pools;
}

function sentenceLooksOk(s) {
  if (!s) return false;
  const t = String(s).trim();
  if (t.length < 8) return false;
  if (/["“”]/.test(t)) return false;
  if (/[A-Z]{4,}/.test(t)) return false;
  const wc = t.split(/\s+/).filter(Boolean).length;
  if (wc < 5 || wc > 16) return false;
  return true;
}

function generateSentencesForPhoneme(ph, words) {
  // We want “heavily uses phoneme”: include 2–4 target words that contain ph
  // Use only lowercase words in text to keep it “no names”
  const W = (words || []).filter(isSafeWord);

  const templates2 = [
    (a, b) => `I can say ${a} and ${b} clearly today.`,
    (a, b) => `Please repeat ${a}, then repeat ${b} again.`,
    (a, b) => `I will practice ${a} and ${b} at a steady pace.`,
    (a, b) => `Say ${a} slowly, then say ${b} a bit faster.`,
    (a, b) => `I keep mixing up ${a} and ${b} when I speak.`,
    (a, b) => `Try ${a} first, and then try ${b} again.`,
  ];

  const templates3 = [
    (a, b, c) => `I can say ${a}, ${b}, and ${c} without rushing.`,
    (a, b, c) => `Repeat ${a}, then ${b}, then ${c} clearly.`,
    (a, b, c) => `I will practice ${a}, ${b}, and ${c} every day.`,
    (a, b, c) => `Say ${a} softly, then ${b}, then ${c} again.`,
  ];

  const templates4 = [
    (a, b, c, d) => `I can say ${a}, ${b}, ${c}, and ${d} clearly now.`,
    (a, b, c, d) => `Repeat ${a}, ${b}, ${c}, and ${d} with good timing.`,
  ];

  const out = [];
  const used = new Set();

  function add(s) {
    const t = String(s || "").trim();
    if (!sentenceLooksOk(t)) return;
    if (used.has(t)) return;
    used.add(t);
    out.push(t);
  }

  // If no words exist for this phoneme in dict, we still output “generic” lines
  if (W.length < 2) {
    const generic = [
      `I will focus on the ${ph} sound and stay relaxed.`,
      `Repeat the ${ph} sound slowly, then a bit faster.`,
      `I will keep the ${ph} sound clear in every word.`,
      `Practice the ${ph} sound and keep your pace steady.`,
      `Say the ${ph} sound cleanly, then repeat the sentence.`,
    ];
    for (const s of generic) add(s);
    return out;
  }

  // Build lots of combinations
  const maxI = Math.min(W.length, 200);

  for (let i = 0; i < maxI; i++) {
    for (let j = i + 1; j < maxI; j++) {
      const a = W[i], b = W[j];

      // 2-word templates
      for (const f of templates2) add(f(a, b));

      // 3-word templates when possible
      if (j + 1 < maxI) {
        const c = W[j + 1];
        for (const f of templates3) add(f(a, b, c));
      }

      // 4-word templates sometimes
      if (j + 2 < maxI) {
        const c = W[j + 1];
        const d = W[j + 2];
        for (const f of templates4) add(f(a, b, c, d));
      }

      if (out.length >= MAX_PER_PHONEME) return out;
    }
  }

  return out;
}

function ensureCoverage(index, wordPools, phonemeList) {
  // index: { PH: [sentences...] }
  // Guarantee MIN_PER_PHONEME for each CMU_PHONEMES entry
  const out = { ...index };

  for (const ph of phonemeList) {
    const existing = Array.isArray(out[ph]) ? out[ph] : [];
    const words = wordPools.get(ph) || [];

    // Generate
    const generated = generateSentencesForPhoneme(ph, words);

    // Merge + de-dup
    const merged = [];
    const seen = new Set();

    // Prefer existing heavy sentences first
    for (const s of existing) {
      const t = String(s || "").trim();
      if (!t) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      merged.push(t);
    }

    for (const s of generated) {
      if (merged.length >= MAX_PER_PHONEME) break;
      const t = String(s || "").trim();
      if (!t) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      merged.push(t);
    }

    // If still below minimum (rare), pad with simple variations
    while (merged.length < Math.min(MIN_PER_PHONEME, MAX_PER_PHONEME)) {
      const base = merged[merged.length - 1] || `I will practice the ${ph} sound clearly today.`;
      const pad = base.replace(/\.$/, "") + " again.";
      if (!seen.has(pad) && sentenceLooksOk(pad)) {
        seen.add(pad);
        merged.push(pad);
      } else {
        // last resort
        const fallback = `I will practice the ${ph} sound slowly right now.`;
        if (!seen.has(fallback)) {
          seen.add(fallback);
          merged.push(fallback);
        } else break;
      }
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

// 2) Word pools from CMUdict to guarantee coverage for all phonemes
const wordPools = buildWordPoolsFromDict(phonemeList);

// 3) Ensure coverage
const fullIndex = ensureCoverage(baseIndex, wordPools, phonemeList);

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
