// frontend/src/pages/Bookmarks.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, Trash2 } from "lucide-react";
import { getBookmarks, setBookmarks } from "../lib/bookmarks";

export default function Bookmarks() {
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
      <div className="mx-auto w-full max-w-[720px] px-4 py-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div
            className="h-10 w-10 rounded-xl grid place-items-center"
            style={{
              background: "rgba(33,150,243,0.10)",
              border: "1px solid rgba(33,150,243,0.18)",
              color: "var(--text)",
            }}
            aria-hidden="true"
          >
            <Bookmark className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold" style={cText}>
            Bookmarks
          </h1>
          <button
  type="button"
 onClick={() => navigate(-1)}
  className="btn btn-ghost btn-sm"
  style={{
    borderRadius: 14,
    padding: "10px 14px",
    fontWeight: 900,
  }}
>
  Back
</button>

        </div>

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
