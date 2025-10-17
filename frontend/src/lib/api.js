// src/lib/api.js

export const USE_MOCK = false; // vi bruger backend

const API_PATH = "/api/analyze-speech";

async function blobToDataURL(blob) {
  const buf = await blob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return `data:${blob.type || "audio/webm"};base64,${base64}`;
}

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

export async function analyzeAudio({ blob, accent }) {
  const dataURL = await blobToDataURL(blob);

  const res = await fetch(API_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audio: dataURL,                 // base64 dataURL (matcher backend)
      mime: blob.type || "audio/webm",
      accent: accent || "us",
    }),
  });

  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.error || `Server error (${res.status})`);
  }

  return res.json(); // { transcript, accent, words }
}
