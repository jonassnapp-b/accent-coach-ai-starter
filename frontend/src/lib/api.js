// src/lib/api.js
export const USE_MOCK = false;

// 👉 Sørg for at IP'en passer til din lokale backend
const API_PATH = "http://192.168.1.189:3000/api/analyze-speech";

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// SAFE base64 conversion (fallback hvis multipart fejler)
async function blobToDataURL(blob) {
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error || new Error("readAsDataURL failed"));
    fr.readAsDataURL(blob);
  });
}

// src/lib/api.js
export async function analyzeAudio({ blob, accent }) {
  // build a dataURL so the backend can decode cleanly
  const dataURL = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result); // full data URL: data:<mime>;base64,....
    fr.onerror = () => reject(fr.error || new Error("readAsDataURL failed"));
    fr.readAsDataURL(blob);
  });

  // the scripted/target text (later: take from the exercise)
  const refText = "one two three";

  const res = await fetch("/api/analyze-speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audio: dataURL,       // <-- backend expects "audio"
      mime: blob.type || "", 
      accent,               // pass the selected accent
      refText,              // scripted target text
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Analyze failed (${res.status})`);
  }
  return await res.json();
}

