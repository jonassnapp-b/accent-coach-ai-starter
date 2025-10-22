// frontend/src/pages/Record.jsx
import React, { useState } from "react";

export default function Record() {
  const [audioUrl, setAudioUrl] = useState(null);
  const [target, setTarget] = useState("");
  const [accent, setAccent] = useState("en_us");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAudioUpload = async (audioBlob) => {
    const fd = new FormData();
    fd.append("audio", audioBlob, "clip.wav");
    fd.append("refText", target);
    fd.append("accent", accent);

    setLoading(true);
    try {
      const res = await fetch("/api/analyze-speech", { method: "POST", body: fd });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      alert("Error analyzing speech");
    }
    setLoading(false);
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Record</h2>

      <div className="space-y-4">
        <div>
          <label className="block font-medium">Accent</label>
          <select
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="en_us">American English (US)</option>
            <option value="en_br">British English (UK)</option>
          </select>
        </div>

        <div>
          <label className="block font-medium">Target text</label>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Type a word..."
            className="border p-2 rounded w-full"
          />
        </div>

        <div className="flex items-center gap-2">
          <button className="bg-blue-500 text-white px-4 py-2 rounded">
            Hold to record
          </button>
          <button className="bg-gray-300 px-3 py-2 rounded" onClick={() => setResult(null)}>
            Reset
          </button>
        </div>
      </div>

      {loading && <p className="mt-6 text-blue-500">Analyzing...</p>}

      {result && !loading && (
        <div className="mt-6 border-t pt-4">
          <h3 className="text-xl font-bold mb-2">Phoneme feedback</h3>
          <p>
            <strong>Transcript:</strong> {result.transcript}
          </p>
          <p className="text-4xl font-bold text-green-600">{result.overallAccuracy}%</p>
          <p>
            <strong>Overall:</strong> {result.overallAccuracy}%
          </p>

          {result.words.map((w) => (
            <div key={w.word}>
              <p>
                {w.word} — {w.accuracyScore}%
              </p>
              <div className="flex gap-2">
                {w.phonemes.map((p) => (
                  <span
                    key={p.ph}
                    className={`text-sm ${
                      p.accuracyScore >= 80
                        ? "text-green-600"
                        : p.accuracyScore >= 50
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    /{p.ph}/ {p.accuracyScore}%
                  </span>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-4">
            <h4 className="font-semibold mb-2">Focus tips</h4>
            {result.words.flatMap((w) =>
              w.phonemes
                .filter((p) => p.accuracyScore < 70)
                .map((p) => (
                  <p key={p.ph}>
                    /{p.ph}/ — Practice this sound slowly in isolation, then say the word again focusing on tongue and airflow.
                  </p>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
