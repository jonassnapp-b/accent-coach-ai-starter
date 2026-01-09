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

// ---------------- Referral code helpers ----------------

// generate short readable code
function makeRefCode(len = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

// Ensure a user has a referral code (persisted), return it
export async function ensureRefCode(userId) {
  if (!userId) throw new Error("Missing userId");

  const existing = await redis.get(`refcode:byUser:${userId}`);
  if (existing) return String(existing);

  // try generate unique code
  for (let i = 0; i < 8; i++) {
    const code = makeRefCode(8);

    // claim code if free
    const claimedBy = await redis.get(`refcode:owner:${code}`);
    if (claimedBy) continue;

    await redis.set(`refcode:owner:${code}`, userId);
    await redis.set(`refcode:byUser:${userId}`, code);
    return code;
  }

  throw new Error("Could not allocate referral code");
}

// Optionally bind a ref code to a user (e.g. when someone enters a code)
export async function bindRefCodeToUser(code, userId) {
  if (!code || !userId) throw new Error("Missing code or userId");

  const clean = String(code).trim().toUpperCase();

  const owner = await redis.get(`refcode:owner:${clean}`);
  if (!owner) throw new Error("Invalid referral code");

  // prevent self-referral
  if (String(owner) === String(userId)) throw new Error("Cannot use your own referral code");

  // prevent double-binding
  const already = await redis.get(`refcode:usedBy:${userId}`);
  if (already) return { ok: true, alreadyUsed: true };

  await redis.set(`refcode:usedBy:${userId}`, clean);

  // increment referral count for the owner
  await incReferralCount(owner);

  return { ok: true };
}
