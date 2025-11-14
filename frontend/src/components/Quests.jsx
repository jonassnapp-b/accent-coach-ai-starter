import React, { useEffect, useState } from "react";
import { ensureDailyQuests, tickQuest, claimQuest } from "../lib/progression.js";

export default function Quests() {
  const [qs, setQs] = useState([]);
  useEffect(() => setQs(ensureDailyQuests()), []);
  function pct(q){ return Math.round((q.cur / q.goal) * 100); }
  function doClaim(id){ const { ok } = claimQuest(id); setQs(ensureDailyQuests()); if (ok) window.dispatchEvent(new Event("quest-claimed")); }

  return (
    <div className="quest-panel">
      <div className="qtitle">Daily Quests</div>
      {qs.map(q => (
        <div key={q.id} className={`quest ${q.done ? "done": ""}`}>
          <div className="qname">{q.name}</div>
          <div className="qtrack"><span style={{["--pct"]:`${pct(q)}%`}}/></div>
          <div className="qmeta">{q.cur}/{q.goal} • +{q.rewardXP} XP • +{q.rewardCoins} 🪙</div>
          <button className="btn-claim" disabled={!(q.cur>=q.goal) || q.done} onClick={()=>doClaim(q.id)}>
            {q.done ? "Claimed" : "Claim"}
          </button>
        </div>
      ))}
    </div>
  );
}

// Husk at kalde tickQuest(...) fra dine flows (fx efter en recording)
