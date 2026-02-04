// src/pages/Practice.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Mic, Target, Bookmark } from "lucide-react";
import { getBookmarks } from "../lib/bookmarks";

export default function Practice() {
  const nav = useNavigate();

  // Keep it aligned with Record (record input maxLength=220 in Record.jsx)
  const MAX_LEN = 220;

  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(() => {
  try {
    const items = getBookmarks();
    return Array.isArray(items) ? items.length : 0;
  } catch {
    return 0;
  }
});

useEffect(() => {
  const refresh = () => {
    try {
      const items = getBookmarks();
      setBookmarkCount(Array.isArray(items) ? items.length : 0);
    } catch {
      setBookmarkCount(0);
    }
  };

  const onStorage = (e) => {
    if (e.key === "ac_bookmarks_v1" || e.key === "ac_bookmarks") refresh();
  };

  const onFocus = () => refresh();
  const onVis = () => {
    if (document.visibilityState === "visible") refresh();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVis);

  // initial
  refresh();

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVis);
  };
}, []);


  const safeBottom = "var(--safe-bottom)";
  const safeTop = "var(--safe-top)";


  const cards = useMemo(() => {
    return [
      {
        key: "practice_my_text",
        title: "Practice My Text",
        subtitle: "Type or paste your own text",
        Icon: Mic,
        onPress: () => setExpanded(true),
      },
      {
        key: "weakness",
        title: "Train your weakest sounds",
        subtitle: "Practice specific sounds",
        Icon: Target,
        onPress: () => nav("/weakness"),
      },
      {
        key: "bookmarks",
        title: "Bookmarks",
      subtitle: `${bookmarkCount} saved`,
        Icon: Bookmark,
        onPress: () => nav("/bookmarks"),
      },
    ];
  }, [nav, bookmarkCount]);

  function goRecord() {
    const seedText = String(text || "").replace(/\s+/g, " ").trim();
    nav("/record", { state: { seedText } });
  }

  return (
  <div className="page" style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      {/* Page header */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "8px 16px 14px" }}>
        <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -0.4 }}>Practice</div>
      </div>

      {/* Cards */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 110px" }}>
        <div style={{ display: "grid", gap: 14 }}>
          {/* Practice My Text card (special because it has the collapsed input) */}
          <div
            onClick={() => setExpanded(true)}
            role="button"
            tabIndex={0}
            style={{
  borderRadius: 22,
  background: "var(--panel-bg)",
  border: "1px solid var(--panel-border)",
  boxShadow: "0 8px 18px rgba(0,0,0,0.08)", // matcher .panel
  padding: 16,
  cursor: "pointer",
}}

          >
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(139,92,246,0.14)",
                  border: `1px solid rgba(139,92,246,0.20)`,
                  flex: "0 0 auto",
                }}
              >
                <Mic style={{ width: 22, height: 22, color: "rgba(139,92,246,0.95)" }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.2 }}>Practice My Text</div>
                <div style={{ marginTop: 2, color: "var(--muted)", fontWeight: 700 }}>Type or paste your own text</div>
              </div>
            </div>

            {/* Collapsed input area (tap to expand) */}
            <div
              style={{
                marginTop: 14,
                borderRadius: 18,
                background: "rgba(17,24,39,0.04)",
                border: `1px solid rgba(0,0,0,0.08)`,
                padding: "14px 14px",
                position: "relative",
                minHeight: 70,
              }}
            >
              <div style={{ color: "rgba(17,24,39,0.38)", fontWeight: 900, fontSize: 20 }}>
                {text ? text : "Tap to type…"}
              </div>

              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  color: "var(--muted)",
                  fontWeight: 800,
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      border: `3px solid rgba(139,92,246,0.25)`,
                      borderTopColor: "rgba(139,92,246,0.95)",
                    }}
                  />
                  <div>
                    {Math.min(text.length, MAX_LEN)} / {MAX_LEN}
                  </div>
                </div>

                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 999,
                    background: "rgba(17,24,39,0.06)",
                    border: `1px solid rgba(0,0,0,0.10)`,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <div style={{ width: 18, height: 12, borderRadius: 3, border: `2px solid rgba(17,24,39,0.35)` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Weakness + Bookmarks cards */}
          {cards
            .filter((c) => c.key !== "practice_my_text")
            .map((c) => (
              <div
                key={c.key}
                onClick={c.onPress}
                role="button"
                tabIndex={0}
               style={{
  borderRadius: 22,
  background: "var(--panel-bg)",
  border: "1px solid var(--panel-border)",
  boxShadow: "0 8px 18px rgba(0,0,0,0.08)",
  padding: 16,
  cursor: "pointer",
}}
              >
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 999,
                      display: "grid",
                      placeItems: "center",
                      background: "rgba(33,150,243,0.10)",
                      border: `1px solid rgba(33,150,243,0.16)`,
                      flex: "0 0 auto",
                    }}
                  >
                    <c.Icon style={{ width: 22, height: 22, color: "rgba(33,150,243,0.95)" }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.2 }}>{c.title}</div>
                    <div style={{ marginTop: 2, color: "var(--muted)", fontWeight: 700 }}>{c.subtitle}</div>
                  </div>

                  <div style={{ color: "rgba(17,24,39,0.35)", fontWeight: 900, fontSize: 20 }}>›</div>
                </div>
              </div>
            ))}
        </div>
      </div>

    {/* Practice My Text — sheet (matches video-style transition) */}
<AnimatePresence>
  {expanded ? (
    <>
      {/* Backdrop */}
      <motion.div
        key="practice-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={() => setExpanded(false)}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          background: "rgba(0,0,0,0.18)",
        }}
      />

      {/* Bottom sheet */}
      <motion.div
        key="practice-sheet"
        initial={{ y: 42, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 42, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 38 }}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,

          // sheet look
          background: "var(--bg)",
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          border: "1px solid rgba(0,0,0,0.10)",
          boxShadow: "0 -18px 44px rgba(0,0,0,0.18)",

          // size
          maxHeight: "92vh",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()} // don't close when clicking inside
      >
        {/* Sheet header */}
        <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", padding: `calc(${safeTop} + 10px) 12px 10px` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Back"
              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                border: "1px solid var(--panel-border)",
                background: "var(--panel-bg)",
                boxShadow: "0 8px 18px rgba(0,0,0,0.06)",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
            >
              <ChevronLeft style={{ width: 20, height: 20, color: "var(--text)" }} />
            </button>

            <div style={{ flex: 1, textAlign: "center", fontWeight: 900, fontSize: 18, color: "var(--text)" }}>
              Practice your words
            </div>

            <div style={{ width: 42 }} />
          </div>
        </div>

        {/* Sheet body (scrollable) */}
        <div style={{ overflow: "auto", maxHeight: `calc(92vh - 76px)` }}>
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "10px 16px 0" }}>
            <div
              style={{
                borderRadius: 26,
                background: "var(--panel-bg)",
                border: "1px solid var(--panel-border)",
                boxShadow: "0 8px 18px rgba(0,0,0,0.08)",
                padding: 18,
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  letterSpacing: -0.4,
                  lineHeight: 1.12,
                  marginBottom: 14,
                  color: "var(--text)",
                }}
              >
                Type or paste your own word or text. You can use this to practice a speech, presentation, or whatever you like!
              </div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
                placeholder="Tap to type…"
                style={{
                  width: "100%",
                  minHeight: 120,
                  borderRadius: 18,
                  border: `1px solid rgba(0,0,0,0.10)`,
                  background: "rgba(17,24,39,0.04)",
                  padding: 14,
                  outline: "none",
                  fontSize: 18,
                  fontWeight: 800,
                  color: "var(--text)",
                  resize: "none",
                }}
              />

              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, color: "var(--muted)", fontWeight: 900 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    border: `3px solid rgba(139,92,246,0.25)`,
                    borderTopColor: "rgba(139,92,246,0.95)",
                  }}
                />
                <div>
                  {Math.min(text.length, MAX_LEN)} / {MAX_LEN}
                </div>
              </div>
            </div>

            {/* Bottom CTA inside sheet */}
            <div style={{ padding: `14px 0 calc(${safeBottom} + 14px)` }}>
              <button
                type="button"
                onClick={() => {
                  setExpanded(false);
                  goRecord();
                }}
                disabled={!String(text || "").trim()}
                style={{
                  width: "100%",
                  height: 56,
                  borderRadius: 18,
                  border: "none",
                  cursor: !String(text || "").trim() ? "not-allowed" : "pointer",
                  opacity: !String(text || "").trim() ? 0.6 : 1,
                  fontWeight: 900,
                  fontSize: 18,
                  color: "white",
                  background: "linear-gradient(90deg, rgba(239,68,68,0.95), rgba(168,85,247,0.95), rgba(59,130,246,0.95))",
                  boxShadow: "0 14px 28px rgba(0,0,0,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                <Mic style={{ width: 20, height: 20, color: "white" }} />
                Start Practicing
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  ) : null}
</AnimatePresence>

    </div>
  );
}
