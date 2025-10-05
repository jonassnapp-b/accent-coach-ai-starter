// frontend/src/tabs/SocialTab.jsx
import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function SocialTab() {
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shareURL, setShareURL] = useState("");
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        setLoading(true);
        const res = await api.leaderboard();
        setBoard(res.leaderboard || []);
      } catch (e) {
        setErr("Could not load leaderboard.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function doShare() {
    try {
      setErr(null);
      const res = await api.share({ clipId: "demo-clip-123" });
      setShareURL(res.url || "");
      if (res.url && navigator.clipboard) {
        await navigator.clipboard.writeText(res.url);
      }
    } catch (e) {
      setErr("Could not create share link.");
    }
  }

  return (
    <div style={styles.card}>
      <h3>Social</h3>
      <p style={{ marginTop: -6, color: "#667085" }}>
        Leaderboards + share progress clips.
      </p>

      <div style={styles.box}>
        <strong>Leaderboard</strong>
        {loading ? (
          <div>Loading…</div>
        ) : err ? (
          <div style={styles.error}>{err}</div>
        ) : (
          <ol style={{ margin: "8px 0 0 18px" }}>
            {board.map((row, i) => (
              <li key={i}>
                {row.name} — {row.score}/100
              </li>
            ))}
          </ol>
        )}
      </div>

      <div style={styles.box}>
        <strong>Share progress</strong>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button style={styles.primaryBtn} onClick={doShare}>
            Create share link
          </button>
          {shareURL ? (
            <input value={shareURL} readOnly style={styles.input} />
          ) : null}
        </div>
        <div style={{ color: "#667085", marginTop: 6 }}>
          (Link is copied to clipboard automatically.)
        </div>
      </div>
    </div>
  );
}

const styles = {
  card: { background: "#fff", border: "1px solid #EAECF0", borderRadius: 12, padding: 16 },
  box: { border: "1px solid #EAECF0", borderRadius: 8, padding: 12, marginTop: 12 },
  input: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #D0D5DD",
    fontSize: 13,
  },
  primaryBtn: {
    background: "#1D4ED8",
    color: "#fff",
    border: 0,
    borderRadius: 8,
    padding: "10px 14px",
    cursor: "pointer",
  },
  error: {
    marginTop: 8,
    background: "#FEF2F2",
    border: "1px solid #FCA5A5",
    color: "#B91C1C",
    padding: 10,
    borderRadius: 8,
  },
};
