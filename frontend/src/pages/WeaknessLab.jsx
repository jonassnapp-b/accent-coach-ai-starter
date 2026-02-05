// src/pages/WeaknessLab.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Check, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { useSettings } from "../lib/settings-store.jsx";
import phonemeSentenceIndex from "../lib/phonemeSentenceIndex.json";
import { loadLocalPhonemeStats } from "../lib/localPhonemeStats.js";


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

/* ------------ minimal ring (theme-safe) ------------ */
function Ring({ value = 0, size = 34, stroke = 6 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = clamp(Number(value) || 0, 0, 100);
  const dash = (v / 100) * c;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Score ${v}%`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--panel-border)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

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

export default function WeaknessLab() {
  const navigate = useNavigate();
  const { settings } = useSettings();

  const defaultAccent = (settings?.accentDefault || "en_us").toLowerCase();
  const [accent, setAccent] = useState(defaultAccent);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [sortBy, setSortBy] = useState("lowest"); // lowest | attempts | az
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

        let arr = [];
        if (Array.isArray(json)) arr = json;
        else if (Array.isArray(json?.items)) arr = json.items;
        else if (Array.isArray(json?.topWeaknesses)) {
          arr = json.topWeaknesses.map((w) => ({
            phoneme: w?.label,
            avg: w?.avg,
            count: w?.count,
            accent: a,
            best: w?.best ?? w?.bestScore ?? null,
          }));
        }

        // ensure accent is present on each item
        return arr.map((x) => ({ ...x, accent: String(x?.accent || a).toLowerCase() }));
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
  <div className="mx-auto w-full max-w-[820px]">
    <div style={{ padding: "14px 16px 8px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
        <div />
        <div style={{ textAlign: "center", fontWeight: 900, fontSize: 18, color: "var(--text)" }}>
          Train your weakest sounds
        </div>
        <div />
      </div>
    </div>





        {/* Controls */}
        <div className="panel mt-4">
          <div className="flex flex-wrap items-center gap-2">
            
            <select
  value={sortBy}
  onChange={(e) => setSortBy(e.target.value)}
  className="select-pill"
  title="Sort"
  style={{ background: "#2196F3", color: "white", fontWeight: 800 }}
>
              <option value="lowest">Sort: Lowest score</option>
              <option value="attempts">Sort: Most attempts</option>
              <option value="az">Sort: A–Z</option>
            </select>

            <div className="flex-1" />

           <button
  onClick={resetHidden}
  disabled={hiddenCount === 0}
  className="btn btn-ghost btn-sm"
  title={hiddenCount === 0 ? "No hidden phonemes" : "Restore hidden phonemes"}
  style={{
    background: "#2196F3",
    color: "white",
    opacity: hiddenCount === 0 ? 0.5 : 1,
  }}
>

              Restore hidden{hiddenCount ? ` (${hiddenCount})` : ""}
            </button>
          </div>
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
              <Ring value={w.pct} />
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
