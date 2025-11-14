// src/lib/progression.js
const K = {
  XP_KEY: "ac_xp",
  LVL_KEY: "ac_lvl",
  COIN_KEY: "ac_coins",
  QUEST_KEY: "ac_quests",
};

// level curve (enkelt, men kan tweakes)
function xpForLevel(lvl) { return 100 + (lvl - 1) * 50; }

export function readState() {
  const xp = Number(localStorage.getItem(K.XP_KEY) || 0);
  const lvl = Math.max(1, Number(localStorage.getItem(K.LVL_KEY) || 1));
  const coins = Math.max(0, Number(localStorage.getItem(K.COIN_KEY) || 0));
  const quests = JSON.parse(localStorage.getItem(K.QUEST_KEY) || "[]");
  return { xp, lvl, coins, quests };
}

function writeState(s) {
  localStorage.setItem(K.XP_KEY, String(s.xp));
  localStorage.setItem(K.LVL_KEY, String(s.lvl));
  localStorage.setItem(K.COIN_KEY, String(s.coins));
  localStorage.setItem(K.QUEST_KEY, JSON.stringify(s.quests || []));
}

export function addXP(amount = 10) {
  const s = readState();
  s.xp += amount;
  let gainedLevel = false;
  while (s.xp >= xpForLevel(s.lvl)) {
    s.xp -= xpForLevel(s.lvl);
    s.lvl++;
    s.coins += 25; // level bonus
    gainedLevel = true;
  }
  writeState(s);
  return { ...s, gainedLevel };
}

export function addCoins(amount = 5) {
  const s = readState();
  s.coins += amount;
  writeState(s);
  return s;
}

export function xpProgress01() {
  const s = readState();
  const need = xpForLevel(s.lvl);
  return { pct: Math.min(1, s.xp / need), need, have: s.xp };
}

// simple daily quests (reset ved ny dag)
export function ensureDailyQuests() {
  const key = "ac_qdate";
  const today = new Date().toISOString().slice(0,10);
  if (localStorage.getItem(key) !== today) {
    const qs = [
      { id: "q1", name: "Do 3 recordings", goal: 3, cur: 0, rewardXP: 40, rewardCoins: 10 },
      { id: "q2", name: "Score 90+ once", goal: 1, cur: 0, rewardXP: 30, rewardCoins: 8 },
    ];
    localStorage.setItem(K.QUEST_KEY, JSON.stringify(qs));
    localStorage.setItem(key, today);
  }
  return readState().quests;
}

export function tickQuest(id, inc = 1) {
  const s = readState();
  const qs = (s.quests || []).map(q => q.id === id ? { ...q, cur: Math.min(q.goal, q.cur + inc) } : q);
  s.quests = qs;
  writeState(s);
  return s;
}

export function claimQuest(id) {
  const s = readState();
  const q = (s.quests || []).find(q => q.id === id);
  if (!q || q.cur < q.goal || q.done) return { ok: false, state: s };
  s.xp += q.rewardXP; s.coins += q.rewardCoins; q.done = true;
  writeState(s);
  return { ok: true, state: s };
}
