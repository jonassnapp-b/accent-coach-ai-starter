// src/components/PhonemeFeedback.jsx
export default function PhonemeFeedback({ result }) {
  if (!result) return null;

  const scoreColor = (s) => {
    if (s >= 0.9) return "#14b8a6"; // teal
    if (s >= 0.8) return "#22c55e"; // green
    if (s >= 0.7) return "#f59e0b"; // amber
    return "#ef4444"; // red
  };

  return (
    <section className="panel">
      <h3>Transcript</h3>
      <p style={{marginTop: 8}}>{result.transcript || "—"}</p>

      <h3 style={{marginTop: 24}}>Phoneme feedback</h3>
      {result.words?.map((w, i) => (
        <div key={i} className="word-block">
          <div className="word-head">
            <strong>{w.word}</strong>
            <span style={{color: scoreColor(w.score)}}>score: {(w.score*100).toFixed(0)}%</span>
          </div>

          <div className="phoneme-row">
            {w.phonemes?.map((ph, j) => (
              <div key={j} className="phoneme-chip" style={{borderColor: scoreColor(ph.score)}}>
                <span>{ph.p}</span>
                <small style={{color: scoreColor(ph.score)}}>{(ph.score*100).toFixed(0)}%</small>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
