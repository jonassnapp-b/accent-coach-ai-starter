// src/lib/streak.js
const KEY = "streak";

const dayKey = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();

const isMilestone = (n) => n === 5 || n === 15 || (n >= 10 && n % 10 === 0);

export function readStreak() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { count: Number(s.count) || 0, last: s.last || null };
  } catch {
    return { count: 0, last: null };
  }
}

export function updateStreak() {
  const todayK = dayKey();
  const yestK  = dayKey(new Date(Date.now() - 24*60*60*1000));
  const prev   = readStreak();

  let count = prev.count || 0;

  if (!prev.last) {
    count = 1;
  } else if (prev.last === todayK) {
    // allerede talt i dag → ingen ændring
  } else if (prev.last === yestK) {
    count += 1; // fortsat streak
  } else {
    count = 1;  // brudt streak
  }

  const data = { count, last: todayK };
  localStorage.setItem(KEY, JSON.stringify(data));

  const showBadge  = count >= 2;
  const showBanner = isMilestone(count);
  const badgeText  = showBadge ? `🔥 ${count}-day streak` : null;
  const bannerText = showBanner ? `🔥 Awesome! ${count}-day streak!` : null;

  return { ...data, showBadge, badgeText, showBanner, bannerText };
}
