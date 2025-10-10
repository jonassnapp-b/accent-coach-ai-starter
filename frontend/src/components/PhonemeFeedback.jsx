// src/components/PhonemeFeedback.jsx
export default function PhonemeFeedback({ result }) {
  if (!result) return null;

  const color = (s) => {
    if (s >= 0.9) return "#1fab6b"; // grøn
    if (s >= 0.8) return "#22c55e"; // lys-grøn
    if (s >= 0.7) return "#f59e0b"; // amber
    return "#ef4444";              // rød
  };

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <h3>Transkript</h3>
      <p style={{ marginTop: 8 }}>{result.transcript || "—"}</p>

      <h3 style={{ marginTop: 24 }}>Phoneme feedback</h3>
      <div className="phoneme-row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(result.phonemes || []).map((ph, i) => (
          <div
            key={i}
            className="phoneme-chip"
            style={{
              border: "2px solid " + color(ph.score),
              padding: "6px 10px",
              borderRadius: 8,
            }}
          >
            <strong>{ph.ph}</strong>{" "}
            <span style={{ color: color(ph.score) }}>
              {Math.round(ph.score * 100)}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
