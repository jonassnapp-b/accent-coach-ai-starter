// /frontend/src/lib/leaderboard.js
const USER_ID_KEY = "ac-userId";
const USER_NAME_KEY = "ac-userName";
const API_BASE = "/api/leaderboard";

export const RANKS = [
  { id: "bronze",   name: "Bronze",   min: 0,     color: "#CD7F32" },
  { id: "silver",   name: "Silver",   min: 5000,  color: "#C0C0C0" },
  { id: "gold",     name: "Gold",     min: 10000, color: "#D4AF37" },
  { id: "emerald",  name: "Emerald",  min: 15000, color: "#2ECC71" },
  { id: "pearl",    name: "Pearl",    min: 20000, color: "#EAEAEA" },
  { id: "diamond",  name: "Diamond",  min: 25000, color: "#7FDBFF" },
];

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
  try {
    fetch(`${API_BASE}?action=setName`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: getOrCreateUserId(), name }),
    });
  } catch {}
}

export async function getLeaderboard() {
  try {
    const r = await fetch(`${API_BASE}`, { cache: "no-store" });
    if (!r.ok) throw new Error("bad");
    const out = await r.json();
    const myId = getOrCreateUserId();
    const me = out.players.find(p => p.id === myId) || { id: myId, name: getUserName(), xp: 0 };
    if (!out.players.find(p => p.id === myId)) out.players.push(me);
    out.players.sort((a,b) => b.xp - a.xp);
    return out;
  } catch {
    const myId = getOrCreateUserId();
    return { seasonId: "local", players: [{ id: myId, name: getUserName(), xp: 0 }] };
  }
}

export function rankForPoints(xp) {
  let current = RANKS[0];
  for (const r of RANKS) if (xp >= r.min) current = r;
  const i = RANKS.findIndex(r => r.id === current.id);
  const next = RANKS[i + 1];
  return { rankId: current.id, rankName: current.name, color: current.color, nextMin: next?.min ?? null };
}

export async function myStats() {
  const board = await getLeaderboard();
  const myId = getOrCreateUserId();
  const players = board.players.sort((a,b)=>b.xp-a.xp);
  const idx = players.findIndex(p => p.id === myId);
  const me = idx >= 0 ? players[idx] : { id: myId, name: getUserName(), xp: 0 };
  const { rankName, nextMin } = rankForPoints(me.xp);
  const toNext = nextMin != null ? Math.max(0, nextMin - me.xp) : 0;
  return { seasonId: board.seasonId, me, rank: idx + 1, rankName, toNext };
}

export async function awardPoints(amount, reason = "activity") {
  const userId = getOrCreateUserId();
  const name = getUserName();
  try {
    const r = await fetch(`${API_BASE}?action=award`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name, delta: Number(amount || 0), reason }),
    });
    if (!r.ok) throw new Error("bad");
    const me = await r.json();
    return me.xp;
  } catch {
    return 0;
  }
}

export function awardPointsFromFeedback(result) {
  if (!result) return;
  let score = 0;
  if (typeof result.score === "number") score = result.score;
  else if (Array.isArray(result.words)) {
    let sum = 0, c = 0;
    for (const w of result.words) {
      for (const ph of (w.phonemes || [])) {
        if (typeof ph.score === "number") { sum += ph.score; c++; }
      }
    }
    const avg = c ? (sum / c) : 0;
    score = Math.max(0, Math.min(1000, Math.round(avg * 10)));
  }
  score = Math.max(0, Math.min(1000, Math.round(score)));
  return awardPoints(score, "feedback");
}
