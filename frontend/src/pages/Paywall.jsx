// src/pages/Paywall.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePurchases } from "../providers/PurchasesProvider";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function getPaywallCopy(src) {
  switch (src) {
    case "level_locked":
      return {
        title: "Unlock Levels 2–10",
        subtitle: "Get full access to all scenarios across all levels.",
      };
    case "challenge_locked":
      return {
        title: "Unlock Daily Challenge",
        subtitle: "Train with harder drills and faster progress.",
      };
    case "practice_limit":
      return {
        title: "Unlock Unlimited Practice",
        subtitle: "Free users get 3 practice attempts/day. Go Premium for unlimited.",
      };
    case "weakest_locked":
      return {
        title: "Train Your Weakest Sounds",
        subtitle: "Get targeted drills for the sounds you struggle with.",
      };
    case "bookmarks_locked":
      return {
        title: "Unlock Bookmarks",
        subtitle: "Save your best exercises and revisit them anytime.",
      };
    case "settings":
    default:
      return {
        title: "FluentUp Premium",
        subtitle: "Unlock all levels + advanced accent training.",
      };
  }
}

export default function Paywall() {
  const nav = useNavigate();
  const q = useQuery();

  const src = q.get("src") || "settings";
  const ret = q.get("return") || ""; // optional
  const copy = getPaywallCopy(src);

  const { loading, products, isPro, buy, restore, lastError, isNative, refresh } = usePurchases();
  const [selected, setSelected] = useState("fluentup.pro.yearly");

  const byId = useMemo(() => {
    const m = new Map();
    for (const p of products || []) m.set(p.id, p);
    return m;
  }, [products]);

  const yearly = byId.get("fluentup.pro.yearly");
  const monthly = byId.get("fluentup.pro.monthly");

  // Auto-close når Pro bliver true
  useEffect(() => {
    if (!isPro) return;
    if (ret) {
      nav(ret, { replace: true });
    } else {
      nav(-1);
    }
  }, [isPro, nav, ret]);

  return (
    <div style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>{copy.title}</h1>
          <p style={{ marginTop: 8, opacity: 0.8 }}>{copy.subtitle}</p>
        </div>
        <button onClick={() => (ret ? nav(ret) : nav(-1))} style={{ padding: "8px 10px" }}>
          Close
        </button>
      </div>

      <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.04)" }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Premium includes:</div>
        <ul style={{ margin: 0, paddingLeft: 18, opacity: 0.9, lineHeight: 1.5 }}>
          <li>Unlock all levels (2–10)</li>
          <li>Daily Challenge mode</li>
          <li>Unlimited practice attempts</li>
          <li>Train your weakest sounds</li>
          <li>Bookmarks</li>
        </ul>
      </div>

      {!!lastError && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid rgba(255,0,0,0.35)" }}>
          <b>Error:</b> {lastError}
        </div>
      )}

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        <PlanCard
          title="Yearly"
          badge="Best value"
          price={yearly?.priceString || "—"}
          selected={selected === "fluentup.pro.yearly"}
          disabled={loading || !yearly}
          onClick={() => setSelected("fluentup.pro.yearly")}
        />
        <PlanCard
          title="Monthly"
          price={monthly?.priceString || "—"}
          selected={selected === "fluentup.pro.monthly"}
          disabled={loading || !monthly}
          onClick={() => setSelected("fluentup.pro.monthly")}
        />
      </div>

      <button
        onClick={() => buy(selected)}
        disabled={loading || !isNative || (selected === "fluentup.pro.yearly" && !yearly) || (selected === "fluentup.pro.monthly" && !monthly)}
        style={{
          marginTop: 14,
          width: "100%",
          padding: "12px 14px",
          borderRadius: 12,
          fontWeight: 800,
        }}
      >
        {loading ? "Working…" : "Start Premium"}
      </button>

      <button
        onClick={() => restore()}
        disabled={loading || !isNative}
        style={{
          marginTop: 10,
          width: "100%",
          padding: "10px 14px",
          borderRadius: 12,
          opacity: 0.9,
        }}
      >
        Restore Purchases
      </button>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", opacity: 0.75, fontSize: 12 }}>
        <a href="/terms" target="_blank" rel="noreferrer">Terms</a>
        <a href="/privacy" target="_blank" rel="noreferrer">Privacy</a>
        <button
          type="button"
          onClick={() => refresh()}
          style={{ fontSize: 12, padding: 0, border: "none", background: "transparent", textDecoration: "underline", cursor: "pointer" }}
        >
          Reload products
        </button>
      </div>

      <div style={{ marginTop: 10, opacity: 0.6, fontSize: 12 }}>
        Debug: native={String(isNative)} • products={products?.length ?? 0}
      </div>
    </div>
  );
}

function PlanCard({ title, price, badge, selected, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        textAlign: "left",
        padding: 12,
        borderRadius: 14,
        border: selected ? "2px solid rgba(0,0,0,0.8)" : "1px solid rgba(0,0,0,0.12)",
        opacity: disabled ? 0.55 : 1,
        background: "white",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <b>{title}</b>
            {!!badge && (
              <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "rgba(0,0,0,0.06)" }}>
                {badge}
              </span>
            )}
          </div>
          <div style={{ marginTop: 4, opacity: 0.75, fontSize: 13 }}>
            Cancel anytime in Apple subscriptions.
          </div>
        </div>
        <div style={{ fontWeight: 800 }}>{price}</div>
      </div>
    </button>
  );
}
