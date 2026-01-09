// backend/lib/weaknessAggregator.js
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".localdata");
const DATA_FILE = path.join(DATA_DIR, "weakness.json");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadAll() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

async function saveAll(obj) {
  await ensureDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(obj, null, 2), "utf8");
}

function extractPhonemes(payload) {
  // Accept BOTH shapes:
  // 1) { words: [{ phonemes: [{label, score}, ...] }] }
  // 2) { phonemes: [{label, score}, ...] }
  const direct = payload?.phonemes;
  if (Array.isArray(direct)) return direct;

  const fromWords = payload?.words?.[0]?.phonemes;
  if (Array.isArray(fromWords)) return fromWords;

  return [];
}

export async function recordSessionResult(userId, payload) {
  const phonemes = extractPhonemes(payload);

  if (!phonemes.length) {
    console.log("[WeaknessLab] nothing to save (0 phonemes)");
    return { ok: true, saved: 0 };
  }

  const all = await loadAll();
  if (!all[userId]) all[userId] = { phonemes: {} };

  let saved = 0;

  for (const p of phonemes) {
    const label = String(p?.label || "").trim().toUpperCase();
    const score = Number(p?.score);

    if (!label) continue;
    if (!Number.isFinite(score)) continue;

    if (!all[userId].phonemes[label]) {
      all[userId].phonemes[label] = { count: 0, total: 0 };
    }

    all[userId].phonemes[label].count += 1;
    all[userId].phonemes[label].total += score;
    saved += 1;
  }

  await saveAll(all);
  console.log("[WeaknessLab] saved phonemes:", saved);
  return { ok: true, saved };
}

export async function getWeaknessOverview(userId) {
  const all = await loadAll();
  const data = all[userId]?.phonemes || {};

  const weaknesses = Object.entries(data).map(([label, v]) => {
    const count = Number(v?.count || 0);
    const total = Number(v?.total || 0);
    const avg = count > 0 ? total / count : 0;
    return { label, count, avg };
  });

  // Sort: worst first (lowest avg)
  weaknesses.sort((a, b) => a.avg - b.avg);

  const top = weaknesses.slice(0, 8);

  // ⭐ You want it to show after 1 recording:
  const minThresholdMet = top.length > 0;

  return {
    minThresholdMet,
    topWeaknesses: top,
  };
}
