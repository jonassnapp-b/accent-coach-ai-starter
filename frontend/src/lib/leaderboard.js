// src/lib/leaderboard.js
// Lokal "Duolingo-style" leaderboard med ugentlig reset (søndag kl. 23:59 lokal tid)
// og 6 ranks: Bronze, Silver, Gold, Emerald, Pearl, Diamond.

const STORAGE_KEY_PREFIX = "ac-leaderboard:";
const USER_ID_KEY = "ac-userId";
const USER_NAME_KEY = "ac-userName";

// rank-grænser (XP total i indeværende uge)
export const RANKS = [
  { id: "bronze",   name: "Bronze",   min: 0,     color: "#CD7F32" },
  { id: "silver",   name: "Silver",   min: 5000,  color: "#C0C0C0" },
  { id: "gold",     name: "Gold",     min: 10000, color: "#D4AF37" },
  { id: "emerald",  name: "Emerald",  min: 15000, color: "#2ECC71" },
  { id: "pearl",    name: "Pearl",    min: 20000, color: "#EAEAEA" },
  { id: "diamond",  name: "Diamond",  min: 25000, color: "#7FDBFF" },
];

// Finder indeværende sæsons id (en “uge”) der slutter søndag 23:59 lokal tid
export function currentSeasonId(date = new Date()) {
  // getDay(): 0=Sunday ... 6=Saturday
  const d = new Date(date);
  const day = d.getDay();
  // hvor mange dage frem til søndag
  const toSunday = (7 - day) % 7;
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + toSunday);

  // brug YYYY-W<weekOfYearBySundayEnd> som id – simpel men stabil
  const year = end.getFullYear();
  const yStart = new Date(year, 0, 1);
  const days = Math.floor((end - yStart) / (24 * 3600 * 1000));
  const week = Math.floor(days / 7) + 1;
  return `${year}-W${week}`;
}

export function seasonEndDate(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const toSunday = (7 - day) % 7;
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + toSunday);
  return end;
}

function storageKeyForSeason(seasonId = currentSeasonId()) {
  return STORAGE_KEY_PREFIX + seasonId;
}

function getOrCreateUserId() {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = "u_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

export function getUserName() {
  return localStorage.getItem(USER_NAME_KEY) || "You";
}

export function setUserName(name) {
  localStorage.setItem(USER_NAME_KEY, name || "You");
}

function loadSeason(seasonId = currentSeasonId()) {
  const raw = localStorage.getItem(storageKeyForSeason(seasonId));
  if (raw) return JSON.parse(raw);

  // seed med nogle “bots”, så listen ligner Duolingo lidt
  const bots = [
    { id: "b_jason",  name: "Jason",  xp: 597 },
    { id: "b_cindy",  name: "Cindy",  xp: 252 },
    { id: "b_ashley", name: "Ashley", xp: 224 },
    { id: "b_sergio", name: "Sergio", xp: 156 },
  ];
  const data = { seasonId, players: bots };
  saveSeason(data);
  return data;
}

function saveSeason(data) {
  localStorage.setItem(storageKeyForSeason(data.seasonId), JSON.stringify(data));
}

export function getLeaderboard(seasonId = currentSeasonId()) {
  const data = loadSeason(seasonId);
  // medtag "mig" hvis ikke findes
  const myId = getOrCreateUserId();
  const me = data.players.find(p => p.id === myId);
  if (!me) {
    data.players.push({ id: myId, name: getUserName(), xp: 0 });
    saveSeason(data);
  }
  // sortér desc
  const sorted = [...data.players].sort((a, b) => b.xp - a.xp);
  return { seasonId, players: sorted };
}

export function myStats() {
  const { seasonId, players } = getLeaderboard();
  const myId = getOrCreateUserId();
  const idx = players.findIndex(p => p.id === myId);
  const me = players[idx];
  const rank = idx + 1;
  const { rankName, nextMin } = rankForPoints(me.xp);
  const toNext = nextMin != null ? Math.max(0, nextMin - me.xp) : 0;
  return { seasonId, me, rank, rankName, toNext };
}

export function rankForPoints(xp) {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (xp >= r.min) current = r;
  }
  const nextIdx = RANKS.findIndex(r => r.id === current.id) + 1;
  const next = RANKS[nextIdx];
  return { rankId: current.id, rankName: current.name, color: current.color, nextMin: next?.min ?? null };
}

// Tilføj XP – brug når man gennemfører “courses” eller får feedback-score
export function awardPoints(amount, reason = "activity") {
  const { seasonId } = getLeaderboard();
  const data = loadSeason(seasonId);
  const myId = getOrCreateUserId();
  const me = data.players.find(p => p.id === myId) || { id: myId, name: getUserName(), xp: 0 };
  me.xp = Math.max(0, Math.round(me.xp + Number(amount || 0)));
  if (!data.players.find(p => p.id === myId)) data.players.push(me);
  saveSeason(data);
  return me.xp;
}

// Konverter resultat til points (fx fra Record/feedback)
// Hvis dit result allerede har et "score" 0..1000, giver vi samme antal XP.
export function awardPointsFromFeedback(result) {
  if (!result) return;
  let score = 0;

  if (typeof result.score === "number") {
    score = result.score;
  } else if (Array.isArray(result.words)) {
    // grov fallback: gennemsnit af phoneme-scores * 10 (max 1000)
    let sum = 0, count = 0;
    for (const w of result.words) {
      if (Array.isArray(w.phonemes)) {
        for (const ph of w.phonemes) {
          if (typeof ph.score === "number") { sum += ph.score; count++; }
        }
      }
    }
    const avg = count ? (sum / count) : 0;
    score = Math.max(0, Math.min(1000, Math.round(avg * 10)));
  }

  score = Math.max(0, Math.min(1000, Math.round(score)));
  return awardPoints(score, "feedback");
}
