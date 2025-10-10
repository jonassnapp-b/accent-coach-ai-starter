// src/lib/api.js

export const USE_MOCK = false; // <- slå mock fra nu, vi har backend

const API_PATH = '/api/analyze-speech';

export async function analyzeAudio({ blob, accent }) {
  // Blob -> base64 (dataURL)
  const audioBase64 = await blobToDataURL(blob);

  const res = await fetch(API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio: audioBase64,   // dataURL er ok; serveren stripper headeren
      mime: blob.type || 'audio/webm',
      accent: accent || 'us',
    }),
  });

  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.error || `Server error (${res.status})`);
  }
  return res.json();
}

async function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => resolve(fr.result);
    fr.readAsDataURL(blob);
  });
}

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}
