// frontend/src/pages/Bookmarks.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, Trash2, ChevronLeft } from "lucide-react";
import { getBookmarks, setBookmarks } from "../lib/bookmarks";
import { Navigate, useLocation } from "react-router-dom";
import { useProStatus } from "../providers/PurchasesProvider.jsx";

export default function Bookmarks() {
  const { isPro } = useProStatus();
  const location = useLocation();

  if (!isPro) {
    return (
      <Navigate
        to={`/pro?src=bookmarks_locked&return=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  const navigate = useNavigate();
  const [items, setItems] = useState(getBookmarks());

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "ac_bookmarks_v1" || e.key === "ac_bookmarks") {
        setItems(getBookmarks());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function remove(id) {
    const next = items.filter((b) => b.id !== id);
    setItems(next);
    setBookmarks(next);
  }

  function useBookmarkText(text) {
    try {
      sessionStorage.setItem("ac_bookmark_text", String(text || ""));
    } catch {}
    navigate("/record", { state: { seedText: String(text || "") } });
  }

  const cText = { color: "var(--text)" };
  const cMuted = { color: "var(--muted)" };
  const cPanelText = { color: "var(--panel-text)" };

  return (
    <div className="page">
      <div className="mx-auto w-full max-w-[720px] px-4">
{/* Fixed header (match WeaknessLab / Settings design) */}
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
          onClick={() => navigate(-1)}
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
          Bookmarks
        </div>

        <div />
      </div>
    </div>
  </div>
</div>

{/* Spacer so content doesn't go under fixed header */}
<div style={{ height: "calc(var(--safe-top) + 28px)" }} />

     {/* Panel */}
<div className="panel">
          {items.length === 0 ? (
            <div style={cMuted}>
              No bookmarks yet. Add some from the feedback card on Imitate or Speak Along.
            </div>
          ) : (
            <ul className="list-none p-0 m-0 flex flex-col gap-3">
              {items.map((b) => (
                <li
                  key={b.id}
                  className="rounded-xl p-3 flex items-start justify-between gap-3"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--panel-border)",
                    color: "var(--panel-text)",
                  }}
                >
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wide" style={cMuted}>
                      {b.type}
                    </div>

                    <div className="font-semibold break-words" style={cPanelText}>
                      {b.text}
                    </div>

                    {typeof b.score === "number" && (
                      <div className="text-sm mt-0.5" style={cMuted}>
                        Score:{" "}
                        <span className="font-semibold" style={cPanelText}>
                          {b.score}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => useBookmarkText(b.text)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid var(--panel-border)",
                        color: "var(--panel-text)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                      title="Use this text in Record"
                    >
                      Use
                    </button>

                    <button
                      type="button"
                      onClick={() => remove(b.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid var(--panel-border)",
                        color: "var(--panel-text)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                      title="Delete bookmark"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
