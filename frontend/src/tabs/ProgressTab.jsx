// frontend/src/tabs/ProgressTab.jsx
import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function ProgressTab({ userId = "demo-user" }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        setLoading(true);
        const res = await api.progress(userId);
        setData(res);
      } catch (e) {
        setErr("Could not load progress.");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  return (
    <div style={styles.card}>
      <h3>Progress</h3>
      <p style={{ marginTop: -6, color: "#667085" }}>
        Personalized learning plan + streaks & badges.
      </p>

      {loading && <div>Loading…</div>}
      {err && <div style={styles.error}>{err}</div>}

      {data && (
        <>
          <div style={styles.grid}>
            <div style={styles.box}>
              <div style={styles.kpiLabel}>Current streak</div>
              <div style={styles.kpiValue}>{data.streak || 0} days 🔥</div>
            </div>
            <div style={styles.box}>
              <div style={styles.kpiLabel}>Badges</div>
              <div>{(data.badges || []).join(" • ") || "—"}</div>
            </div>
          </div>

          {!!(data.plan || []).length && (
            <div style={styles.box}>
              <strong>Next week plan</strong>
              <ol style={{ margin: "8px 0 0 18px" }}>
                {data.plan.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {!!(data.attempts || []).length && (
            <div style={styles.box}>
              <strong>Recent attempts</strong>
              <ul style={{ margin: "8px 0 0 16px" }}>
                {data.attempts.map((a, i) => (
                  <li key={i}>
                    <code>{a.phrase}</code> — {a.score}/100
                    <span style={{ color: "#667085" }}> ({new Date(a.ts).toLocaleString()})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  card: { background: "#fff", border: "1px solid #EAECF0", borderRadius: 12, padding: 16 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 },
  box: { border: "1px solid #EAECF0", borderRadius: 8, padding: 12 },
  kpiLabel: { color: "#667085", fontSize: 12 },
  kpiValue: { fontSize: 22, fontWeight: 700, marginTop: 4 },
  error: {
    marginTop: 12,
    background: "#FEF2F2",
    border: "1px solid #FCA5A5",
    color: "#B91C1C",
    padding: 10,
    borderRadius: 8,
  },
};
