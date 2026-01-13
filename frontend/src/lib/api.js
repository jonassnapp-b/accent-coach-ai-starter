// src/lib/api.js
export const USE_MOCK = false;

/* ---------- Base URL helper ---------- */
export function getApiBase() {
  const ls = (typeof localStorage !== "undefined" && localStorage.getItem("apiBase")) || "";
  const env = (import.meta?.env && import.meta.env.VITE_API_BASE) || "";
  const base = (ls || env || window.location.origin).replace(/\/+$/, "");
  return base;
}

/* ---------- Generic JSON fetch ---------- */
export async function fetchJSON(path, opts = {}) {
  const base = getApiBase();
  const res = await fetch(base + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    let errText;
    try { errText = await res.text(); } catch {}
    throw new Error(`${res.status} ${res.statusText}${errText ? " — " + errText.slice(0,160) : ""}`);
  }
  return res.json();
}

/* ---------- Blob utils (til fallback) ---------- */
async function safeJson(res) { try { return await res.json(); } catch { return null; } }
async function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error || new Error("readAsDataURL failed"));
    fr.readAsDataURL(blob);
  });
}

/* ---------- analyzeAudio (bruger fleksibel base) ---------- */
export async function analyzeAudio({ blob, accent, refText }) {
  const base = getApiBase();
  const API_PATH = `${base}/api/analyze-speech`;

  const filename =
    blob.type?.includes("wav") ? "clip.wav" :
    blob.type?.includes("aac") ? "clip.aac" :
    blob.type?.includes("mp4") || blob.type?.includes("m4a") ? "clip.m4a" :
    "clip.dat";

  const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });

  // Multipart først (ingen Content-Type header -> browser sætter boundary)
  let res = await fetch(API_PATH, {
    method: "POST",
    body: (() => {
      const f = new FormData();
      f.append("audio", file);
      if (accent)  f.append("accent",  accent);
      if (refText) f.append("refText", refText);
      return f;
    })(),
  });

  // 4xx fallback: send som JSON (data URL)
  if (!res.ok && res.status >= 400 && res.status < 500) {
    const dataURL = await blobToDataURL(file);
    res = await fetch(API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audio: dataURL,
        mime: file.type || "application/octet-stream",
        accent: accent || "en-US",
        refText: refText || "",
      }),
    });
  }

  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.error || `Server error (${res.status})`);
  }
  return res.json();
}

/* ---------- Week 3: Pro + Referral helpers ---------- */
// Pro status
export async function getProStatus(userId) {
  if (!userId) throw new Error("userId required");
  return fetchJSON(`/api/pro/status?userId=${encodeURIComponent(userId)}`);
}
export async function grantTrial(userId, days = 30) {
  if (!userId) throw new Error("userId required");
  return fetchJSON(`/api/pro/grant-trial`, {
    method: "POST",
    body: JSON.stringify({ userId, days }),
  });
}

// Referral
export async function getReferralCode(userId) {
  if (!userId) throw new Error("userId required");
  return fetchJSON(`/api/referral/code?userId=${encodeURIComponent(userId)}`);
}
export async function getReferralCount(userId) {
  if (!userId) throw new Error("userId required");
  return fetchJSON(`/api/referral/count?userId=${encodeURIComponent(userId)}`);
}
export async function submitReferralOpen({ code, newUserId }) {
  return fetchJSON(`/api/referral/open`, {
    method: "POST",
    body: JSON.stringify({ code, newUserId }),
  });
}
