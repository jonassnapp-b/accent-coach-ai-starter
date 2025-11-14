// src/components/GameHUD.jsx
import React, { useEffect, useState } from "react";
import { readState, xpProgress01, ensureDailyQuests } from "../lib/progression.js";
import { Trophy, Coins } from "lucide-react";

export default function GameHUD() {
  const [state, setState] = useState(readState());
  const [xp, setXP] = useState(xpProgress01());

  useEffect(() => {
    ensureDailyQuests();
    const i = setInterval(() => { setState(readState()); setXP(xpProgress01()); }, 800);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="hud">
      <div className="level">
        <div className="ring">{state.lvl}</div>
        <div className="xpbar"><span style={{["--pct"]: `${Math.round(xp.pct*100)}%`}} /></div>
        <div className="muted tiny">XP {xp.have}/{xp.need}</div>
      </div>
      <div className="coins">
        <Coins className="ico" /><b>{state.coins}</b>
      </div>
      <a href="/bookmarks" className="hud-link"><Trophy className="ico" />Quests</a>
    </div>
  );
}
