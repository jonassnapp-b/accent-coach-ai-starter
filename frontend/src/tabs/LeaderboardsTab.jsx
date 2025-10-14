// src/tabs/LeaderboardsTab.jsx
import * as React from "react";
import {
  getLeaderboard,
  myStats,
  RANKS,
  rankForPoints,
  setUserName,
  getUserName,
} from "../lib/leaderboard";

// End-of-week (søndag 23:59:59 lokal tid)
function seasonEndDateLocal(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();               // 0 = søndag ... 6 = lørdag
  const toSunday = (7 - day) % 7;
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + toSunday);
  return end;
}

function fmtTimeLeft(to) {
  const ms = to - Date.now();
  if (ms <= 0) return "ends in 0s";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

export default function LeaderboardsTab() {
  // sikre defaults, så første render ikke crasher
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
  // Sikker players-liste (så .slice/.map aldrig crasher)
  const players = React.useMemo(
  () => (Array.isArray(board?.players) ? board.players : []),
  [board]
);


  // tick hver 30s (for timer) + ryd op
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // hent rigtige data
  React.useEffect(() => {
  try {
    const b = getLeaderboard();
    setBoard(b && Array.isArray(b.players) ? b : { seasonId: "", players: [] });

    const s = myStats();
    setStats(
      s && s.me
        ? s
        : { seasonId: "", me: { xp: 0, name: "You" }, rank: 0, rankName: "Bronze", toNext: 0 }
    );
  } catch (e) {
    console.error("Failed to load leaderboard", e);
    // behold fallback state – ingen crash
  }
}, [now, name]);


  const end = React.useMemo(() => seasonEndDateLocal(), []);
  const timeLeft = fmtTimeLeft(end);

  const nextInfo = rankForPoints(stats.me?.xp || 0);

  function handleSaveName(e) {
    e.preventDefault();
    setUserName(name?.trim() || "You");
    setBoard(getLeaderboard());
    setStats(myStats());
  }

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
              XP this week: <b>{stats.me?.xp ?? 0}</b>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
              {nextInfo.nextMin == null
                ? "Top rank reached"
                : `To next rank: ${stats.toNext} XP`}
            </div>
            <div style={{ height: 10, background: "#eee", borderRadius: 999 }}>
              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  width: (() => {
                    const cur = stats.me?.xp || 0;
                    const curMin = RANKS.find((r) => r.name === stats.rankName)?.min || 0;
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

        <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {players.slice(0, 20).map((p, i) => (
            <li
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr 80px",
                alignItems: "center",
                gap: 12,
                padding: "8px 10px",
                borderTop: i === 0 ? "1px solid #eee" : "none",
                borderBottom: "1px solid #eee",
                background:
                  p.name === name ||
                  (p.id.startsWith("u_") &&
                    i === board.players.findIndex((x) => x.id === p.id))
                    ? "rgba(0,0,0,0.02)"
                    : "transparent",
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
                  {p.name?.slice(0, 1)?.toUpperCase() || "?"}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{rankForPoints(p.xp).rankName}</div>
                </div>
              </div>
              <div style={{ textAlign: "right", fontWeight: 600 }}>{p.xp} XP</div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
