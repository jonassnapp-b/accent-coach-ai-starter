// backend/lib/store.js
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// ---------------- Helper functions ----------------

// Gemmer hvor længe brugeren har "Pro"-adgang
export async function isPro(userId) {
  if (!userId) return false;
  const until = await redis.get(`pro:${userId}`);
  return Number(until || 0) > Date.now();
}

// Tilføj fx 30 dage "Pro" til en bruger
export async function addProDays(userId, days) {
  const addMs = days * 24 * 60 * 60 * 1000;
  const key = `pro:${userId}`;
  const current = Number((await redis.get(key)) || 0);
  const newUntil = Math.max(Date.now(), current) + addMs;
  await redis.set(key, newUntil);
  return newUntil;
}

// Antal referrals pr. bruger
export async function incReferralCount(userId) {
  return await redis.incr(`referral:${userId}`);
}
