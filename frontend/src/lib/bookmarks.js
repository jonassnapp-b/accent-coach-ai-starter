// frontend/src/lib/bookmarks.js
const KEY_NEW = "ac_bookmarks_v1";
const KEY_OLD = "ac_bookmarks"; // older builds

/* ------------ core storage ------------ */
export function getBookmarks() {
  let parsed = safeParse(localStorage.getItem(KEY_NEW));
  if (Array.isArray(parsed) && parsed.length) return parsed;

  const oldParsed = safeParse(localStorage.getItem(KEY_OLD));
  if (Array.isArray(oldParsed) && oldParsed.length) {
    setBookmarks(oldParsed);          // migrate
    try { localStorage.removeItem(KEY_OLD); } catch {}
    return oldParsed;
  }
  return [];
}

export function setBookmarks(list) {
  try { localStorage.setItem(KEY_NEW, JSON.stringify(list || [])); } catch {}
}

function safeParse(s) {
  if (!s) return [];
  try { return JSON.parse(s); } catch { return []; }
}

/* ------------ helpers used by UI ------------ */

// find by exact text (trim, case-sensitive to preserve IPA/case)
export function findBookmarkByText(text = "") {
  const t = (text || "").trim();
  if (!t) return null;
  return getBookmarks().find(b => (b?.text || "").trim() === t) || null;
}

export function isBookmarked(text = "") {
  return !!findBookmarkByText(text);
}

export function addBookmark(item = {}) {
  const list = getBookmarks();
  const id = item.id || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const entry = {
    id,
    type: item.type || "phrase",
    text: (item.text || "").trim(),
    ipa: item.ipa || "",
    score: typeof item.score === "number" ? item.score : undefined,
    createdAt: Date.now(),
  };
  if (!entry.text) return entry;

  const idx = list.findIndex(b => (b.text || "").trim() === entry.text);
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else list.unshift(entry);

  setBookmarks(list);
  return entry;
}

export function removeBookmark(id) {
  const list = getBookmarks();
  const next = list.filter(b => b.id !== id);
  setBookmarks(next);
  return next;
}

/** Toggle by text.
 *  Pass either a string or an object { text, ipa, score, type }.
 *  Returns { added: boolean, item } where item er det nuværende bookmark.
 */
export function toggleBookmark(itemOrText) {
  const item = typeof itemOrText === "string" ? { text: itemOrText } : (itemOrText || {});
  const existing = findBookmarkByText(item.text);
  if (existing) {
    removeBookmark(existing.id);
    return { added: false, item: existing };
    // (hvis du vil returnere den nye liste, kan du kalde getBookmarks() her)
  } else {
    const created = addBookmark(item);
    return { added: true, item: created };
  }
}
