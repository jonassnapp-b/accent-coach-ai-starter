// src/lib/api.js
export const USE_MOCK = false;
const API_PATH = "http://localhost:3000/api/analyze-speech"; // or your LAN IP

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}
async function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error || new Error("readAsDataURL failed"));
    fr.readAsDataURL(blob);
  });
}

export async function analyzeAudio({ blob, accent, refText }) {
  // Build a File (some environments are picky)
  const filename =
    blob.type?.includes("wav") ? "clip.wav" :
    blob.type?.includes("aac") ? "clip.aac" :
    blob.type?.includes("mp4") || blob.type?.includes("m4a") ? "clip.m4a" :
    "clip.dat";

  const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });

  // Multipart (preferred)
  let res = await fetch(API_PATH, {
    method: "POST",
    body: (() => {
      const f = new FormData();
      f.append("audio", file);               // Blob/File
      if (accent) f.append("accent", accent);
      if (refText) f.append("refText", refText); // target
      return f;
    })(),
  });

  // Fallback to JSON if the server rejects multipart
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
