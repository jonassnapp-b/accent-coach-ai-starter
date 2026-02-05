// src/pages/Practice.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { ChevronLeft, Mic, Target, Bookmark } from "lucide-react";
import { getBookmarks } from "../lib/bookmarks";

export default function Practice() {
  const nav = useNavigate();

  // Keep it aligned with Record (record input maxLength=220 in Record.jsx)
  const MAX_LEN = 220;

  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [collapsedReady, setCollapsedReady] = useState(true);
// Show collapsed icon/title slightly BEFORE the close animation fully finishes
const CLOSE_DURATION_MS = 800; // matches your "expanded ? 1.15 : 0.80" close duration
const COLLAPSED_REVEAL_EARLY_MS = 360; // how much earlier it should appear
const closeRevealTimerRef = React.useRef(null);

  const [kb, setKb] = useState(0);
useEffect(() => {
  // always clear any pending timer
  if (closeRevealTimerRef.current) {
    clearTimeout(closeRevealTimerRef.current);
    closeRevealTimerRef.current = null;
  }

  if (expanded) {
    // hiding collapsed header immediately when opening
    setCollapsedReady(false);
    return;
  }

  // when closing, reveal a bit before animation ends
  const ms = Math.max(0, CLOSE_DURATION_MS - COLLAPSED_REVEAL_EARLY_MS);
  closeRevealTimerRef.current = setTimeout(() => {
    setCollapsedReady(true);
    closeRevealTimerRef.current = null;
  }, ms);
}, [expanded]);


useEffect(() => {
  if (!expanded) {
    setKb(0);
    return;
  }

  const vv = window.visualViewport;
  if (!vv) return;

  const update = () => {
    const height = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    setKb(height);
  };

  update();
  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);

  return () => {
    vv.removeEventListener("resize", update);
    vv.removeEventListener("scroll", update);
  };
}, [expanded]);

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
const clampedLen = Math.min(text.length, MAX_LEN);
const progressDeg = (clampedLen / MAX_LEN) * 360;


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
  <LayoutGroup id="practice-morph">
    <div className="page" style={{ minHeight: "100vh", position: "relative", background: "var(--bg)", color: "var(--text)" }}>
{/* Header (overlay) */}
<motion.div
  initial={false}
  animate={{ opacity: expanded ? 0 : 1 }}
  transition={{ duration: expanded ? 0.18 : 0.12, ease: [0.22, 1, 0.36, 1] }}
  style={{
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: expanded ? "none" : "auto",
  }}
>
  <div style={{ maxWidth: 720, margin: "0 auto", padding: "8px 16px 14px" }}>
    <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -0.4 }}>Practice</div>
  </div>
</motion.div>

{/* Spacer (this is what actually moves the content up smoothly) */}
<motion.div
  initial={false}
  animate={{ height: expanded ? 0 : 68 }}
  transition={{ duration: expanded ? 1.15 : 0.80, ease: [0.22, 1, 0.36, 1] }}
  style={{ overflow: "hidden" }}
/>



      {/* Cards */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 110px" }}>
        <div style={{ display: "grid", gap: 14 }}>
          {/* Practice My Text card (special because it has the collapsed input) */}
         <motion.div
  layoutId="practice-mytext-card"
  layout

  onClick={() => {
    if (!expanded) setExpanded(true);
  }}
  role="button"
  tabIndex={0}
 onLayoutAnimationComplete={() => {
  if (!expanded && !collapsedReady) setCollapsedReady(true);
}}


transition={{
  layout: { type: "tween", duration: expanded ? 1.15 : 0.80, ease: [0.22, 1, 0.36, 1] },
  default: { duration: expanded ? 1.15 : 0.80, ease: [0.22, 1, 0.36, 1] },
}}

  style={{
    borderRadius: expanded ? 26 : 22,
    background: "var(--panel-bg)",
    border: "1px solid var(--panel-border)",
    boxShadow: expanded ? "0 18px 44px rgba(0,0,0,0.18)" : "0 8px 18px rgba(0,0,0,0.08)",
    padding: expanded ? 0 : 16,
    cursor: expanded ? "default" : "pointer",
    transformOrigin: "center",

  width: "100%",
  }}
>
  {!expanded ? (
    <>
      {/* COLLAPSED (dit nuværende card-indhold) */}

     <motion.div
  initial={false}
  transition={{
  opacity: { duration: collapsedReady ? 0.32 : 0.12, ease: [0.22, 1, 0.36, 1] },
  y: { duration: collapsedReady ? 0.32 : 0.12, ease: [0.22, 1, 0.36, 1] },
}}

  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
  style={{ pointerEvents: collapsedReady ? "auto" : "none" }}
>

  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>        <div
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
  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.2 }}>
    Practice My Text
  </div>
</div>
</div>

</motion.div>

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
    background: `conic-gradient(#2196f3 ${progressDeg}deg, rgba(33,150,243,0.18) 0deg)`,
    padding: 3,
    flex: "0 0 auto",
  }}
>
  <div
    style={{
      width: "100%",
      height: "100%",
      borderRadius: 999,
      background: "var(--panel-bg)",
    }}
  />
</div>

            <div>
              {Math.min(text.length, MAX_LEN)} / {MAX_LEN}
            </div>
          </div>

        
        </div>
      </div>
    </>
  ) : (
    <>
      {/* EXPANDED (samme card, fullscreen) */}

      <div
  style={{
    paddingTop: `calc(${safeTop} + 10px)`,
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
  }}
>
        <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", padding: "8px 12px 10px" }}>
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

        <div
  style={{
    maxWidth: 720,
    margin: "0 auto",
    padding: "10px 16px 0",
    flex: 1,
    width: "100%",
    display: "flex",
    flexDirection: "column",
  }}
>
          <div
            style={{
              borderRadius: 26,
              background: "var(--panel-bg)",
              border: "1px solid var(--panel-border)",
              boxShadow: "0 8px 18px rgba(0,0,0,0.08)",
              padding: 18,
            }}
          >
         

            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
              placeholder="Start typing…"
              style={{
                width: "100%",
                minHeight: 220,
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
    background: `conic-gradient(#2196f3 ${progressDeg}deg, rgba(33,150,243,0.18) 0deg)`,
    padding: 3,
    flex: "0 0 auto",
  }}
>
  <div
    style={{
      width: "100%",
      height: "100%",
      borderRadius: 999,
      background: "var(--panel-bg)",
    }}
  />
</div>

              <div>
                {Math.min(text.length, MAX_LEN)} / {MAX_LEN}
              </div>
            </div>
          </div>

          <div style={{ padding: `14px 0 calc(${safeBottom} + ${kb}px + 14px)` }}>
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
               background: "#2196f3",
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
    </>
  )}
</motion.div>


          {/* Weakness + Bookmarks cards */}

         {!expanded &&
  cards
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



       </div>
  </LayoutGroup>
);
}

