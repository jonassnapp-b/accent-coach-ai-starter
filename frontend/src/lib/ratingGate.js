import { requestAppReview } from "./inAppReview";

const SESSIONS_KEY = "ac_sessions_count_v1";
const ASKED_KEY = "ac_rating_asked_v1";

export function bumpSessionsCount() {
  const n = Number(localStorage.getItem(SESSIONS_KEY) || "0") + 1;
  localStorage.setItem(SESSIONS_KEY, String(n));
  return n;
}

export function shouldAskForRating(scorePct) {
  const asked = localStorage.getItem(ASKED_KEY) === "1";
  if (asked) return false;

  const sessions = Number(localStorage.getItem(SESSIONS_KEY) || "0");
  if (sessions < 5) return false;

  return Number(scorePct) >= 90;
}

export function markAskedForRating() {
  localStorage.setItem(ASKED_KEY, "1");
}

export async function triggerNativeRatingPrompt() {
  await requestAppReview();
}
