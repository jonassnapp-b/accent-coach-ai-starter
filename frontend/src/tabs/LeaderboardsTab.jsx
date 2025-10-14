import * as React from "react";

export default function LeaderboardsTab() {
  // safe fallbacks so first render never crashes
const [board, setBoard] = React.useState({ seasonId: "", players: [] });
const [stats, setStats] = React.useState({
  seasonId: "",
  me: { xp: 0, name: "You" },
  rank: 0,
  rankName: "Bronze",
  toNext: 0,
});
const [now, setNow] = React.useState(Date.now());
const [name, setName] = React.useState(getUserName());

React.useEffect(() => {
  const t = setInterval(() => setNow(Date.now()), 30_000);
  return () => clearInterval(t);
}, []);

React.useEffect(() => {
  try {
    setBoard(getLeaderboard());
    setStats(myStats());
  } catch (e) {
    console.error("Failed to load leaderboard", e);
  }
}, [now, name]);

const end = React.useMemo(() => seasonEndDateLocal(), []);
const timeLeft = fmtTimeLeft(end);


  const nextInfo = rankForPoints(stats?.me?.xp ?? 0);

  function handleSaveName(e) {
    e.preventDefault();
    setUserName((name || "").trim() || "You");
    try {
      setBoard(getLeaderboard());
      setStats(myStats());
    } catch (e2) {
      console.error("Reload after save failed", e2);
    }
  }

  // super-light loading state so we never render undefined structures
  const players = board?.players ?? [];

  return (
    <div className="panel">
      <h2>Leaderboards</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Your rank</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: nextInfo.color }}>
              {stats.rankName}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              XP this week: <b>{stats?.me?.xp ?? 0}</b>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
              {nextInfo.nextMin == null ? "Top rank reached" : `To next rank: ${stats.toNext} XP`}
            </div>
            <div style={{ height: 10, background: "#eee", borderRadius: 999 }}>
              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  width: (() => {
                    const cur = stats?.me?.xp ?? 0;
                    const curMin =
                      RANKS.find((r) => r.name === stats.rankName)?.min ?? 0;
                    const nextMin = nextInfo.nextMin ?? curMin + 5000;
                    const pct = Math.max(0, Math.min(1, (cur - curMin) / (nextMin - curMin)));
                    return `${pct * 100}%`;
                  })(),
                  background: nextInfo.color,
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Resets</div>
            <div>
              <b>{timeLeft}</b>
            </div>
          </div>

          <form onSubmit={handleSaveName} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name"
              style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 8 }}
            />
            <button className="btn">Save</button>
          </form>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>This week</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Top 10 reach the finals (example)</div>
        </div>

        {players.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>No players yet.</div>
        ) : (
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {players.slice(0, 20).map((p, i) => (
              <li
                key={p.id ?? i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 1fr 80px",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 10px",
                  borderTop: i === 0 ? "1px solid #eee" : "none",
                  borderBottom: "1px solid #eee",
                  background: p.name === name ? "rgba(0,0,0,0.02)" : "transparent",
                }}
              >
                <div style={{ opacity: 0.6 }}>{i + 1}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "#f2f2f2",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 12,
                    }}
                  >
                    {(p.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.name ?? "Unknown"}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {rankForPoints(p?.xp ?? 0).rankName}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right", fontWeight: 600 }}>{p?.xp ?? 0} XP</div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}