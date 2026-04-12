// src/pages/WeaknessLab.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Check, ChevronDown, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useSettings } from "../lib/settings-store.jsx";
import phonemeSentenceIndex from "../lib/phonemeSentenceIndex.json";
import { loadLocalPhonemeStats } from "../lib/localPhonemeStats.js";
import { Navigate, useLocation } from "react-router-dom";
import { useProStatus } from "../providers/PurchasesProvider.jsx";


/* ------------ API base (web + native) ------------ */
function isNative() {
  try {
    if (window?.Capacitor?.isNativePlatform) return Boolean(window.Capacitor.isNativePlatform());
  } catch {}
  return false;
}

function getApiBase() {
  try {
    const isViteLocal =
      typeof window !== "undefined" &&
      window.location.hostname === "localhost" &&
      String(window.location.port) === "5173";
    if (!isNative() && isViteLocal) return "http://localhost:3000";
  } catch {}

  const ls = (typeof localStorage !== "undefined" && localStorage.getItem("apiBase")) || "";
  const env = (import.meta?.env && import.meta.env.VITE_API_BASE) || "";

  let base = (ls || env || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/+$/, "");
  base = base.replace(/\/api\/?$/i, "");

  if (isNative()) {
    const nativeBase = (ls || env).replace(/\/+$/, "").replace(/\/api\/?$/i, "");
    if (!nativeBase) throw new Error("VITE_API_BASE (or localStorage.apiBase) is not set — required on iOS.");
    return nativeBase;
  }

  return base;
}

/* ------------ helpers ------------ */
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pctFromMaybe(avgOrPct) {
  if (avgOrPct == null) return null;
  const n = Number(avgOrPct);
  if (!isFinite(n)) return null;
  const v = n <= 1 ? n * 100 : n;
  return clamp(Math.round(v), 0, 100);
}

function formatPhoneme(p) {
  const s = String(p || "").trim();
  if (!s) return "";
  if (s.startsWith("/") && s.endsWith("/")) return s;
  return `/${s.replaceAll("/", "")}/`;
}

function phonemeColor(pct) {
  const v = clamp(Number(pct) || 0, 0, 100);
  if (v >= 85) return "rgba(27,138,58,0.95)";
  if (v >= 65) return "rgba(255,152,0,0.95)";
  return "rgba(211,47,47,0.92)";
}
// -------- Practice sentence bank (temporary local) --------
// Key format: raw phoneme like "TH", "R", "AE", "JH" (no slashes)
const PRACTICE_BANK = {
  TH: [
    "I think this is the best thing to do.",
    "Thank you for thinking about it.",
    "Three things are worth thinking through.",
    "The thought of it makes me smile.",
    "They threw the thing into the trash.",
    "This theory is tough to explain.",
    "I thought they were there already.",
    "That was the third time this month.",
    "I think the truth is out there.",
    "They thanked me for the thoughtful gift.",
  ],
  DH: [
    "This is the one that they chose.",
    "Those are the things that matter.",
    "They were there the whole time.",
    "That’s the idea they had.",
    "These are the days that feel long.",
    "I know that they did their best.",
    "Those people were there too.",
    "This is the way they do it.",
  ],
  R: [
    "I really want to improve my pronunciation.",
    "The red car is parked right there.",
    "Try to relax your tongue and breathe.",
    "The room is ready for recording.",
    "I heard the right word clearly.",
    "Bring the paper over here.",
  ],
  L: [
    "I like learning languages a lot.",
    "Please listen closely and repeat.",
    "Let’s look at the last line.",
    "I will follow the plan carefully.",
    "The little details matter.",
  ],
  AE: [
    "The cat sat back on the mat.",
    "That habit can happen fast.",
    "I had a bad day and felt sad.",
    "Pack the bag and catch the cab.",
    "The app had a crash and lagged.",
  ],
  IH: [
    "This is a bit tricky at first.",
    "I will sit and listen again.",
    "It fits in the middle of the sentence.",
    "Pick a simple sentence and repeat it.",
    "This is the tip I needed.",
  ],
  IY: [
    "I need to see the details clearly.",
    "Please repeat the key piece slowly.",
    "We keep the beat even and steady.",
    "Feel the vowel and keep it clean.",
  ],
  JH: [
    "I just joined a new project.",
    "John and Jane jumped in.",
    "The joke was gentle and short.",
    "I enjoy learning pronunciation.",
  ],
};



/* ------------ local “hide” with auto-unhide rules ------------ */
function hiddenKey() {
  return "ac_hidden_weakness_all";
}

function loadHiddenMap() {
  try {
    const raw = localStorage.getItem(hiddenKey());
    const obj = raw ? JSON.parse(raw) : {};
    if (!obj || typeof obj !== "object") return new Map();
    const m = new Map();
    for (const [k, v] of Object.entries(obj)) {
      if (!k) continue;
      const countAtHide = Number(v?.countAtHide ?? v?.count ?? 0) || 0;
      const pctAtHide = Number(v?.pctAtHide ?? v?.pct ?? 0) || 0;
      m.set(k, { countAtHide, pctAtHide });
    }
    return m;
  } catch {
    return new Map();
  }
}

function saveHiddenMap(map) {
  try {
    const obj = {};
    for (const [k, v] of map.entries()) obj[k] = v;
    localStorage.setItem(hiddenKey(), JSON.stringify(obj));
  } catch {}
}

function AccentDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);

  const options = [
    { value: "en_us", label: "American English", flag: "🇺🇸" },
    { value: "en_br", label: "British English", flag: "🇬🇧" },
  ];

  const current = options.find((o) => o.value === value) || options[0];

  return (
    <div className="relative">
      <button
  type="button"
  onClick={() => setOpen((v) => !v)}
  className="select-pill inline-flex items-center gap-2"
  title="Accent"
  style={{ background: "#2196F3", color: "white" }}
>

        <span className="text-base">{current.flag}</span>
        <span style={{ fontWeight: 800 }}>{current.label}</span>
        <ChevronDown className="h-4 w-4 opacity-70" />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 cursor-default"
            onClick={() => setOpen(false)}
            aria-label="Close"
          />

          <div
            className="absolute left-0 top-[calc(100%+8px)] z-50 w-[240px] rounded-xl border p-2 shadow-lg"
            style={{
              background: "rgba(35,35,35,0.96)",
              borderColor: "rgba(255,255,255,0.16)",
            }}
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left"
                  style={{
                    background: active ? "rgba(255,255,255,0.08)" : "transparent",
                    color: "white",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{opt.flag}</span>
                      <span className="font-semibold">{opt.label}</span>
                    </div>
                    {active && <Check className="h-4 w-4 opacity-90" />}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
function ScoreRing({ value = 0, size = 74, stroke = 10 }) {
  const v = clamp(Number(value) || 0, 0, 100);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#D9D9D9"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#2196F3"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontSize: 15,
          fontWeight: 900,
          color: "#6B7280",
        }}
      >
        {v}
      </div>
    </div>
  );
}

function SortPill({ value, onChange }) {
  const [open, setOpen] = useState(false);

  const options = [
    { value: "lowest", label: "Sort: Lowest score" },
    { value: "attempts", label: "Sort: Most attempts" },
    { value: "az", label: "Sort: A–Z" },
  ];

  const current = options.find((o) => o.value === value) || options[0];

 return (
  <div style={{ position: "relative" }}>
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      style={{
        border: "none",
        background: "transparent",
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        fontSize: 18,
        fontWeight: 800,
        color: "#0F172A",
        cursor: "pointer",
        lineHeight: 1.1,
      }}
    >
      <span>{current.label}</span>
      <ChevronDown className="h-5 w-5" strokeWidth={2.8} style={{ color: "#0F172A" }} />
    </button>

      {open && (
        <>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close sort menu"
            style={{
              position: "fixed",
              inset: 0,
              background: "transparent",
              border: "none",
              cursor: "default",
            }}
          />

          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              zIndex: 30,
              width: 240,
              borderRadius: 18,
              background: "#FFFFFF",
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 14px 30px rgba(0,0,0,0.14)",
              padding: 8,
            }}
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    minHeight: 48,
                    borderRadius: 14,
                    border: "none",
                    background: active ? "rgba(33,150,243,0.10)" : "transparent",
                    color: "#0F172A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 12px",
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  <span>{opt.label}</span>
                  {active ? <Check className="h-4 w-4" /> : null}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
export default function WeaknessLab() {
  const { isPro } = useProStatus();
  const location = useLocation();
const navigate = useNavigate();
  if (!isPro) {
  return (
  <div
    style={{
      minHeight: "100dvh",
      background: "#F3F3F3",
      color: "#0F172A",
      paddingBottom: "calc(120px + env(safe-area-inset-bottom, 0px))",
    }}
  >
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "#F3F3F3",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)",
      }}
    >
      <div
        style={{
          maxWidth: 860,
          margin: "0 auto",
          padding: "10px 20px 18px",
          position: "relative",
          minHeight: 92,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/practice")}
          aria-label="Back"
          style={{
            position: "absolute",
            left: 20,
            top: "50%",
            transform: "translateY(-50%)",
            width: 46,
            height: 46,
            borderRadius: 14,
            border: "none",
            background: "transparent",
            color: "#0F172A",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <ChevronLeft className="h-9 w-9" strokeWidth={2.6} />
        </button>

        <div
          style={{
            fontSize: 38,
            lineHeight: 1,
            fontWeight: 950,
letterSpacing: -1.4,
            color: "#000000",
            textAlign: "center",
          }}
        >
          Weakest sounds
        </div>
      </div>
    </div>

    <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 0 0" }}>
      <div
        style={{
          margin: "0 16px",
          background: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 30,
          boxShadow: "0 10px 26px rgba(0,0,0,0.08)",
          padding: "18px 18px 20px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16 }}>
          <SortPill value={sortBy} onChange={setSortBy} />

      <button
  onClick={resetHidden}
  disabled={hiddenCount === 0}
  title={hiddenCount === 0 ? "No hidden phonemes" : "Restore hidden phonemes"}
  style={{
    border: "none",
    background: "transparent",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    fontSize: 18,
    fontWeight: 800,
    color: hiddenCount === 0 ? "rgba(15,23,42,0.35)" : "#0F172A",
    cursor: hiddenCount === 0 ? "not-allowed" : "pointer",
    lineHeight: 1.1,
    whiteSpace: "nowrap",
flexShrink: 0,
  }}
>
  <span>Restore hidden{hiddenCount ? ` (${hiddenCount})` : ""}</span>
  <ChevronDown className="h-5 w-5" strokeWidth={2.8} style={{ color: hiddenCount === 0 ? "rgba(15,23,42,0.35)" : "#0F172A" }} />
</button>
        </div>
      </div>

      {err && (
        <div
          style={{
            margin: "18px 16px 0",
            borderRadius: 18,
            border: "1px solid rgba(229,72,77,0.20)",
            background: "rgba(229,72,77,0.08)",
            color: "#111827",
            padding: "14px 16px",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {err}
        </div>
      )}

      {loading && (
        <div style={{ marginTop: 18, display: "grid", gap: 14, padding: "0 16px" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 144,
                borderRadius: 28,
                background: "#FFFFFF",
                border: "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
              }}
            />
          ))}
        </div>
      )}

      {!loading && !err && normalized.length === 0 && (
        <div
          style={{
            margin: "18px 16px 0",
            borderRadius: 24,
            background: "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
            padding: "24px 18px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: "#111827",
            }}
          >
            No data yet
          </div>
        </div>
      )}

      {!loading && !err && normalized.length > 0 && (
        <div style={{ marginTop: 18, display: "grid", gap: 16, padding: "0 16px" }}>
          {normalized.map((w) => (
            <button
              key={`${w.rawPhoneme}-${w.count}-${w.pct}`}
              type="button"
              onClick={() => trainPhoneme(w.rawPhoneme)}
              style={{
                width: "100%",
                textAlign: "left",
                background: "#FFFFFF",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 28,
                boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                padding: "16px 18px",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
                  <ScoreRing value={w.pct} />

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 28,
                        lineHeight: 1,
                        fontWeight: 950,
                        letterSpacing: -0.8,
                        color: phonemeColor(w.pct),
                        marginBottom: 8,
                      }}
                    >
                      {w.phoneme}
                    </div>

                    <div
                      style={{
                        fontSize: 16,
                        lineHeight: 1.2,
                        color: "#6B7280",
                        fontWeight: 500,
                      }}
                    >
                      Attempts: {w.count}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      hidePhoneme(w.rawPhoneme, w.count, w.pct);
                    }}
                    title="Hide"
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 18,
                      border: "1px solid rgba(0,0,0,0.08)",
                      background: "#FFFFFF",
                      color: "#111827",
                      display: "grid",
                      placeItems: "center",
                      boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 className="h-6 w-6" />
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      trainPhoneme(w.rawPhoneme);
                    }}
                    title="Practice"
                    style={{
                      minWidth: 190,
                      height: 78,
                      borderRadius: 24,
                      border: "none",
                      background: "#2196F3",
                      color: "#FFFFFF",
                      fontSize: 18,
                      fontWeight: 900,
                      boxShadow: "0 8px 18px rgba(33,150,243,0.22)",
                      cursor: "pointer",
                      padding: "0 26px",
                    }}
                  >
                    Practice
                  </motion.button>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);
  }

  
  const { settings } = useSettings();

  const defaultAccent = (settings?.accentDefault || "en_us").toLowerCase();
  const [accent, setAccent] = useState(defaultAccent);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [sortBy, setSortBy] = useState("lowest"); // lowest | attempts | az
const [sortMenuOpen, setSortMenuOpen] = useState(false);
const [hiddenMap, setHiddenMap] = useState(() => loadHiddenMap());


async function load() {
  setErr("");
  setLoading(true);
  try {
    const base = getApiBase();
    const accents = ["en_us", "en_br"];

    const results = await Promise.all(
      accents.map(async (a) => {
        const url = `${base}/api/weakness?accent=${encodeURIComponent(a)}`;

        const r = await fetch(url, {
          method: "GET",
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });

        const json = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(json?.error || r.statusText || "Failed to load weakness data");

        // Backend returns: { topWeaknesses: [{label,count,avg}, ...] }
        const arr = Array.isArray(json?.topWeaknesses) ? json.topWeaknesses : [];

        // Convert to the shape your normalized() expects
        return arr.map((w) => ({
          phoneme: w?.label,
          avg: w?.avg,
          count: w?.count,
          accent: a,
          best: w?.best ?? w?.bestScore ?? null,
        }));
      })
    );

    setItems(results.flat());
  } catch (e) {
    setErr(e?.message || String(e));
    setItems([]);
  } finally {
    setLoading(false);
  }
}


useEffect(() => {
  load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

useEffect(() => {
  const onFocus = () => load();
  const onVis = () => {
    if (document.visibilityState === "visible") load();
  };
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVis);
  return () => {
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVis);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  const normalized = useMemo(() => {
    const mapped = (items || []).map((x) => {
      const phoneme = x?.phoneme ?? x?.label ?? x?.p ?? x?.symbol ?? x?.key ?? "";
      const count = x?.count ?? x?.n ?? x?.attempts ?? x?.total ?? 0;

      const bestRaw = x?.best ?? x?.bestScore ?? x?.max ?? x?.top ?? null;
      const avgRaw = x?.avg ?? x?.average ?? x?.mean ?? x?.score ?? x?.value ?? 0;

      const bestPct = pctFromMaybe(bestRaw);
      const avgPct = pctFromMaybe(avgRaw);
      const usedPct = bestPct != null ? bestPct : avgPct != null ? avgPct : 0;

      const itemAccent = String(x?.accent ?? x?.acc ?? x?.dialect ?? "").toLowerCase();

      return {
        phoneme: formatPhoneme(phoneme),
        rawPhoneme: String(phoneme || "").trim(),
        pct: usedPct,
        count: Number(count) || 0,
        accent: itemAccent,
      };
    });
    // ✅ Merge local Coach/Imitate stats so they also appear in WeaknessLab.
    // We still only show phonemes that have attempts (>0).
    const localUS = loadLocalPhonemeStats("en_us");
const localBR = loadLocalPhonemeStats("en_br");

    // Convert local stats to same shape as server items:
    // - rawPhoneme must match your keys (no slashes)
const localItems = [
  ...Object.entries(localUS || {}).map(([raw, v]) => {
    const count = Number(v?.count) || 0;
    const best = Number(v?.best) || 0;
    const avg = Number(v?.avg) || 0;
    const usedPct = best > 0 ? best : avg;

    return {
      phoneme: formatPhoneme(raw),
      rawPhoneme: String(raw || "").trim(),
      pct: clamp(Number(usedPct) || 0, 0, 100),
      count,
      accent: "en_us",
    };
  }),
  ...Object.entries(localBR || {}).map(([raw, v]) => {
    const count = Number(v?.count) || 0;
    const best = Number(v?.best) || 0;
    const avg = Number(v?.avg) || 0;
    const usedPct = best > 0 ? best : avg;

    return {
      phoneme: formatPhoneme(raw),
      rawPhoneme: String(raw || "").trim(),
      pct: clamp(Number(usedPct) || 0, 0, 100),
      count,
      accent: "en_br",
    };
  }),
];


    // Merge server + local, summing counts and keeping best score
    const mergedMap = new Map();
    for (const it of [...mapped, ...localItems]) {
      const k = String(it?.rawPhoneme || "").trim();
      if (!k) continue;

      const prev = mergedMap.get(k);
      if (!prev) {
        mergedMap.set(k, { ...it });
      } else {
        mergedMap.set(k, {
          ...prev,
          count: (Number(prev.count) || 0) + (Number(it.count) || 0),
          pct: Math.max(Number(prev.pct) || 0, Number(it.pct) || 0),
        });
      }
    }

    const merged = Array.from(mergedMap.values());

const byAccent = merged.filter((m) => {
  if (!m.phoneme) return false;
  if ((Number(m.count) || 0) <= 0) return false; // ✅ only phonemes with attempts
  return true; // show across accents
});



    let didAutoUnhide = false;
    const nextHidden = new Map(hiddenMap);

    const visible = byAccent.filter((m) => {
      const h = nextHidden.get(m.rawPhoneme);
      if (!h) return true;

      const hasNewAttempts = (m.count || 0) > (h.countAtHide || 0);
      const sameOrWorse = (m.pct || 0) <= (h.pctAtHide || 0);

      if (hasNewAttempts && sameOrWorse) {
        nextHidden.delete(m.rawPhoneme);
        didAutoUnhide = true;
        return true;
      }

      return false;
    });

    if (didAutoUnhide) {
      setTimeout(() => {
        setHiddenMap(nextHidden);
        saveHiddenMap(nextHidden);
      }, 0);
    }
// Only show weak sounds (hide green)
const weakOnly = visible.filter((m) => (Number(m.pct) || 0) < 85);

const sorted = [...weakOnly];
    if (sortBy === "attempts") sorted.sort((a, b) => b.count - a.count || a.pct - b.pct);
    else if (sortBy === "az") sorted.sort((a, b) => a.rawPhoneme.localeCompare(b.rawPhoneme));
    else sorted.sort((a, b) => a.pct - b.pct || b.count - a.count);

    return sorted.slice(0, 40);
  }, [items, accent, hiddenMap, sortBy]);
function getPracticeQueueForPhoneme(rawPhoneme) {
  const p = String(rawPhoneme || "").trim().toUpperCase().replaceAll("/", "");

  const indexed = phonemeSentenceIndex?.[p];
  if (Array.isArray(indexed) && indexed.length) {
    return indexed.slice(0, 15);
  }

  // last resort (should basically never happen if your index has all CMU phonemes)
  return [
    `Focus on ${p}. Say ${p} clearly three times.`,
    `Repeat ${p} again, slowly.`,
    `Keep ${p} consistent.`,
    `Now try ${p} one more time.`,
    `Final rep: ${p}.`,
  ];
}




function trainPhoneme(rawPhoneme) {
  const queue = getPracticeQueueForPhoneme(rawPhoneme);

  // Optional: keep for debugging/analytics
  try {
    sessionStorage.setItem("ac_weakness_focus_phoneme", String(rawPhoneme || ""));
  } catch {}

  navigate("/imitate", {
    state: {
      practiceQueue: queue,
      startIndex: 0,
      focusPhoneme: String(rawPhoneme || ""),
      accent,
    },
  });
}

  function hidePhoneme(rawPhoneme, countNow = 0, pctNow = 0) {
    const p = String(rawPhoneme || "").trim();
    if (!p) return;

    setHiddenMap((prev) => {
      const next = new Map(prev);
      next.set(p, {
        countAtHide: Number(countNow) || 0,
        pctAtHide: Number(pctNow) || 0,
      });
      saveHiddenMap(next);
      return next;
    });
  }

  function resetHidden() {
    const empty = new Map();
    setHiddenMap(empty);
    saveHiddenMap(empty);
  }

  const hiddenCount = hiddenMap.size;

  return (
    <div className="page">
  <div className="mx-auto w-full max-w-[720px]">
{/* Fixed header (match Settings Sheet design) */}
<div
  style={{
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    background: "#FFFFFF",
    paddingTop: "var(--safe-top)",
  }}
>
  <div
    style={{
      maxWidth: 720,
      margin: "0 auto",
      padding: "0 16px 24px",
    }}
  >
    <div
      style={{
        position: "sticky",
        top: 0,
        background: "#FFFFFF",
        zIndex: 2,
        paddingTop: 12,
        paddingBottom: 18,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "44px 1fr 44px",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/practice")}
          style={{
            width: 44,
            height: 44,
            border: "none",
            background: "transparent",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <ChevronLeft className="h-8 w-8" style={{ color: "#111827" }} />
        </button>

       <div
  style={{
    textAlign: "center",
    fontSize: 34,
    lineHeight: 1.05,
    fontWeight: 900,
    color: "#000",
    whiteSpace: "nowrap",
  }}
>
  Weakest sounds
</div>

        <div />
      </div>
    </div>
  </div>
</div>

{/* Spacer so content doesn't go under fixed header */}
<div style={{ height: "calc(var(--safe-top) + 28px)" }} />





{/* Controls */}
<div
  style={{
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 24,
    padding: "0 4px",
    flexWrap: "nowrap",
  }}
>
  <div style={{ position: "relative", flex: "0 1 auto" }}>
    <button
      type="button"
      onClick={() => setSortMenuOpen((v) => !v)}
      title="Sort"
      style={{
        border: "none",
        background: "transparent",
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        fontSize: 18,
        fontWeight: 800,
        color: "#0F172A",
        cursor: "pointer",
        lineHeight: 1.1,
        boxShadow: "none",
      }}
    >
      <span>
        {sortBy === "lowest"
          ? "Sort: Lowest score"
          : sortBy === "attempts"
          ? "Sort: Most attempts"
          : "Sort: A–Z"}
      </span>
      <ChevronDown className="h-5 w-5" strokeWidth={2.8} style={{ color: "#0F172A" }} />
    </button>

    {sortMenuOpen && (
      <>
        <button
          type="button"
          onClick={() => setSortMenuOpen(false)}
          aria-label="Close sort menu"
          style={{
            position: "fixed",
            inset: 0,
            background: "transparent",
            border: "none",
            cursor: "default",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 30,
            width: 240,
            borderRadius: 18,
            background: "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 14px 30px rgba(0,0,0,0.14)",
            padding: 8,
          }}
        >
          {[
            { value: "lowest", label: "Sort: Lowest score" },
            { value: "attempts", label: "Sort: Most attempts" },
            { value: "az", label: "Sort: A–Z" },
          ].map((opt) => {
            const active = opt.value === sortBy;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setSortBy(opt.value);
                  setSortMenuOpen(false);
                }}
                style={{
                  width: "100%",
                  minHeight: 48,
                  borderRadius: 14,
                  border: "none",
                  background: active ? "rgba(33,150,243,0.10)" : "transparent",
                  color: "#0F172A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 12px",
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                <span>{opt.label}</span>
                {active ? <Check className="h-4 w-4" /> : null}
              </button>
            );
          })}
        </div>
      </>
    )}
  </div>

  <button
  onClick={resetHidden}
  disabled={hiddenCount === 0}
  title={hiddenCount === 0 ? "No hidden phonemes" : "Restore hidden phonemes"}
  style={{
    border: "none",
    background: "transparent",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    fontSize: 18,
    fontWeight: 800,
    color: hiddenCount === 0 ? "rgba(15,23,42,0.35)" : "#0F172A",
    cursor: hiddenCount === 0 ? "not-allowed" : "pointer",
    lineHeight: 1.1,
    boxShadow: "none",
  }}
>
  <span>Restore hidden{hiddenCount ? ` (${hiddenCount})` : ""}</span>
</button>
</div>

        {/* Divider */}
        <div className="mt-6 h-px w-full" style={{ background: "var(--panel-border)" }} />

        {/* Error */}
        {err && (
          <div
            className="mt-5 rounded-xl px-4 py-3 text-sm"
            style={{
              background: "rgba(229,72,77,0.10)",
              border: "1px solid rgba(229,72,77,0.25)",
              color: "var(--text)",
            }}
          >
            {err}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-5 space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-[56px] rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />
            ))}
          </div>
        )}

{/* Empty */}
{!loading && !err && normalized.length === 0 && (
  <div className="panel mt-6 text-center">
    <div className="text-[16px] font-extrabold" style={{ color: "var(--text)" }}>
      No data yet
    </div>
  </div>
)}


        {/* List */}
{!loading && !err && normalized.length > 0 && (
  <div className="mt-5 space-y-3">
    {normalized.map((w) => (
      <button
        key={`${w.rawPhoneme}-${w.count}-${w.pct}`}
        onClick={() => trainPhoneme(w.rawPhoneme)}
        className="w-full text-left rounded-2xl border px-4 py-3 shadow-sm"
        style={{
          outline: "none",
          borderColor: "var(--panel-border)",
          background: "#ffffff",
        }}
      >
        <div className="flex items-center justify-between gap-4">
          {/* Left */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <ScoreRing value={w.pct} />
              <div
                className="absolute inset-0 grid place-items-center text-[11px] font-extrabold"
                style={{ color: "var(--muted)" }}
              >
                {w.pct}
              </div>
            </div>

            <div>
              <div className="text-[18px] font-extrabold tracking-tight" style={{ color: phonemeColor(w.pct) }}>
                {w.phoneme}
              </div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>
                Attempts: {w.count}
              </div>
            </div>
          </div>

          {/* Right: trash + Train button */}
          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                hidePhoneme(w.rawPhoneme, w.count, w.pct);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm"
              title="Hide"
              style={{
                borderColor: "var(--panel-border)",
                background: "var(--panel)",
              }}
            >
              <Trash2 className="h-4 w-4" />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                trainPhoneme(w.rawPhoneme);
              }}
              className="inline-flex h-9 items-center justify-center rounded-xl px-4 text-sm font-semibold shadow-sm"
              style={{
                background: "var(--primary)",
                color: "white",
              }}
           title="Practice"
>
  Practice
</motion.button>

          </div>
        </div>
      </button>
    ))}
  </div>
)}
      </div>
    </div>
  );
}
