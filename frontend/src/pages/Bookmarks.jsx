// frontend/src/pages/Bookmarks.jsx
import React, { useEffect, useState } from "react";
import { Bookmark, Trash2, Plus } from "lucide-react";
import { getBookmarks, setBookmarks } from "../lib/bookmarks";

export default function Bookmarks() {
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

  return (
    <div className="w-full min-h-[calc(100vh-5rem)] bg-[#0B0F17] px-4 py-5">
      {/* page header */}
      <div className="max-w-3xl mx-auto flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl grid place-items-center bg-white/10 text-white">
          <Bookmark className="h-5 w-5" />
        </div>
        <h1 className="text-white text-xl font-semibold">Bookmarks</h1>
      </div>

      {/* full-bleed panel */}
      <div className="max-w-3xl mx-auto rounded-2xl bg-[#12131A] text-white border border-white/10 p-4 sm:p-5">
        {items.length === 0 ? (
          <div className="text-white/70">
            No bookmarks yet. Add some from the feedback card on Imitate or Speak Along.
          </div>
        ) : (
          <ul className="list-none p-0 m-0 flex flex-col gap-3">
            {items.map((b) => (
              <li
                key={b.id}
                className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wide text-white/60">{b.type}</div>
                  <div className="font-semibold break-words">{b.text}</div>
                  {b.ipa && <div className="text-white/70 mt-0.5">{b.ipa}</div>}
                  {typeof b.score === "number" && (
                    <div className="text-white/70 text-sm mt-0.5">
                      Score: <span className="font-semibold">{b.score}%</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 shrink-0">
                  {/* Optional: put this text back in the Record box */}
                  <a
                    href="/record"
                    onClick={() => {
                      // stash the text so Record can read it (mini handoff)
                      sessionStorage.setItem("ac_bookmark_text", b.text || "");
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20"
                  >
                    <Plus className="h-4 w-4" /> Use
                  </a>

                  <button
                    onClick={() => remove(b.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20"
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
  );
}