// src/components/ScoreRing.jsx
import React from "react";
import { Gem, Medal } from "lucide-react";

const TIERS = [
  { name: "Diamond", min: 95, color: "#60A5FA", Icon: Gem },      // blue
  { name: "Gold",    min: 90, color: "#F59E0B", Icon: Medal },    // gold
  { name: "Silver",  min: 75, color: "#9CA3AF", Icon: Medal },    // silver
  { name: "Bronze",  min: 0,  color: "#B45309", Icon: Medal },    // bronze
];

export default function ScoreRing({ score = 0, size = 72 }) {
  const tier = TIERS.find(t => score >= t.min) || TIERS[TIERS.length - 1];
  const pct = Math.max(0, Math.min(100, Math.round(score)));

  const ringStyle = {
    width: size, height: size, borderRadius: 9999,
    background: `conic-gradient(var(--accent,#FF9800) ${pct*3.6}deg, rgba(255,255,255,0.08) 0)`,
    boxShadow: "0 6px 14px rgba(0,0,0,.18)",
    display: "grid", placeItems: "center",
    border: "2px solid var(--panel-border)",
  };

  const innerStyle = {
    width: size-14, height: size-14, borderRadius: 9999,
    background: "var(--panel-bg)",
    color: "var(--panel-text)",
    display: "grid", placeItems: "center",
    fontWeight: 800,
  };

  const Icon = tier.Icon;
  return (
    <div className="flex items-center gap-3">
      <div style={ringStyle}>
        <div style={innerStyle}>{pct}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <Icon size={18} style={{ color: tier.color }} />
        <span className="font-semibold" style={{ color: "var(--panel-text)" }}>
          {tier.name}
        </span>
      </div>
    </div>
  );
}