import React from "react";

export default function PaywallModal({ open, onClose, onUpgrade }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/50">
      <div className="w-[92%] max-w-md rounded-2xl p-5"
           style={{background:"var(--panel-bg)", border:"1px solid var(--panel-border)", color:"var(--panel-text)"}}>
        <h3 className="text-xl font-bold mb-2">Go Pro</h3>
        <p className="text-sm opacity-80 mb-4">
          Upgrade to Pro to unlock custom sentences & detailed feedback.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20">Not now</button>
          <button onClick={onUpgrade}
                  className="px-4 py-2 rounded-xl text-white"
                  style={{backgroundImage:"linear-gradient(90deg,#FF9800,#2196F3)"}}>
            Upgrade
          </button>
        </div>
      </div>
    </div>
  );
}
