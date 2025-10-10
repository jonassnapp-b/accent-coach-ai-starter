// src/lib/api.js
// Simpelt API-lag, som Record.jsx kalder: analyzeAudio({ blob, accent }).

const USE_MOCK = true; // LAD DEN VÆRE true indtil vi laver en rigtig backend

export async function analyzeAudio({ blob, accent }) {
  if (!blob) throw new Error("No audio blob provided");

  if (USE_MOCK) {
    // Simuleret svar – så UI virker uden backend
    await new Promise((r) => setTimeout(r, 600));
    return {
      transcript: "This is a mocked transcript.",
      words: [
        { w: "This", score: 0.95 },
        { w: "is", score: 0.88 },
        { w: "a", score: 0.8 },
        { w: "mocked", score: 0.72 },
        { w: "transcript.", score: 0.9 },
      ],
      phonemes: [
        { ph: "TH", score: 0.91 },
        { ph: "IH", score: 0.82 },
        { ph: "S", score: 0.76 },
      ],
    };
  }

  // RIGTIG backend (når vi har en route):
  const fd = new FormData();
  fd.append("audio", blob, "recording.webm");
  if (accent) fd.append("accent", accent);

  const res = await fetch("/api/analyze-speech", { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Analyze failed: ${res.status} ${text}`);
  }
  return await res.json();
}
