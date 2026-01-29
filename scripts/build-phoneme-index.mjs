import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import dict from "cmu-pronouncing-dictionary";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const SENTENCE_BANK_PATH = path.join(ROOT, "src", "lib", "sentenceBank.js");
const OUT_PATH = path.join(ROOT, "src", "lib", "phonemeSentenceIndex.json");

function stripStress(ph) {
  return String(ph || "").replace(/[0-9]/g, "").toUpperCase();
}

function normalizeWord(w) {
  return String(w || "")
    .toLowerCase()
    .replace(/^[^a-z']+|[^a-z']+$/g, "")   // trim punctuation edges
    .replace(/’/g, "'")
    .replace(/-/g, "");                   // treat hyphen as join
}

function tokenize(sentence) {
  return String(sentence || "")
    .replace(/’/g, "'")
    .split(/\s+/)
    .map(normalizeWord)
    .filter(Boolean);
}

// --- 1) Load all sentences from your sentenceBank.js
async function loadAllSentences() {
  if (!fs.existsSync(SENTENCE_BANK_PATH)) {
    throw new Error(`Missing ${SENTENCE_BANK_PATH}`);
  }

  // Dynamic import ESM module
  const mod = await import(pathToFileURL(SENTENCE_BANK_PATH).href);

  // Prefer explicit export (recommended)
  if (typeof mod.getAllSentences === "function") {
    const arr = mod.getAllSentences();
    if (!Array.isArray(arr)) throw new Error("getAllSentences() must return an array");
    return arr.map(String).filter(Boolean);
  }

  // Fallback attempt: if you export LEVELS and each has sentences:[]
  if (Array.isArray(mod.LEVELS)) {
    const all = [];
    for (const lvl of mod.LEVELS) {
      if (Array.isArray(lvl?.sentences)) all.push(...lvl.sentences);
      if (Array.isArray(lvl?.items)) all.push(...lvl.items); // optional alt name
    }
    if (all.length) return all.map(String).filter(Boolean);
  }

  throw new Error(
    "Could not find sentences. Add export function getAllSentences() in src/lib/sentenceBank.js (see step 2)."
  );
}

function dictPhonesForWord(word) {
  const entry = dict[word];
  if (!entry) return null;

  // cmu-pronouncing-dictionary values can be string or array; handle both
  const pron = Array.isArray(entry) ? entry[0] : entry; // choose first pronunciation
  if (!pron) return null;

  return String(pron)
    .trim()
    .split(/\s+/)
    .map(stripStress)
    .filter(Boolean);
}

function buildIndex(sentences) {
  // phoneme -> Map(sentence -> score)
  const phonemeToSentenceScore = new Map();

  for (const s of sentences) {
    const words = tokenize(s);
    if (!words.length) continue;

    // count phonemes in this sentence
    const counts = new Map();

    for (const w of words) {
      const phs = dictPhonesForWord(w);
      if (!phs) continue;
      for (const ph of phs) {
        counts.set(ph, (counts.get(ph) || 0) + 1);
      }
    }

    // push sentence under each phoneme it contains
    for (const [ph, c] of counts.entries()) {
      if (!phonemeToSentenceScore.has(ph)) phonemeToSentenceScore.set(ph, new Map());
      const m = phonemeToSentenceScore.get(ph);
      // score = count (heavily uses phoneme)
      // If same sentence appears twice, keep max
      m.set(s, Math.max(m.get(s) || 0, c));
    }
  }

  // Convert to JSON-friendly structure:
  // { "TH": ["...sentence1...", "...sentence2..."], ... } sorted by score desc
  const out = {};
  for (const [ph, m] of phonemeToSentenceScore.entries()) {
    const arr = Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 300) // cap so JSON stays reasonable
      .map(([sentence]) => sentence);

    out[ph] = arr;
  }

  return out;
}

async function main() {
  const sentences = await loadAllSentences();

  // De-dup sentences
  const uniq = Array.from(new Set(sentences)).filter((s) => s.trim().length >= 2);

  const index = buildIndex(uniq);

  fs.writeFileSync(OUT_PATH, JSON.stringify(index, null, 2), "utf8");

  console.log(`[phoneme-index] sentences: ${uniq.length}`);
  console.log(`[phoneme-index] phonemes: ${Object.keys(index).length}`);
  console.log(`[phoneme-index] wrote: ${OUT_PATH}`);
}

main().catch((e) => {
  console.error("[phoneme-index] FAILED:", e?.stack || e?.message || String(e));
  process.exit(1);
});
