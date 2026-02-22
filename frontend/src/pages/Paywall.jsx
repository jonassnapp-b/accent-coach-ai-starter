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
function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function formatLongDate(d) {
  // “February 26” / “26. februar” afhænger af device locale
  return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(d);
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
const now = useMemo(() => new Date(), []);
const day5 = useMemo(() => addDays(now, 5), [now]);
const day7 = useMemo(() => addDays(now, 7), [now]);
const chargeDateLabel = useMemo(() => formatLongDate(day7), [day7]);

const selectedProduct = selected === "fluentup.pro.monthly" ? monthly : yearly;
const selectedPeriodLabel = selected === "fluentup.pro.monthly" ? "per month" : "per year";

const hasTrial = selected === "fluentup.pro.yearly";
const ctaLabel = loading ? "Working…" : hasTrial ? "Start 7-day trial" : "Subscribe monthly";

return (
  <div
  style={{
    height: "100vh",
    background: "#fff",
    display: "flex",
    flexDirection: "column",
  }}
>
    <div
  style={{
    width: "100%",
    maxWidth: 520,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    height: "100%",
  }}
>
    {/* TOP (sticky) */}
<div
  style={{
    position: "sticky",
    top: 0,
    background: "#fff",
    zIndex: 10,
    padding: 18,
    paddingTop: "calc(var(--safe-top) + 18px)",
  }}
>
  <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => (ret ? nav(ret) : nav(-1))}
          aria-label="Close"
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            border: "none",
            background: "rgba(0,0,0,0.06)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1, opacity: 0.55 }}>×</span>
        </button>
      </div>

      {/* title */}
    <h1
  style={{
    margin: "14px 0 22px",
    textAlign: "center",
    fontSize: 34,
    lineHeight: 1.1,
    fontWeight: 900,
    letterSpacing: -0.5,
    color: "#0B0B0B",
  }}
>
  {hasTrial ? (
    <>
      How your free
      <br />
      7-day trial works
    </>
  ) : (
    <>
      Go Premium
      <br />
      Choose a plan
    </>
  )}
</h1>
      </div>

      {/* MID (scroll) */}
<div
  style={{
    flex: 1,
    overflowY: "auto",
    padding: "0 18px",
  }}
>
{/* timeline */}
{/* timeline */}
{hasTrial ? (
  <div style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "6px 2px" }}>
    {/* left gradient bar */}
    <div style={{ width: 44, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: 28,
          height: 310,
          borderRadius: 999,
          background:
            "linear-gradient(180deg, #64B5F6 0%, #2196F3 40%, #1E88E5 70%, #1565C0 85%, rgba(21,101,192,0) 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 10,
            transform: "translateX(-50%)",
            width: 26,
            height: 26,
            borderRadius: 999,
            background: "rgba(255,255,255,0.35)",
            display: "grid",
            placeItems: "center",
            fontSize: 14,
          }}
        >
          🔒
        </div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 116,
            transform: "translateX(-50%)",
            width: 26,
            height: 26,
            borderRadius: 999,
            background: "rgba(255,255,255,0.35)",
            display: "grid",
            placeItems: "center",
            fontSize: 14,
          }}
        >
          🔔
        </div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 210,
            transform: "translateX(-50%)",
            width: 26,
            height: 26,
            borderRadius: 999,
            background: "rgba(255,255,255,0.35)",
            display: "grid",
            placeItems: "center",
            fontSize: 14,
          }}
        >
          ✓
        </div>
      </div>
    </div>

    {/* right text blocks */}
    <div style={{ flex: 1, paddingTop: 0 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#0B0B0B" }}>Today: Full access</div>
        <div style={{ marginTop: 6, fontSize: 16, lineHeight: 1.35, color: "rgba(0,0,0,0.70)" }}>
          Enjoy full access to all lessons and 8,000+ practice activities.
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#0B0B0B" }}>Day 5: Your trial is ending</div>
        <div style={{ marginTop: 6, fontSize: 16, lineHeight: 1.35, color: "rgba(0,0,0,0.70)" }}>
          We’ll remind you when your trial is about to end.
        </div>
      </div>

      <div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#0B0B0B" }}>Day 7: Subscription starts</div>
        <div style={{ marginTop: 6, fontSize: 16, lineHeight: 1.35, color: "rgba(0,0,0,0.70)" }}>
          You will be automatically charged on <b>{chargeDateLabel}</b>, unless you cancel at least 24 hours before.
        </div>
      </div>
    </div>
  </div>
) : (

  <div style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "6px 2px" }}>
    {/* left gradient bar */}
    <div style={{ width: 44, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: 28,
          height: 200,
          borderRadius: 999,
          background:
            "linear-gradient(180deg, #64B5F6 0%, #2196F3 50%, #1E88E5 80%, rgba(21,101,192,0) 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* icons */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 10,
            transform: "translateX(-50%)",
            width: 26,
            height: 26,
            borderRadius: 999,
            background: "rgba(255,255,255,0.35)",
            display: "grid",
            placeItems: "center",
            fontSize: 14,
          }}
        >
          ⚡
        </div>

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 98,
            transform: "translateX(-50%)",
            width: 26,
            height: 26,
            borderRadius: 999,
            background: "rgba(255,255,255,0.35)",
            display: "grid",
            placeItems: "center",
            fontSize: 14,
          }}
        >
          ✓
        </div>
      </div>
    </div>

    {/* right text blocks */}
    <div style={{ flex: 1, paddingTop: 0 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#0B0B0B" }}>
          Today: Instant access
        </div>
        <div style={{ marginTop: 6, fontSize: 16, lineHeight: 1.35, color: "rgba(0,0,0,0.70)" }}>
          Get full access immediately when you subscribe.
        </div>
      </div>

      <div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#0B0B0B" }}>
          Monthly renewal
        </div>
        <div style={{ marginTop: 6, fontSize: 16, lineHeight: 1.35, color: "rgba(0,0,0,0.70)" }}>
          Your subscription renews automatically each month until cancelled.
        </div>
      </div>
    </div>
  </div>
)}
      {/* plan select (Yearly / Monthly) */}
      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
     <PlanCard
  title="Yearly"
  badge="7-day free trial"
  price={yearly?.priceString || "—"}
  selected={selected === "fluentup.pro.yearly"}
  disabled={loading}
  onClick={() => setSelected("fluentup.pro.yearly")}
/>
<PlanCard
  title="Monthly"
  price={monthly?.priceString || "—"}
  selected={selected === "fluentup.pro.monthly"}
  disabled={loading}
  onClick={() => setSelected("fluentup.pro.monthly")}
/>
      </div>
      {/* price line */}
      <div style={{ textAlign: "center", marginTop: 18, marginBottom: 12 }}>
  <div style={{ fontSize: 18, color: "rgba(0,0,0,0.65)", fontWeight: 700 }}>
    {hasTrial ? "Redeem 7 days free, then" : "You'll be charged"}
  </div>

  <div style={{ fontSize: 28, fontWeight: 900, color: "#0B0B0B", letterSpacing: -0.4 }}>
    {selectedProduct?.priceString ? `${selectedProduct.priceString} ${selectedPeriodLabel}` : "—"}
  </div>

  {!hasTrial && (
    <div style={{ marginTop: 6, fontSize: 13, color: "rgba(0,0,0,0.55)", fontWeight: 700 }}>
      No free trial on monthly.
    </div>
  )}
</div>
</div>
   {/* BOTTOM (sticky) */}
<div
  style={{
    position: "sticky",
    bottom: 0,
    background: "#fff",
    padding: 18,
  }}
>
  <RemindRow />

      {/* CTA */}
      <button
        onClick={() => buy(selected)}
       disabled={ loading || (selected === "fluentup.pro.yearly" && !yearly) ||
  (selected === "fluentup.pro.monthly" && !monthly)
}
        style={{
          marginTop: 16,
          width: "100%",
          padding: "16px 18px",
          borderRadius: 999,
          border: "none",
          cursor:
  loading ||
  !isNative ||
  (selected === "fluentup.pro.yearly" && !yearly) ||
  (selected === "fluentup.pro.monthly" && !monthly)
    ? "not-allowed"
    : "pointer",   
           fontWeight: 900,
          fontSize: 20,
          color: "white",
          background: "linear-gradient(90deg, #F59E0B 0%, #EF4444 35%, #EC4899 100%)",
          boxShadow: "0 18px 40px rgba(236,72,153,0.25)",
          opacity:
  loading ||
  !isNative ||
  (selected === "fluentup.pro.yearly" && !yearly) ||
  (selected === "fluentup.pro.monthly" && !monthly)
    ? 0.55
    : 1,
        }}
      >
        {ctaLabel}
      </button>

     {hasTrial && (
  <div style={{ marginTop: 10, display: "flex", justifyContent: "center", gap: 10, alignItems: "center" }}>
    <span style={{ fontWeight: 900, color: "rgba(0,0,0,0.55)" }}>✓</span>
    <span style={{ fontWeight: 800, color: "rgba(0,0,0,0.55)" }}>No payment due now</span>
  </div>
)}
      {/* footer links */}
     <div
  style={{
    marginTop: 14,
    textAlign: "center",
    fontSize: 13,
    color: "rgba(0,0,0,0.55)",
    display: "flex",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
  }}
>
  <button
    onClick={() => restore()}
    disabled={loading || !isNative}
    style={{
      border: "none",
      background: "transparent",
      cursor: loading || !isNative ? "not-allowed" : "pointer",
      padding: 0,
      color: "rgba(0,0,0,0.65)",
      fontWeight: 700,
      textDecoration: "none",
    }}
  >
    Restore purchases
  </button>

  <span>·</span>

  <button
    type="button"
    onClick={() => nav("/terms")}
    style={{
      border: "none",
      background: "transparent",
      cursor: "pointer",
      padding: 0,
      color: "rgba(0,0,0,0.65)",
      fontWeight: 700,
      textDecoration: "none",
    }}
  >
    Terms
  </button>

  <span>·</span>

  <button
    type="button"
    onClick={() => nav("/privacy")}
    style={{
      border: "none",
      background: "transparent",
      cursor: "pointer",
      padding: 0,
      color: "rgba(0,0,0,0.65)",
      fontWeight: 700,
      textDecoration: "none",
    }}
  >
    Privacy
  </button>
</div>
</div>
      {/* debug (valgfrit) */}
   
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

function RemindRow() {
  const [on, setOn] = useState(false);

  return (
    <div
      style={{
        marginTop: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 6px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>🔔</span>
        <div style={{ fontWeight: 800, color: "rgba(0,0,0,0.70)" }}>Remind me before my trial ends</div>
      </div>

      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        aria-pressed={on}
        style={{
          width: 54,
          height: 32,
          borderRadius: 999,
          border: "none",
          background: on ? "rgba(34,197,94,0.95)" : "rgba(0,0,0,0.18)",
          position: "relative",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 3,
            left: on ? 26 : 3,
            width: 26,
            height: 26,
            borderRadius: 999,
            background: "white",
            boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
            transition: "left 160ms ease",
          }}
        />
      </button>
    </div>
  );
}